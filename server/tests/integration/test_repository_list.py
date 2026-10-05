"""
Integration tests for the repository list endpoint with lateral-join status fields.

Covers:
- No jobs → all new fields null
- Latest job FAILED after earlier READY → latest_job_status FAILED, last_indexed_at from earlier success
- Latest job in progress → its status returned, last_indexed_at from previous success or null
- Tenant isolation: user A never sees user B's data via the joined fields
- Pagination across 3+ pages returns same total, deterministic order, correct items
- Equal created_at values yield deterministic order (id tie-breaker)
- Query count is constant (2) regardless of page size
"""
import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import event

from app.repositories.repository import RepositoryRepository, RepositoryListRow
from app.models.repository import Repository, RepositoryVersion, IndexJob, UserRepository

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_repo(db: Session, user_id, name: str, created_at: datetime | None = None) -> Repository:
    """Create a repository with user access, optionally backdating created_at."""
    repo = Repository(
        github_repo_id=f"gh-{uuid4().hex[:12]}",
        owner="test-owner",
        name=name,
        clone_url=f"https://github.com/test-owner/{name}.git",
        is_private=False,
    )
    if created_at:
        repo.created_at = created_at
    db.add(repo)
    db.flush()
    ua = UserRepository(user_id=user_id, repository_id=repo.id)
    db.add(ua)
    db.flush()
    return repo


def _seed_version(db, repo_id, sha, status="PENDING", indexed_at=None) -> RepositoryVersion:
    v = RepositoryVersion(
        repository_id=repo_id,
        commit_sha=sha,
        branch="main",
        index_status=status,
        indexed_at=indexed_at,
    )
    db.add(v)
    db.flush()
    return v


def _seed_job(db, repo_id, version_id, status="QUEUED", created_at=None, error_message=None, failure_code=None) -> IndexJob:
    j = IndexJob(
        repository_id=repo_id,
        repository_version_id=version_id,
        status=status,
        error_message=error_message,
        failure_code=failure_code,
    )
    if created_at:
        j.created_at = created_at
    db.add(j)
    db.flush()
    return j


# ---------------------------------------------------------------------------
# Test: No jobs → all new fields null
# ---------------------------------------------------------------------------

def test_repo_no_jobs_all_null(db_session, data_factory):
    user = data_factory.create_user()
    _seed_repo(db_session, user.id, "empty-repo")
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)
    items, total = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)

    assert total == 1
    assert len(items) == 1
    item = items[0]
    assert isinstance(item, RepositoryListRow)
    assert item.latest_job_status is None
    assert item.latest_job_failure_code is None
    assert item.active_version_short_sha is None
    assert item.last_indexed_at is None


# ---------------------------------------------------------------------------
# Test: Latest FAILED after earlier SUCCESS
# ---------------------------------------------------------------------------

def test_failed_after_success(db_session, data_factory):
    user = data_factory.create_user()
    repo = _seed_repo(db_session, user.id, "fail-repo")

    t_success = datetime.now(timezone.utc) - timedelta(hours=2)
    v_ok = _seed_version(db_session, repo.id, "aabbccdd11223344", status="SUCCESS", indexed_at=t_success)
    _seed_job(db_session, repo.id, v_ok.id, status="READY", created_at=t_success)

    t_fail = datetime.now(timezone.utc) - timedelta(minutes=10)
    v_bad = _seed_version(db_session, repo.id, "deadbeef00000000", status="FAILED", indexed_at=t_fail)
    _seed_job(db_session, repo.id, v_bad.id, status="FAILED", created_at=t_fail, failure_code="CLONE_FAILED")
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)
    items, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)
    item = items[0]

    assert item.latest_job_status == "FAILED"
    assert item.latest_job_failure_code == "CLONE_FAILED"
    assert item.active_version_short_sha == "aabbccd"  # first 7 of aabbccdd11223344
    assert item.last_indexed_at == t_success


# ---------------------------------------------------------------------------
# Test: Latest job in progress, previous success exists
# ---------------------------------------------------------------------------

