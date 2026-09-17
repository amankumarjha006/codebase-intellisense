import asyncio
import logging
import signal
import sys
from typing import Optional
from uuid import UUID

import redis
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.repository import IndexJob
from app.repositories.repository import RepositoryRepository
from app.services.indexing import IndexingService

logger = logging.getLogger(__name__)

QUEUE_NAME = "indexing_jobs"
POLL_INTERVAL = 5


class IndexingWorker:
    """Background worker that processes indexing jobs from Redis queue."""

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

        while self.running:
            try:
                self._process_next_job()
            except Exception as e:
                logger.error(f"Error in worker loop: {e}", exc_info=True)
            finally:
                if self.db:
                    self.db.close()
                    self.db = None

            if self.running:
                asyncio.run(asyncio.sleep(POLL_INTERVAL))

    def _signal_handler(self, signum, frame) -> None:
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False

    def _get_db(self) -> Session:
        """Get a database session."""
        if self.db is None:
            self.db = SessionLocal()
        return self.db

    def _process_next_job(self) -> None:
        """Process the next job from the queue."""
        job_id_str = self.redis_client.lpop(QUEUE_NAME)
        if not job_id_str:
            return

        try:
            job_id = UUID(job_id_str)
        except ValueError:
            logger.error(f"Invalid job ID in queue: {job_id_str}")
            return

        self.current_job_id = job_id
        logger.info(f"Processing indexing job {job_id}")

        db = self._get_db()
        try:
            repo_repo = RepositoryRepository(db)
            job = repo_repo.get_job_by_id(job_id)

            if not job:
                logger.warning(f"Job {job_id} not found in database")
                return

            if job.status != "QUEUED":
                logger.warning(f"Job {job_id} is not in QUEUED status (current: {job.status})")
                return

            from app.repositories.knowledge import KnowledgeRepository
            from app.services.embedding.factory import get_embedding_provider
            from app.services.embedding.service import EmbeddingService
            
            knowledge_repo = KnowledgeRepository(db)
            provider = get_embedding_provider(settings)
            embedding_service = EmbeddingService(knowledge_repo, provider)

            indexing_service = IndexingService(db, embedding_service=embedding_service)
            indexing_service.run_indexing(job)

            logger.info(f"Completed indexing job {job_id}")

        except Exception as e:
            logger.error(f"Failed to process job {job_id}: {e}", exc_info=True)
            self._mark_job_failed(job_id, str(e))
        finally:
            self.current_job_id = None

    def _mark_job_failed(self, job_id: UUID, error_message: str) -> None:
        """Mark a job as failed."""
        db = self._get_db()
        try:
            repo_repo = RepositoryRepository(db)
            job = repo_repo.get_job_by_id(job_id)
            if job:
                from datetime import datetime, timezone
                job.status = "FAILED"
                job.error_message = error_message
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