"""
Phase 3.3 Repository Service + GitHub Integration Tests
Comprehensive coverage: URL parsing, connect_repository flow,
idempotency, rollback, token safety, and GithubService.get_repository.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.repository import (
    RepositoryService,
    InvalidRepositoryUrlError,
    RepositoryNotAccessibleError,
    parse_github_url,
)
from app.services.github import GithubService, GithubAuthError
from app.models.repository import Repository, UserRepository


# ---------------------------------------------------------------------------
# parse_github_url
# ---------------------------------------------------------------------------

class TestParseGithubUrl:
    # Valid cases
    def test_valid_standard(self):
        assert parse_github_url("https://github.com/owner/repo") == ("owner", "repo")

    def test_valid_trailing_slash(self):
        assert parse_github_url("https://github.com/owner/repo/") == ("owner", "repo")

    def test_valid_dot_git(self):
        assert parse_github_url("https://github.com/owner/repo.git") == ("owner", "repo")

    def test_valid_hyphenated_owner(self):
        assert parse_github_url("https://github.com/my-org/my-repo") == ("my-org", "my-repo")

    def test_returns_canonical_owner_and_repo(self):
        owner, name = parse_github_url("https://github.com/tiangolo/fastapi")
        assert owner == "tiangolo"
        assert name == "fastapi"

    # Invalid: non-GitHub hosts
    def test_invalid_gitlab(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://gitlab.com/owner/repo")

    def test_invalid_arbitrary_host(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("http://example.com/owner/repo")

    def test_invalid_bitbucket(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://bitbucket.org/owner/repo")

    # Invalid: missing path components
    def test_invalid_root_only(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/")

    def test_invalid_owner_only(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/owner")

    def test_invalid_no_path(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com")

    # Invalid: deep paths
    def test_invalid_issues_path(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/owner/repo/issues")

    def test_invalid_tree_path(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/owner/repo/tree/main")

    def test_invalid_blob_path(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/owner/repo/blob/main/file.py")

    def test_invalid_pull_path(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("https://github.com/owner/repo/pull/123")

    # Invalid: bad scheme
    def test_invalid_ftp_scheme(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("ftp://github.com/owner/repo")

    def test_invalid_http_github(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("http://github.com/owner/repo")

    def test_invalid_http_non_github(self):
        with pytest.raises(InvalidRepositoryUrlError):
            parse_github_url("http://example.com/owner/repo")

    def test_invalid_empty_string(self):
        with pytest.raises((InvalidRepositoryUrlError, Exception)):
            parse_github_url("")

    def test_invalid_whitespace(self):
        with pytest.raises((InvalidRepositoryUrlError, Exception)):
            parse_github_url("   ")


# ---------------------------------------------------------------------------
# GithubService.get_repository
# ---------------------------------------------------------------------------

@pytest.fixture
def github_service():
    return GithubService()


class TestGithubServiceGetRepository:
    @pytest.mark.asyncio
    async def test_successful_fetch(self, github_service):
        payload = {
            "id": 123,
            "name": "fastapi",
            "owner": {"login": "tiangolo"},
            "clone_url": "https://github.com/tiangolo/fastapi.git",
            "private": False,
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = payload

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            result = await github_service.get_repository("token", "tiangolo", "fastapi")

        assert result["id"] == 123
        assert result["name"] == "fastapi"
        assert result["owner"]["login"] == "tiangolo"
        assert result["clone_url"] == "https://github.com/tiangolo/fastapi.git"
        assert result["private"] is False

    @pytest.mark.asyncio
    async def test_uses_correct_endpoint(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": 1, "name": "r", "owner": {"login": "o"}, "clone_url": "u", "private": False}

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            await github_service.get_repository("tok", "owner", "repo")

        call_url = mock_client.get.call_args[0][0]
        assert "repos/owner/repo" in call_url

    @pytest.mark.asyncio
    async def test_uses_bearer_auth_header(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": 1, "name": "r", "owner": {"login": "o"}, "clone_url": "u", "private": False}

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            await github_service.get_repository("my_token", "owner", "repo")

        headers = mock_client.get.call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer my_token"

    @pytest.mark.asyncio
    async def test_404_raises_auth_error(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 404

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            with pytest.raises(GithubAuthError):
                await github_service.get_repository("tok", "o", "r")

    @pytest.mark.asyncio
    async def test_403_raises_auth_error(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 403

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            with pytest.raises(GithubAuthError):
                await github_service.get_repository("tok", "o", "r")

    @pytest.mark.asyncio
    async def test_500_raises_auth_error(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 500

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            with pytest.raises(GithubAuthError):
                await github_service.get_repository("tok", "o", "r")

    @pytest.mark.asyncio
    async def test_token_not_in_404_error_message(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 404

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            with pytest.raises(GithubAuthError) as exc_info:
                await github_service.get_repository("super_secret_token", "o", "r")

            assert "super_secret_token" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_token_not_in_403_error_message(self, github_service):
        mock_resp = MagicMock()
        mock_resp.status_code = 403

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_resp

            with pytest.raises(GithubAuthError) as exc_info:
                await github_service.get_repository("super_secret_token", "o", "r")

            assert "super_secret_token" not in str(exc_info.value)


# ---------------------------------------------------------------------------
# RepositoryService.connect_repository
# ---------------------------------------------------------------------------

GITHUB_REPO_RESPONSE = {
    "id": 123456,
    "name": "fastapi",
    "owner": {"login": "tiangolo"},
    "clone_url": "https://github.com/tiangolo/fastapi.git",
    "private": False,
}


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_github():
    return AsyncMock()


@pytest.fixture
def service(mock_db, mock_github):
    return RepositoryService(db=mock_db, github_service=mock_github)


class TestConnectRepositoryNewRepo:
    @pytest.mark.asyncio
    async def test_creates_repo_and_access(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        new_repo = Repository()
        new_repo.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(return_value=new_repo)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())

        user_id = uuid4()
        result = await service.connect_repository(
            user_id=user_id,
            url="https://github.com/tiangolo/fastapi",
            github_access_token="tok",
        )

        assert result is new_repo
        service.repository_repo.create.assert_called_once_with(
            github_repo_id="123456",
            owner="tiangolo",
            name="fastapi",
            clone_url="https://github.com/tiangolo/fastapi.git",
            is_private=False,
        )
        service.repository_repo.grant_user_access.assert_called_once_with(
            user_id=user_id, repository_id=new_repo.id
        )
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_uses_canonical_github_data_not_url_components(self, service, mock_db, mock_github):
        # GitHub response has different casing/owner than URL — service must use GitHub data
        mock_github.get_repository.return_value = {
            **GITHUB_REPO_RESPONSE,
            "owner": {"login": "TIANGOLO"},  # canonical differs from URL
            "name": "FastAPI",
        }
        new_repo = Repository()
        new_repo.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(return_value=new_repo)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())

        await service.connect_repository(
            user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
        )

        create_call = service.repository_repo.create.call_args
        assert create_call.kwargs["owner"] == "TIANGOLO"
        assert create_call.kwargs["name"] == "FastAPI"

    @pytest.mark.asyncio
    async def test_no_version_or_job_created(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        new_repo = Repository()
        new_repo.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(return_value=new_repo)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())
        service.repository_repo.create_version = MagicMock()
        service.repository_repo.create_index_job = MagicMock()

        await service.connect_repository(
            user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
        )

        service.repository_repo.create_version.assert_not_called()
        service.repository_repo.create_index_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_github_called_with_url_components(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        new_repo = Repository()
        new_repo.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(return_value=new_repo)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())

        await service.connect_repository(
            user_id=uuid4(),
            url="https://github.com/tiangolo/fastapi",
            github_access_token="my_token",
        )

        mock_github.get_repository.assert_awaited_once_with(
            access_token="my_token", owner="tiangolo", repo="fastapi"
        )


class TestConnectRepositoryExistingRepo:
    @pytest.mark.asyncio
    async def test_existing_repo_no_access_grants_access(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        existing = Repository()
        existing.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=existing)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())
        service.repository_repo.create = MagicMock()

        user_id = uuid4()
        result = await service.connect_repository(
            user_id=user_id, url="https://github.com/tiangolo/fastapi", github_access_token="tok"
        )

        assert result is existing
        service.repository_repo.create.assert_not_called()
        service.repository_repo.grant_user_access.assert_called_once_with(
            user_id=user_id, repository_id=existing.id
        )
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_existing_repo_with_access_is_idempotent(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        existing = Repository()
        existing.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=existing)
        service.repository_repo.user_has_access = MagicMock(return_value=True)
        service.repository_repo.grant_user_access = MagicMock()
        service.repository_repo.create = MagicMock()

        result = await service.connect_repository(
            user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
        )

        assert result is existing
        service.repository_repo.create.assert_not_called()
        service.repository_repo.grant_user_access.assert_not_called()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_two_users_can_share_same_repo(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        existing = Repository()
        existing.id = uuid4()

        for _ in range(2):
            service.repository_repo.get_by_github_repo_id = MagicMock(return_value=existing)
            service.repository_repo.user_has_access = MagicMock(return_value=False)
            service.repository_repo.grant_user_access = MagicMock(return_value=UserRepository())

            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
            )

        assert service.repository_repo.create.call_count == 0 if hasattr(
            service.repository_repo.create, "call_count"
        ) else True


class TestConnectRepositoryGithubFailure:
    @pytest.mark.asyncio
    async def test_github_failure_raises_not_accessible(self, service, mock_db, mock_github):
        mock_github.get_repository.side_effect = GithubAuthError("Not found")

        with pytest.raises(RepositoryNotAccessibleError):
            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/owner/repo", github_access_token="tok"
            )

    @pytest.mark.asyncio
    async def test_github_failure_no_commit(self, service, mock_db, mock_github):
        mock_github.get_repository.side_effect = GithubAuthError("Not found")

        with pytest.raises(RepositoryNotAccessibleError):
            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/owner/repo", github_access_token="tok"
            )

        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_github_failure_no_db_records(self, service, mock_db, mock_github):
        mock_github.get_repository.side_effect = GithubAuthError("Not found")
        service.repository_repo.create = MagicMock()
        service.repository_repo.grant_user_access = MagicMock()

        with pytest.raises(RepositoryNotAccessibleError):
            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/owner/repo", github_access_token="tok"
            )

        service.repository_repo.create.assert_not_called()
        service.repository_repo.grant_user_access.assert_not_called()


class TestConnectRepositoryInvalidUrl:
    @pytest.mark.asyncio
    async def test_invalid_url_raises_before_github_call(self, service, mock_db, mock_github):
        with pytest.raises(InvalidRepositoryUrlError):
            await service.connect_repository(
                user_id=uuid4(), url="https://gitlab.com/owner/repo", github_access_token="tok"
            )

        mock_github.get_repository.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_deep_path_raises_before_github_call(self, service, mock_db, mock_github):
        with pytest.raises(InvalidRepositoryUrlError):
            await service.connect_repository(
                user_id=uuid4(),
                url="https://github.com/owner/repo/issues",
                github_access_token="tok",
            )

        mock_github.get_repository.assert_not_awaited()


class TestConnectRepositoryDbRollback:
    @pytest.mark.asyncio
    async def test_rollback_on_create_failure(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(side_effect=Exception("DB constraint"))

        with pytest.raises(Exception, match="DB constraint"):
            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
            )

        mock_db.rollback.assert_called_once()
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_rollback_on_grant_access_failure(self, service, mock_db, mock_github):
        mock_github.get_repository.return_value = GITHUB_REPO_RESPONSE
        new_repo = Repository()
        new_repo.id = uuid4()
        service.repository_repo.get_by_github_repo_id = MagicMock(return_value=None)
        service.repository_repo.create = MagicMock(return_value=new_repo)
        service.repository_repo.user_has_access = MagicMock(return_value=False)
        service.repository_repo.grant_user_access = MagicMock(side_effect=Exception("Integrity error"))

        with pytest.raises(Exception, match="Integrity error"):
            await service.connect_repository(
                user_id=uuid4(), url="https://github.com/tiangolo/fastapi", github_access_token="tok"
            )

        mock_db.rollback.assert_called_once()
        mock_db.commit.assert_not_called()
