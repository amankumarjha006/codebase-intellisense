import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.workers.indexing_worker import (
    IndexingWorker,
    QUEUE_NAME,
    PROCESSING_QUEUE_NAME,
    enqueue_indexing_job,
)


class TestIndexingWorkerReliability:
    """Tests for indexing worker crash resilience and recovery."""

    @pytest.fixture
    def mock_redis(self):
        client = MagicMock()
        client.exists.return_value = 0
        return client

    @pytest.fixture
    def mock_db(self):
        session = MagicMock()
        return session

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_pop_to_processing_uses_atomic_move(self, mock_from_url, mock_redis):
        mock_from_url.return_value = mock_redis
        worker = IndexingWorker()

        mock_redis.lmove.return_value = "job-123"
        result = worker._pop_to_processing()

        assert result == "job-123"
        mock_redis.lmove.assert_called_once_with(
            QUEUE_NAME, PROCESSING_QUEUE_NAME, wherefrom="LEFT", whereto="RIGHT"
        )

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_pop_to_processing_falls_back_to_lua_if_lmove_unsupported(self, mock_from_url, mock_redis):
        import redis
        mock_from_url.return_value = mock_redis
        mock_redis.lmove.side_effect = redis.ResponseError("unknown command 'LMOVE'")
        mock_redis.eval.return_value = "job-lua-123"

        worker = IndexingWorker()
        result = worker._pop_to_processing()

        assert result == "job-lua-123"
        mock_redis.eval.assert_called_once()

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_process_next_job_success_removes_from_processing(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        mock_redis.lmove.return_value = str(job_id)

        worker = IndexingWorker()
        worker.db = mock_db

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.status = "QUEUED"

        with patch("app.workers.indexing_worker.RepositoryRepository") as mock_repo_cls, \
             patch("app.workers.indexing_worker.IndexingService") as mock_indexing_service_cls, \
             patch("app.workers.indexing_worker.KnowledgeRepository"), \
             patch("app.workers.indexing_worker.get_embedding_provider"), \
             patch("app.workers.indexing_worker.EmbeddingService"):
            
            mock_repo = MagicMock()
            mock_repo.get_job_by_id.return_value = mock_job
            mock_repo_cls.return_value = mock_repo

            mock_indexing_service = MagicMock()
            mock_indexing_service_cls.return_value = mock_indexing_service

            worker._process_next_job()

            mock_indexing_service.run_indexing.assert_called_once_with(mock_job)
            mock_redis.lrem.assert_called_once_with(PROCESSING_QUEUE_NAME, 0, str(job_id))

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_process_next_job_failure_marks_failed_and_removes_from_processing(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        mock_redis.lmove.return_value = str(job_id)

        worker = IndexingWorker()
        worker.db = mock_db

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.status = "QUEUED"

        with patch("app.workers.indexing_worker.RepositoryRepository") as mock_repo_cls, \
             patch("app.workers.indexing_worker.IndexingService") as mock_indexing_service_cls, \
             patch("app.workers.indexing_worker.KnowledgeRepository"), \
             patch("app.workers.indexing_worker.get_embedding_provider"), \
             patch("app.workers.indexing_worker.EmbeddingService"):
            
            mock_repo = MagicMock()
            mock_repo.get_job_by_id.return_value = mock_job
            mock_repo_cls.return_value = mock_repo

            mock_indexing_service = MagicMock()
            mock_indexing_service.run_indexing.side_effect = RuntimeError("Indexing crashed")
            mock_indexing_service_cls.return_value = mock_indexing_service

            worker._process_next_job()

            assert mock_job.status == "FAILED"
            assert mock_job.failure_code == "INTERNAL_ERROR"
            mock_redis.lrem.assert_called_once_with(PROCESSING_QUEUE_NAME, 0, str(job_id))

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_recover_orphaned_jobs_marks_stuck_jobs_failed(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        
        # Redis has one orphan job in processing queue
        mock_redis.lrange.return_value = [str(job_id)]

        worker = IndexingWorker()
        worker.db = mock_db

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.status = "FETCHING"

        with patch("app.workers.indexing_worker.RepositoryRepository") as mock_repo_cls, \
             patch("app.workers.indexing_worker.select") as mock_select:
            mock_repo = MagicMock()
            mock_repo.get_job_by_id.return_value = mock_job
            mock_repo_cls.return_value = mock_repo

            # Mock finding stuck DB jobs
            mock_db.execute.return_value.scalars.return_value.all.return_value = []

            worker.recover_orphaned_jobs()

            assert mock_job.status == "FAILED"
            assert mock_job.failure_code == "INTERNAL_ERROR"
            assert "Worker terminated unexpectedly" in mock_job.error_message
            mock_db.commit.assert_called()
            mock_redis.lrem.assert_called_once_with(PROCESSING_QUEUE_NAME, 0, str(job_id))

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_recover_orphaned_jobs_cleans_already_completed_jobs(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        
        mock_redis.lrange.return_value = [str(job_id)]

        worker = IndexingWorker()
        worker.db = mock_db

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.status = "READY"

        with patch("app.workers.indexing_worker.RepositoryRepository") as mock_repo_cls:
            mock_repo = MagicMock()
            mock_repo.get_job_by_id.return_value = mock_job
            mock_repo_cls.return_value = mock_repo
            mock_db.execute.return_value.scalars.return_value.all.return_value = []

            worker.recover_orphaned_jobs()

            # Status should not change to FAILED
            assert mock_job.status == "READY"
            mock_redis.lrem.assert_called_once_with(PROCESSING_QUEUE_NAME, 0, str(job_id))

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_recover_orphaned_jobs_reconciles_stuck_db_jobs_not_in_redis(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        mock_redis.lrange.return_value = []

        worker = IndexingWorker()
        worker.db = mock_db

        stuck_job = MagicMock()
        stuck_job.id = uuid4()
        stuck_job.status = "INDEXING"

        mock_db.execute.return_value.scalars.return_value.all.return_value = [stuck_job]

        worker.recover_orphaned_jobs()

        assert stuck_job.status == "FAILED"
        assert stuck_job.failure_code == "INTERNAL_ERROR"
        assert "Worker terminated unexpectedly" in stuck_job.error_message
        mock_db.commit.assert_called()

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_recover_orphaned_jobs_skips_actively_leased_in_flight_jobs(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        
        mock_redis.lrange.return_value = [str(job_id)]
        # Sibling worker holds the active lease
        mock_redis.exists.return_value = True

        worker = IndexingWorker()
        worker.db = mock_db

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.status = "FETCHING"

        with patch("app.workers.indexing_worker.RepositoryRepository") as mock_repo_cls:
            mock_repo = MagicMock()
            mock_repo.get_job_by_id.return_value = mock_job
            mock_repo_cls.return_value = mock_repo
            mock_db.execute.return_value.scalars.return_value.all.return_value = []

            worker.recover_orphaned_jobs()

            # Status should not change to FAILED, job not removed from queue
            assert mock_job.status == "FETCHING"
            mock_redis.lrem.assert_not_called()
            mock_db.commit.assert_not_called()

    @patch("app.workers.indexing_worker.redis.from_url")
    def test_recover_orphaned_jobs_skips_stuck_db_jobs_if_in_flight_or_leased(self, mock_from_url, mock_redis, mock_db):
        mock_from_url.return_value = mock_redis
        job_id = uuid4()
        
        # Job is currently in processing queue on another worker
        mock_redis.lrange.return_value = [str(job_id)]
        mock_redis.exists.return_value = True

        worker = IndexingWorker()
        worker.db = mock_db

        stuck_job = MagicMock()
        stuck_job.id = job_id
        stuck_job.status = "INDEXING"

        mock_db.execute.return_value.scalars.return_value.all.return_value = [stuck_job]

        worker.recover_orphaned_jobs()

        # Sibling active job must NOT be marked failed
        assert stuck_job.status == "INDEXING"
        mock_db.commit.assert_not_called()