def test_in_progress_with_prior_success(db_session, data_factory):
    user = data_factory.create_user()
    repo = _seed_repo(db_session, user.id, "prog-repo")

    t_success = datetime.now(timezone.utc) - timedelta(hours=3)
    v_ok = _seed_version(db_session, repo.id, "1111111222222233", status="SUCCESS", indexed_at=t_success)
    _seed_job(db_session, repo.id, v_ok.id, status="READY", created_at=t_success)

    t_prog = datetime.now(timezone.utc) - timedelta(minutes=2)
    v_prog = _seed_version(db_session, repo.id, "4444444555555566", status="PENDING")
    _seed_job(db_session, repo.id, v_prog.id, status="INDEXING", created_at=t_prog)
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)
    items, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)
    item = items[0]

    assert item.latest_job_status == "INDEXING"
    assert item.latest_job_failure_code is None
    assert item.active_version_short_sha == "1111111"
    assert item.last_indexed_at == t_success


# ---------------------------------------------------------------------------
# Test: In progress, no prior success
# ---------------------------------------------------------------------------

def test_in_progress_no_prior_success(db_session, data_factory):
    user = data_factory.create_user()
    repo = _seed_repo(db_session, user.id, "new-prog-repo")

    v = _seed_version(db_session, repo.id, "aaaa0000bbbb1111", status="PENDING")
    _seed_job(db_session, repo.id, v.id, status="FETCHING")
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)
    items, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)
    item = items[0]

    assert item.latest_job_status == "FETCHING"
    assert item.active_version_short_sha is None
    assert item.last_indexed_at is None


# ---------------------------------------------------------------------------
# Test: Tenant isolation — user A never sees user B's data
# ---------------------------------------------------------------------------

def test_tenant_isolation(db_session, data_factory):
    user_a = data_factory.create_user(email="a@example.com")
    user_b = data_factory.create_user(email="b@example.com")

    repo_a = _seed_repo(db_session, user_a.id, "repo-a")
    t_a = datetime.now(timezone.utc) - timedelta(hours=1)
    v_a = _seed_version(db_session, repo_a.id, "aaaa1111aaaa1111", status="SUCCESS", indexed_at=t_a)
    _seed_job(db_session, repo_a.id, v_a.id, status="READY", created_at=t_a)

    repo_b = _seed_repo(db_session, user_b.id, "repo-b")
    t_b = datetime.now(timezone.utc) - timedelta(minutes=30)
    v_b = _seed_version(db_session, repo_b.id, "bbbb2222bbbb2222", status="FAILED", indexed_at=t_b)
    _seed_job(db_session, repo_b.id, v_b.id, status="FAILED", created_at=t_b, failure_code="CLONE_FAILED")
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)

    items_a, total_a = repo_layer.list_for_user(user_id=user_a.id, page=1, limit=50)
    assert total_a == 1
    assert len(items_a) == 1
    assert items_a[0].name == "repo-a"
    assert items_a[0].latest_job_status == "READY"
    assert items_a[0].active_version_short_sha == "aaaa111"
    # Ensure none of user B's data leaks
    assert items_a[0].latest_job_failure_code is None  # user A's job has no error
    for item in items_a:
        assert "repo-b" != item.name
        assert item.latest_job_failure_code != "CLONE_FAILED"
        assert item.active_version_short_sha != "bbbb222"

    items_b, total_b = repo_layer.list_for_user(user_id=user_b.id, page=1, limit=50)
    assert total_b == 1
    assert items_b[0].name == "repo-b"
    assert items_b[0].latest_job_status == "FAILED"
    assert items_b[0].latest_job_failure_code == "CLONE_FAILED"


# ---------------------------------------------------------------------------
# Test: Pagination across 3+ pages, stable ordering, same total
# ---------------------------------------------------------------------------

