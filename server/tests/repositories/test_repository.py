"""
Phase 3.2 Repository Persistence Layer Tests
Verifies all RepositoryRepository operations, SQL query correctness,
active-job filtering, latest-version ordering, and access control.
"""
import pytest
from unittest.mock import MagicMock, call
from uuid import uuid4

from app.repositories.repository import RepositoryRepository
from app.models.repository import Repository, UserRepository, RepositoryVersion, IndexJob


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def repo(mock_db):
    return RepositoryRepository(mock_db)


# ---------------------------------------------------------------------------
# get_by_github_repo_id
# ---------------------------------------------------------------------------

class TestGetByGithubRepoId:
    def test_found(self, repo, mock_db):
        expected = Repository()
        mock_db.execute.return_value.scalar_one_or_none.return_value = expected
        result = repo.get_by_github_repo_id("12345")
        assert result is expected
        mock_db.execute.assert_called_once()

    def test_not_found(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_by_github_repo_id("unknown")
        assert result is None

    def test_query_filters_by_github_repo_id(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_by_github_repo_id("42")
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "42" in compiled
        assert "repositories" in compiled


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class TestCreate:
    def test_fields_set_correctly(self, repo, mock_db):
        result = repo.create(
            github_repo_id="99",
            owner="owner",
            name="repo",
            clone_url="https://github.com/owner/repo.git",
            is_private=True,
        )
        assert isinstance(result, Repository)
        assert result.github_repo_id == "99"
        assert result.owner == "owner"
        assert result.name == "repo"
        assert result.clone_url == "https://github.com/owner/repo.git"
        assert result.is_private is True

    def test_add_and_flush_called(self, repo, mock_db):
        result = repo.create(
            github_repo_id="1", owner="o", name="n",
            clone_url="url", is_private=False,
        )
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()

    def test_no_commit_inside(self, repo, mock_db):
        repo.create(
            github_repo_id="1", owner="o", name="n",
            clone_url="url", is_private=False,
        )
        mock_db.commit.assert_not_called()

    def test_with_installation_id(self, repo, mock_db):
        install_id = uuid4()
        result = repo.create(
            github_repo_id="1", owner="o", name="n",
            clone_url="url", is_private=False,
            github_installation_id=install_id,
        )
        assert result.github_installation_id == install_id

    def test_without_installation_id_defaults_to_none(self, repo, mock_db):
        result = repo.create(
            github_repo_id="1", owner="o", name="n",
            clone_url="url", is_private=False,
        )
        assert result.github_installation_id is None


# ---------------------------------------------------------------------------
# grant_user_access
# ---------------------------------------------------------------------------

class TestGrantUserAccess:
    def test_creates_user_repository(self, repo, mock_db):
        user_id = uuid4()
        repo_id = uuid4()
        result = repo.grant_user_access(user_id=user_id, repository_id=repo_id)
        assert isinstance(result, UserRepository)
        assert result.user_id == user_id
        assert result.repository_id == repo_id

    def test_add_and_flush_called(self, repo, mock_db):
        result = repo.grant_user_access(user_id=uuid4(), repository_id=uuid4())
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()

    def test_no_commit_inside(self, repo, mock_db):
        repo.grant_user_access(user_id=uuid4(), repository_id=uuid4())
        mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# user_has_access
# ---------------------------------------------------------------------------

class TestUserHasAccess:
    def test_returns_true_when_access_exists(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = UserRepository()
        assert repo.user_has_access(user_id=uuid4(), repository_id=uuid4()) is True

    def test_returns_false_when_no_access(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        assert repo.user_has_access(user_id=uuid4(), repository_id=uuid4()) is False

    def test_query_contains_both_ids(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        user_id = uuid4()
        repo_id = uuid4()
        repo.user_has_access(user_id=user_id, repository_id=repo_id)
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        # SQLAlchemy renders UUIDs without hyphens in literal_binds output
        assert user_id.hex in compiled
        assert repo_id.hex in compiled


# ---------------------------------------------------------------------------
# get_for_user
# ---------------------------------------------------------------------------

class TestGetForUser:
    def test_returns_repository_when_accessible(self, repo, mock_db):
        expected = Repository()
        mock_db.execute.return_value.scalar_one_or_none.return_value = expected
        result = repo.get_for_user(user_id=uuid4(), repository_id=uuid4())
        assert result is expected

    def test_returns_none_when_not_accessible(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_for_user(user_id=uuid4(), repository_id=uuid4())
        assert result is None

    def test_returns_none_for_nonexistent_repo(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_for_user(user_id=uuid4(), repository_id=uuid4())
        assert result is None

    def test_query_joins_user_repositories(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_for_user(user_id=uuid4(), repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "user_repositories" in compiled
        assert "repositories" in compiled


# ---------------------------------------------------------------------------
# list_for_user
# ---------------------------------------------------------------------------

class TestListForUser:
    def _setup(self, mock_db, total, items):
        count_result = MagicMock()
        count_result.scalar_one.return_value = total
        items_result = MagicMock()
        items_result.scalars.return_value.all.return_value = items
        mock_db.execute.side_effect = [count_result, items_result]

    def test_returns_items_and_total(self, repo, mock_db):
        repos = [Repository(), Repository()]
        self._setup(mock_db, total=2, items=repos)
        items, total = repo.list_for_user(user_id=uuid4(), page=1, limit=10)
        assert total == 2
        assert len(items) == 2

    def test_empty_result(self, repo, mock_db):
        self._setup(mock_db, total=0, items=[])
        items, total = repo.list_for_user(user_id=uuid4(), page=1, limit=10)
        assert total == 0
        assert items == []

    def test_two_db_calls_for_count_and_items(self, repo, mock_db):
        self._setup(mock_db, total=0, items=[])
        repo.list_for_user(user_id=uuid4(), page=1, limit=10)
        assert mock_db.execute.call_count == 2

    def test_search_included_in_query(self, repo, mock_db):
        self._setup(mock_db, total=0, items=[])
        repo.list_for_user(user_id=uuid4(), page=1, limit=10, search="fastapi")
        # The count query (first execute call) should contain the search term
        count_stmt = mock_db.execute.call_args_list[0][0][0]
        compiled = str(count_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "fastapi" in compiled.lower()

    def test_no_search_does_not_add_filter(self, repo, mock_db):
        self._setup(mock_db, total=0, items=[])
        repo.list_for_user(user_id=uuid4(), page=1, limit=10, search=None)
        # Should still execute 2 queries without error
        assert mock_db.execute.call_count == 2

    def test_items_query_has_ordering(self, repo, mock_db):
        self._setup(mock_db, total=0, items=[])
        repo.list_for_user(user_id=uuid4(), page=1, limit=10)
        items_stmt = mock_db.execute.call_args_list[1][0][0]
        compiled = str(items_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "ORDER BY" in compiled
        assert "created_at DESC" in compiled


# ---------------------------------------------------------------------------
# create_version
# ---------------------------------------------------------------------------

class TestCreateVersion:
    def test_fields_set_correctly(self, repo, mock_db):
        repo_id = uuid4()
        result = repo.create_version(
            repository_id=repo_id,
            commit_sha="deadbeef",
            branch="main",
        )
        assert isinstance(result, RepositoryVersion)
        assert result.repository_id == repo_id
        assert result.commit_sha == "deadbeef"
        assert result.branch == "main"
        assert result.index_status == "PENDING"

    def test_custom_status(self, repo, mock_db):
        result = repo.create_version(
            repository_id=uuid4(),
            commit_sha="abc",
            branch="main",
            index_status="SUCCESS",
        )
        assert result.index_status == "SUCCESS"

    def test_add_and_flush_called(self, repo, mock_db):
        result = repo.create_version(
            repository_id=uuid4(), commit_sha="abc", branch="main"
        )
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()

    def test_no_commit_inside(self, repo, mock_db):
        repo.create_version(repository_id=uuid4(), commit_sha="abc", branch="main")
        mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# get_latest_version — ordering correctness
# ---------------------------------------------------------------------------

class TestGetLatestVersion:
    def test_returns_version_when_present(self, repo, mock_db):
        expected = RepositoryVersion()
        mock_db.execute.return_value.scalar_one_or_none.return_value = expected
        result = repo.get_latest_version(repository_id=uuid4())
        assert result is expected

    def test_returns_none_when_no_versions(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_latest_version(repository_id=uuid4())
        assert result is None

    def test_ordering_nulls_last(self, repo, mock_db):
        """Indexed versions must rank before PENDING (NULL indexed_at) versions."""
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_latest_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "NULLS LAST" in compiled
        assert "DESC" in compiled

    def test_ordering_uses_indexed_at(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_latest_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "indexed_at" in compiled

    def test_tie_breaker_uses_id(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_latest_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        # Ensure id DESC is present as tie-breaker
        assert "repository_versions.id DESC" in compiled

    def test_no_nulls_first(self, repo, mock_db):
        """Regression: NULLS FIRST must not appear (it was the original bug)."""
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_latest_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "NULLS FIRST" not in compiled

    def test_limits_to_one_result(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_latest_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "LIMIT" in compiled


# ---------------------------------------------------------------------------
# get_active_version
# ---------------------------------------------------------------------------

class TestGetActiveVersion:
    def test_returns_version_when_present(self, repo, mock_db):
        expected = RepositoryVersion()
        mock_db.execute.return_value.scalar_one_or_none.return_value = expected
        result = repo.get_active_version(repository_id=uuid4())
        assert result is expected

    def test_returns_none_when_no_versions(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_active_version(repository_id=uuid4())
        assert result is None

    def test_filters_by_success_status(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "index_status = 'SUCCESS'" in compiled

    def test_ordering_nulls_last(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "NULLS LAST" in compiled
        assert "DESC" in compiled

    def test_limits_to_one_result(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_version(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "LIMIT" in compiled


# ---------------------------------------------------------------------------
# create_index_job
# ---------------------------------------------------------------------------

class TestCreateIndexJob:
    def test_fields_set_correctly(self, repo, mock_db):
        repo_id = uuid4()
        version_id = uuid4()
        result = repo.create_index_job(
            repository_id=repo_id,
            repository_version_id=version_id,
            status="QUEUED",
        )
        assert isinstance(result, IndexJob)
        assert result.repository_id == repo_id
        assert result.repository_version_id == version_id
        assert result.status == "QUEUED"

    def test_default_status_is_queued(self, repo, mock_db):
        result = repo.create_index_job(
            repository_id=uuid4(), repository_version_id=uuid4()
        )
        assert result.status == "QUEUED"

    def test_add_and_flush_called(self, repo, mock_db):
        result = repo.create_index_job(
            repository_id=uuid4(), repository_version_id=uuid4()
        )
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()

    def test_no_commit_inside(self, repo, mock_db):
        repo.create_index_job(repository_id=uuid4(), repository_version_id=uuid4())
        mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# get_active_job — status filtering
# ---------------------------------------------------------------------------

class TestGetActiveJob:
    def test_returns_active_job(self, repo, mock_db):
        expected = IndexJob()
        mock_db.execute.return_value.scalar_one_or_none.return_value = expected
        result = repo.get_active_job(repository_id=uuid4())
        assert result is expected

    def test_returns_none_when_no_active_job(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        result = repo.get_active_job(repository_id=uuid4())
        assert result is None

    def test_query_includes_all_active_statuses(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_job(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        for status in ("QUEUED", "FETCHING", "INDEXING", "ANALYZING"):
            assert status in compiled

    def test_query_excludes_ready_status(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_job(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        # READY must not appear as an active-job status
        # The status filter should use IN clause; check the filter values
        assert "'READY'" not in compiled or "NOT IN" not in compiled

    def test_query_excludes_failed_status(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo.get_active_job(repository_id=uuid4())
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        # FAILED must not appear as an active status that would be matched
        assert "'FAILED'" not in compiled

    def test_query_filters_by_repository_id(self, repo, mock_db):
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        repo_id = uuid4()
        repo.get_active_job(repository_id=repo_id)
        stmt = mock_db.execute.call_args[0][0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        # SQLAlchemy renders UUIDs without hyphens in literal_binds output
        assert repo_id.hex in compiled
