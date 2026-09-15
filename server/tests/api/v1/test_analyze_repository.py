import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timezone

from app.main import app
from app.core.config import settings
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion, IndexJob
from app.services.repository import RepositoryActiveJobError
from app.services.github import GithubAuthError
from app.core.encryption import TokenEncryptionError

pytestmark = pytest.mark.usefixtures("valid_encryption_key")

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
def mock_db(mocker):
    mock_db_session = mocker.MagicMock()
    from app.api.deps import get_db
    app.dependency_overrides[get_db] = lambda: mock_db_session
    yield mock_db_session
    app.dependency_overrides.clear()

@pytest.fixture
def mock_redis(mocker):
    mock_redis_client = AsyncMock()
    from app.api.deps import get_redis
    app.dependency_overrides[get_redis] = lambda: mock_redis_client
    yield mock_redis_client

@pytest.fixture
def mock_auth(mocker, mock_redis, mock_db):
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test User")
    mock_account = GithubAccount(github_user_id="123", username="testuser", access_token_encrypted="encrypted_tok")
    mock_user.github_accounts = [mock_account]
    
    mock_user_repo = mocker.patch("app.repositories.user.UserAccountRepository")
    mock_user_repo_instance = mock_user_repo.return_value
    mock_user_repo_instance.get_user_by_id.return_value = mock_user
    
    return mock_user

@pytest.fixture
def repo_id():
    return uuid4()

@pytest.fixture
def mock_repo(repo_id):
    return Repository(id=repo_id, owner="testowner", name="testrepo", is_private=False)

@pytest.fixture
def mock_auth_dep(mocker, mock_repo):
    mock_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_dep_instance = mock_dep.return_value
    mock_dep_instance.get_for_user.return_value = mock_repo
    return mock_dep_instance


# 1. Successful analyze request (Explicit branch)
@pytest.mark.asyncio
async def test_analyze_repository_explicit_branch(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_decrypt = mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_github = mocker.patch("app.api.v1.endpoints.repositories.GithubService")
    mock_github_instance = mock_github.return_value
    mock_github_instance.get_branch_commit = AsyncMock(return_value="commit_123")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    version = RepositoryVersion(id=uuid4(), repository_id=repo_id, commit_sha="commit_123", index_status="PENDING")
    job = IndexJob(id=uuid4(), repository_id=repo_id, repository_version_id=version.id, status="QUEUED")
    mock_repo_service_instance.queue_analysis.return_value = (version, job)
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "develop"}
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["job_id"] == str(job.id)
    assert data["repository_version_id"] == str(version.id)
    assert data["status"] == "QUEUED"
    
    mock_github_instance.get_branch_commit.assert_called_once_with(
        access_token="decrypted", owner="testowner", repo="testrepo", branch="develop"
    )
    mock_repo_service_instance.queue_analysis.assert_called_once_with(
        repository=mock_auth_dep.get_for_user.return_value, branch="develop", commit_sha="commit_123"
    )

# 2. Default branch
@pytest.mark.asyncio
async def test_analyze_repository_default_branch(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_github = mocker.patch("app.api.v1.endpoints.repositories.GithubService")
    mock_github_instance = mock_github.return_value
    mock_github_instance.get_repository = AsyncMock(return_value={"default_branch": "main"})
    mock_github_instance.get_branch_commit = AsyncMock(return_value="commit_456")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    version = RepositoryVersion(id=uuid4(), repository_id=repo_id, commit_sha="commit_456", index_status="PENDING")
    job = IndexJob(id=uuid4(), repository_id=repo_id, repository_version_id=version.id, status="QUEUED")
    mock_repo_service_instance.queue_analysis.return_value = (version, job)
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={}
    )
    
    assert response.status_code == 202
    
    mock_github_instance.get_repository.assert_called_once_with(
        access_token="decrypted", owner="testowner", repo="testrepo"
    )
    mock_github_instance.get_branch_commit.assert_called_once_with(
        access_token="decrypted", owner="testowner", repo="testrepo", branch="main"
    )
    mock_repo_service_instance.queue_analysis.assert_called_once_with(
        repository=mock_auth_dep.get_for_user.return_value, branch="main", commit_sha="commit_456"
    )

# 3. Active job
@pytest.mark.asyncio
async def test_analyze_repository_active_job(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_github = mocker.patch("app.api.v1.endpoints.repositories.GithubService")
    mock_github_instance = mock_github.return_value
    mock_github_instance.get_branch_commit = AsyncMock(return_value="commit_123")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    mock_repo_service_instance.queue_analysis.side_effect = RepositoryActiveJobError("In progress")
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "main"}
    )
    
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INDEXING_ALREADY_IN_PROGRESS"

# 4. Unauthorized/nonexistent repository
@pytest.mark.asyncio
async def test_analyze_repository_not_found(async_client, mock_auth, mock_db, mocker, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "main"}
    )
    
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

# 5. GitHub branch not found
@pytest.mark.asyncio
async def test_analyze_repository_branch_not_found(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_github = mocker.patch("app.api.v1.endpoints.repositories.GithubService")
    mock_github_instance = mock_github.return_value
    mock_github_instance.get_branch_commit = AsyncMock(side_effect=GithubAuthError("Not found"))
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "invalid_branch"}
    )
    
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "GITHUB_API_ERROR"

# 6. Missing GitHub token
@pytest.mark.asyncio
async def test_analyze_repository_missing_github(async_client, mock_redis, mock_db, mocker, repo_id):
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test User")
    mock_user.github_accounts = []
    
    mock_user_repo = mocker.patch("app.repositories.user.UserAccountRepository")
    mock_user_repo_instance = mock_user_repo.return_value
    mock_user_repo_instance.get_user_by_id.return_value = mock_user

    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = Repository(id=repo_id)

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "main"}
    )
    
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

# 7. Token decryption failure
@pytest.mark.asyncio
async def test_analyze_repository_decryption_failure(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", side_effect=TokenEncryptionError("Failed"))
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/analyze",
        json={"branch": "main"}
    )
    
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