def test_pagination_three_pages(db_session, data_factory):
    user = data_factory.create_user()
    now = datetime.now(timezone.utc)

    # Create 7 repos with distinct created_at values
    names = []
    for i in range(7):
        name = f"page-repo-{i:02d}"
        names.append(name)
        _seed_repo(db_session, user.id, name, created_at=now - timedelta(hours=7 - i))
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)

    # Page size 3 → 3 pages (3, 3, 1)
    all_items = []
    for p in range(1, 4):
        items, total = repo_layer.list_for_user(user_id=user.id, page=p, limit=3)
        assert total == 7, f"Total must be constant across pages, got {total} on page {p}"
        all_items.extend(items)

    assert len(all_items) == 7

    # Items should be in created_at DESC order (most recent first)
    # The most recently created repo is page-repo-06 (created_at = now - 0h)
    assert all_items[0].name == "page-repo-06"
    assert all_items[-1].name == "page-repo-00"

    # No duplicates
    ids = [i.id for i in all_items]
    assert len(set(ids)) == 7

    # Re-fetch and verify determinism
    items_page1_a, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=3)
    items_page1_b, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=3)
    assert [i.id for i in items_page1_a] == [i.id for i in items_page1_b]


# ---------------------------------------------------------------------------
# Test: Equal created_at → deterministic order via id tie-breaker
# ---------------------------------------------------------------------------

def test_equal_created_at_deterministic_order(db_session, data_factory):
    user = data_factory.create_user()
    same_time = datetime.now(timezone.utc) - timedelta(hours=5)

    repos = []
    for i in range(4):
        repos.append(_seed_repo(db_session, user.id, f"tie-repo-{i}", created_at=same_time))
    db_session.commit()

    repo_layer = RepositoryRepository(db_session)

    items_1, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)
    items_2, _ = repo_layer.list_for_user(user_id=user.id, page=1, limit=10)

    order_1 = [i.id for i in items_1]
    order_2 = [i.id for i in items_2]

    assert len(order_1) == 4
    assert order_1 == order_2, "Order must be deterministic when created_at is equal"

    # Verify they are sorted by id DESC
    for a, b in zip(order_1, order_1[1:]):
        assert a > b, "Tie-breaker must be id DESC"


# ---------------------------------------------------------------------------
# Test: Query count is constant (2) regardless of page contents
# ---------------------------------------------------------------------------

def test_query_count_constant(db_session, data_factory):
    user = data_factory.create_user()
    now = datetime.now(timezone.utc)

    # Create 5 repos, some with jobs/versions
    for i in range(5):
        repo = _seed_repo(db_session, user.id, f"qc-repo-{i}", created_at=now - timedelta(hours=i))
        if i % 2 == 0:
            v = _seed_version(db_session, repo.id, f"sha{i:040d}", status="SUCCESS",
                              indexed_at=now - timedelta(hours=i))
            _seed_job(db_session, repo.id, v.id, status="READY", created_at=now - timedelta(hours=i))
    db_session.commit()

    # Extract user.id to avoid lazy loading it inside the counter scope
    u_id = user.id

    engine = db_session.get_bind()
    query_count = 0

    def _counter(conn, cursor, statement, parameters, context, executemany):
        nonlocal query_count
        query_count += 1

    event.listen(engine, "before_cursor_execute", _counter)
    try:
        repo_layer = RepositoryRepository(db_session)

        # Page 1, limit 2
        query_count = 0
        repo_layer.list_for_user(user_id=u_id, page=1, limit=2)
        assert query_count == 2, f"Expected 2 queries, got {query_count}"

        # Page 2, limit 2
        query_count = 0
        repo_layer.list_for_user(user_id=u_id, page=2, limit=2)
        assert query_count == 2, f"Expected 2 queries, got {query_count}"

        # Page 3, limit 2 (only 1 item)
        query_count = 0
        repo_layer.list_for_user(user_id=u_id, page=3, limit=2)
        assert query_count == 2, f"Expected 2 queries, got {query_count}"

        # Large limit
        query_count = 0
        repo_layer.list_for_user(user_id=u_id, page=1, limit=100)
        assert query_count == 2, f"Expected 2 queries, got {query_count}"
    finally:
        event.remove(engine, "before_cursor_execute", _counter)
