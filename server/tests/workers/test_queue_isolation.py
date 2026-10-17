import pytest
import redis
from uuid import uuid4
from app.core.config import settings
from app.workers.indexing_worker import enqueue_indexing_job, QUEUE_NAME, PROCESSING_QUEUE_NAME


def test_test_redis_url_isolated_from_dev_db():
    """Verify that during tests, settings.REDIS_URL is isolated to test DB (DB 15), not DB 0."""
    assert "/15" in settings.REDIS_URL
    assert not settings.REDIS_URL.endswith("/0")


def test_enqueue_indexing_job_does_not_pollute_dev_queue():
    """
    Verify that calling enqueue_indexing_job during a test pushes to the test Redis DB
    and leaves ZERO keys in the development Redis queue (DB 0).
    """
    dev_url = "redis://localhost:6379/0"
    dev_client = redis.from_url(dev_url, decode_responses=True)
    
    # Record starting length in dev queue
    dev_start_len = dev_client.llen("indexing_jobs")
    dev_proc_start_len = dev_client.llen("indexing_jobs:processing")
    assert dev_start_len == 0, f"Dev queue already contains {dev_start_len} items before test!"
    assert dev_proc_start_len == 0, f"Dev processing queue already contains {dev_proc_start_len} items before test!"

    # Enqueue a dummy job via the worker enqueue function
    test_job_id = uuid4()
    enqueue_indexing_job(test_job_id)

    # Verify item was written to test DB (DB 15)
    test_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    test_queue_items = test_client.lrange("indexing_jobs", 0, -1)
    assert str(test_job_id) in test_queue_items

    # Cleanup test DB
    test_client.lrem("indexing_jobs", 0, str(test_job_id))

    # CRITICAL: Prove that the dev DB 0 queue was NOT touched
    dev_end_len = dev_client.llen("indexing_jobs")
    dev_proc_end_len = dev_client.llen("indexing_jobs:processing")
    assert dev_end_len == 0, f"Dev queue was polluted! Found {dev_end_len} keys in DB 0"
    assert dev_proc_end_len == 0, f"Dev processing queue was polluted! Found {dev_proc_end_len} keys in DB 0"


def test_dev_queue_remains_clean_after_all_operations():
    """
    Final proof check that the real dev Redis queue on DB 0 contains exactly 0 keys.
    """
    dev_client = redis.from_url("redis://localhost:6379/0", decode_responses=True)
    assert dev_client.llen("indexing_jobs") == 0
    assert dev_client.llen("indexing_jobs:processing") == 0
