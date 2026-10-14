import logging
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.repository import IndexJob
from app.repositories.knowledge import KnowledgeRepository
from app.repositories.repository import RepositoryRepository
from app.services.embedding.factory import get_embedding_provider
from app.services.embedding.service import EmbeddingService
from app.services.indexing import IndexingService

logger = logging.getLogger(__name__)

QUEUE_NAME = "indexing_jobs"
PROCESSING_QUEUE_NAME = "indexing_jobs:processing"
LEASE_PREFIX = "indexing_job_lease:"
DEFAULT_LEASE_TTL = 30
DEFAULT_HEARTBEAT_INTERVAL = 10
POLL_INTERVAL = 5


class JobLease:
    """Maintains a Redis lease with background heartbeats while an indexing job runs."""

    def __init__(
        self,
        redis_client: redis.Redis,
        job_id: UUID,
        ttl: int = DEFAULT_LEASE_TTL,
        interval: int = DEFAULT_HEARTBEAT_INTERVAL,
    ):
        self.redis_client = redis_client
        self.key = f"{LEASE_PREFIX}{job_id}"
        self.ttl = ttl
        self.interval = interval
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def __enter__(self):
        try:
            self.redis_client.set(self.key, "1", ex=self.ttl)
        except Exception as e:
            logger.warning(f"Failed to acquire initial lease for {self.key}: {e}")
        self._thread = threading.Thread(target=self._heartbeat, daemon=True)
        self._thread.start()
        return self

    def _heartbeat(self):
        while not self._stop_event.wait(self.interval):
            try:
                self.redis_client.set(self.key, "1", ex=self.ttl)
            except Exception as e:
                logger.warning(f"Failed to renew lease for {self.key}: {e}")

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._stop_event.set()
        try:
            self.redis_client.delete(self.key)
        except Exception as e:
            logger.warning(f"Failed to release lease for {self.key}: {e}")


