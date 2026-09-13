import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timezone

from app.main import app
from app.core.config import settings
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion
from app.services.repository import InvalidRepositoryUrlError, RepositoryNotAccessibleError
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
    # app.dependency_overrides is cleared in mock_db

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
def mock_auth_no_github(mocker, mock_redis, mock_db):
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test User")
    mock_user.github_accounts = []
    
    mock_user_repo = mocker.patch("app.repositories.user.UserAccountRepository")
    mock_user_repo_instance = mock_user_repo.return_value
    mock_user_repo_instance.get_user_by_id.return_value = mock_user
    
    return mock_user


# List Tests
@pytest.mark.asyncio
async def test_list_repositories_authenticated(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    repo = Repository(id=uuid4(), owner="owner", name="repo", is_private=False, created_at=datetime.now(timezone.utc))
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.list_for_user.return_value = ([repo], 1)
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["owner"] == "owner"
    assert data["page"] == 1
    assert data["limit"] == 50
    assert data["has_more"] is False
    
    mock_repo_repo_instance.list_for_user.assert_called_once_with(
        user_id=mock_auth.id,
        page=1,
        limit=50,
        search=None
    )

@pytest.mark.asyncio
async def test_list_repositories_unauthenticated(async_client):
    response = await async_client.get(f"{settings.API_V1_STR}/repositories")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_list_repositories_pagination_search(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.list_for_user.return_value = ([], 100)
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories?page=2&limit=10&search=test")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["limit"] == 10
    assert data["has_more"] is True
    
    mock_repo_repo_instance.list_for_user.assert_called_once_with(
        user_id=mock_auth.id,
        page=2,
        limit=10,
        search="test"
    )

@pytest.mark.asyncio
async def test_list_repositories_invalid_limit(async_client, mock_auth):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    response = await async_client.get(f"{settings.API_V1_STR}/repositories?limit=101")
    assert response.status_code == 422
    response = await async_client.get(f"{settings.API_V1_STR}/repositories?limit=0")
    assert response.status_code == 422
    response = await async_client.get(f"{settings.API_V1_STR}/repositories?page=0")
    assert response.status_code == 422


# Connect Tests
@pytest.mark.asyncio
async def test_connect_repository_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_decrypt = mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    repo = Repository(id=uuid4(), owner="owner", name="repo", is_private=False, created_at=datetime.now(timezone.utc))
    mock_repo_service_instance.connect_repository = AsyncMock(return_value=repo)
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories",
        json={"url": "https://github.com/owner/repo"}
    )
    
    assert response.status_code == 201
    mock_decrypt.assert_called_once_with(mock_auth.github_accounts[0])
    mock_repo_service_instance.connect_repository.assert_called_once_with(
        user_id=mock_auth.id,
        url="https://github.com/owner/repo",
        github_access_token="decrypted"
    )
    
    data = response.json()
    assert data["owner"] == "owner"
    assert "clone_url" not in str(data)
    assert "decrypted" not in str(data)

@pytest.mark.asyncio
async def test_connect_repository_no_github_account(async_client, mock_auth_no_github):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories",
        json={"url": "https://github.com/owner/repo"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

@pytest.mark.asyncio
async def test_connect_repository_invalid_url(async_client, mock_auth, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    mock_repo_service_instance.connect_repository = AsyncMock(side_effect=InvalidRepositoryUrlError("Invalid URL"))
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories",
        json={"url": "ftp://github.com/owner/repo"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

@pytest.mark.asyncio
async def test_connect_repository_github_api_failure(async_client, mock_auth, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", return_value="decrypted")
    
    mock_repo_service = mocker.patch("app.api.v1.endpoints.repositories.RepositoryService")
    mock_repo_service_instance = mock_repo_service.return_value
    mock_repo_service_instance.connect_repository = AsyncMock(side_effect=RepositoryNotAccessibleError("Cannot access"))
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories",
        json={"url": "https://github.com/owner/repo"}
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "GITHUB_API_ERROR"

@pytest.mark.asyncio
async def test_connect_repository_token_decryption_failure(async_client, mock_auth, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mocker.patch("app.api.v1.endpoints.repositories.get_decrypted_token", side_effect=TokenEncryptionError("Failed"))
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories",
        json={"url": "https://github.com/owner/repo"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


# Detail Tests
@pytest.mark.asyncio
async def test_get_repository_detail_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    version = RepositoryVersion(id=uuid4(), repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS")
    mock_repo_repo_instance.get_latest_version.return_value = version
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["owner"] == "owner"
    assert data["active_version"]["status"] == "SUCCESS"
    assert data["active_version"]["commit_sha"] == "abc"

@pytest.mark.asyncio
async def test_get_repository_detail_not_found(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_detail_no_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_latest_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["active_version"] is None