class IndexingWorker:
    """Background worker that processes indexing jobs from Redis queue with crash resilience."""

    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.running = False
        self.current_job_id: Optional[UUID] = None
        self.db: Optional[Session] = None

    def start(self) -> None:
        """Start the worker loop."""
        self.running = True
        logger.info("Indexing worker started")

        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        # Recover any orphaned jobs from a previous worker crash
        try:
            self.recover_orphaned_jobs()
        except Exception as e:
            logger.error(f"Error during startup job recovery: {e}", exc_info=True)

        while self.running:
            had_job = False
            try:
                had_job = self._process_next_job()
            except Exception as e:
                logger.error(f"Error in worker loop: {e}", exc_info=True)
            finally:
                if self.db:
                    self.db.close()
                    self.db = None

            if self.running and not had_job:
                time.sleep(POLL_INTERVAL)

    def _signal_handler(self, signum, frame) -> None:
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False

    def _get_db(self) -> Session:
        """Get a database session."""
        if self.db is None:
            self.db = SessionLocal()
        return self.db

    def _pop_to_processing(self) -> Optional[str]:
        """Atomically pop the next job ID from QUEUE_NAME and push to PROCESSING_QUEUE_NAME."""
        try:
            return self.redis_client.lmove(
                QUEUE_NAME, PROCESSING_QUEUE_NAME, src="LEFT", dest="RIGHT"
            )
        except (redis.ResponseError, AttributeError, TypeError):
            # Fallback for Redis versions that do not support LMOVE
            lua_script = """
            local job = redis.call('LPOP', KEYS[1])
            if job then
                redis.call('RPUSH', KEYS[2], job)
            end
            return job
            """
            return self.redis_client.eval(lua_script, 2, QUEUE_NAME, PROCESSING_QUEUE_NAME)

    def _remove_from_processing(self, job_id_str: str) -> None:
        """Remove a completed or failed job ID from the in-flight processing queue."""
        try:
            self.redis_client.lrem(PROCESSING_QUEUE_NAME, 0, job_id_str)
        except Exception as e:
            logger.error(f"Failed to remove job {job_id_str} from processing queue: {e}")

    def _is_job_active(self, job_id_str: str) -> bool:
        """Check if a job currently has an active worker lease in Redis."""
        try:
            return bool(self.redis_client.exists(f"{LEASE_PREFIX}{job_id_str}"))
        except Exception as e:
            logger.error(f"Failed to check lease for job {job_id_str}: {e}")
            return False

    def recover_orphaned_jobs(self) -> None:
        """Recover any orphaned jobs in PROCESSING_QUEUE_NAME or stuck in DB after a worker crash."""
        logger.info("Checking for orphaned in-flight indexing jobs...")
        db = self._get_db()
        repo_repo = RepositoryRepository(db)

        # 1. Check in-flight jobs in Redis processing queue
        in_flight_ids: set[str] = set()
        try:
            raw_in_flight = self.redis_client.lrange(PROCESSING_QUEUE_NAME, 0, -1) or []
            in_flight_ids = {str(jid) for jid in raw_in_flight}
            for job_id_str in in_flight_ids:
                if self._is_job_active(job_id_str):
                    logger.info(f"Job {job_id_str} has an active lease on a sibling worker; skipping recovery")
                    continue

                try:
                    job_id = UUID(job_id_str)
                    job = repo_repo.get_job_by_id(job_id)
                    if not job:
                        logger.warning(f"Orphaned job {job_id_str} not found in DB; removing from processing queue")
                        self._remove_from_processing(job_id_str)
                        continue

                    if job.status in ("READY", "FAILED"):
                        logger.info(f"Job {job_id_str} is already {job.status}; removing from processing queue")
                        self._remove_from_processing(job_id_str)
                    else:
                        logger.warning(
                            f"Marking orphaned in-flight job {job_id} as FAILED (was in status {job.status})"
                        )
                        job.status = "FAILED"
                        job.failure_code = "INTERNAL_ERROR"
                        job.error_message = "Worker terminated unexpectedly during processing"
                        job.completed_at = datetime.now(timezone.utc)
                        db.commit()
                        self._remove_from_processing(job_id_str)
                except Exception as e:
                    logger.error(f"Failed to reconcile processing job {job_id_str}: {e}")
                    db.rollback()
        except Exception as e:
            logger.error(f"Failed to inspect processing queue: {e}")

        # 2. Check any DB jobs stuck in FETCHING or INDEXING with no active worker
        try:
            stuck_jobs = list(
                db.execute(
                    select(IndexJob).where(IndexJob.status.in_(["FETCHING", "INDEXING"]))
                )
                .scalars()
                .all()
            )
            reconciled_count = 0
            for stuck_job in stuck_jobs:
                if str(stuck_job.id) in in_flight_ids or self._is_job_active(str(stuck_job.id)):
                    logger.info(f"Database job {stuck_job.id} is in-flight or actively leased; skipping recovery")
                    continue

                logger.warning(f"Marking stuck database job {stuck_job.id} as FAILED (was in status {stuck_job.status})")
                stuck_job.status = "FAILED"
                stuck_job.failure_code = "INTERNAL_ERROR"
                stuck_job.error_message = "Worker terminated unexpectedly during processing"
                stuck_job.completed_at = datetime.now(timezone.utc)
                reconciled_count += 1
            if reconciled_count > 0:
                db.commit()
                logger.info(f"Reconciled {reconciled_count} stuck indexing jobs in database")
        except Exception as e:
            logger.error(f"Error reconciling stuck database jobs: {e}")
            db.rollback()

    def _process_next_job(self) -> bool:
        """Process the next job from the queue with crash protection. Returns True if a job was popped."""
        job_id_str = self._pop_to_processing()
        if not job_id_str:
            return False

        try:
            job_id = UUID(job_id_str)
        except ValueError:
            logger.error(f"Invalid job ID in queue: {job_id_str}")
            self._remove_from_processing(job_id_str)
            return True

        self.current_job_id = job_id
        logger.info(f"Processing indexing job {job_id}")

        db = self._get_db()
        try:
            repo_repo = RepositoryRepository(db)
            job = repo_repo.get_job_by_id(job_id)

            if not job:
                logger.warning(f"Job {job_id} not found in database")
                self._remove_from_processing(job_id_str)
                return True

            if job.status != "QUEUED":
                logger.warning(f"Job {job_id} is not in QUEUED status (current: {job.status})")
                self._remove_from_processing(job_id_str)
                return True

            knowledge_repo = KnowledgeRepository(db)
            provider = get_embedding_provider(settings)
            embedding_service = EmbeddingService(knowledge_repo, provider)

            indexing_service = IndexingService(db, embedding_service=embedding_service)
            with JobLease(self.redis_client, job_id):
                indexing_service.run_indexing(job)

            logger.info(f"Completed indexing job {job_id}")
            self._remove_from_processing(job_id_str)
            return True

        except Exception as e:
            logger.error(f"Failed to process job {job_id}: {e}", exc_info=True)
            self._mark_job_failed(job_id, str(e))
            self._remove_from_processing(job_id_str)
            return True
        finally:
            self.current_job_id = None

    def _mark_job_failed(self, job_id: UUID, error_message: str, failure_code: str = "INTERNAL_ERROR") -> None:
        """Mark a job as failed."""
        db = self._get_db()
        try:
            repo_repo = RepositoryRepository(db)
            job = repo_repo.get_job_by_id(job_id)
            if job:
                job.status = "FAILED"
                job.error_message = error_message
                if not job.failure_code:
                    job.failure_code = failure_code
                job.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to mark job {job_id} as failed: {e}")
            db.rollback()

    def stop(self) -> None:
        """Stop the worker."""
        self.running = False
        if self.db:
            self.db.close()


def enqueue_indexing_job(job_id: UUID) -> None:
    """Add an indexing job to the Redis queue."""
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    redis_client.rpush(QUEUE_NAME, str(job_id))
    logger.info(f"Enqueued indexing job {job_id}")


def main() -> None:
    """Main entry point for the worker."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    worker = IndexingWorker()
    try:
        worker.start()
    except KeyboardInterrupt:
        logger.info("Worker interrupted")
    finally:
        worker.stop()


if __name__ == "__main__":
    main()