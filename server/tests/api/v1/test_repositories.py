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
    version = RepositoryVersion(id=uuid4(), repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main")
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

# Versions Tests
@pytest.mark.asyncio
async def test_get_repository_versions_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version1 = RepositoryVersion(id=uuid4(), repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    version2 = RepositoryVersion(id=uuid4(), repository_id=UUID(repo_id), commit_sha="def", index_status="PENDING", branch="main", indexed_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_versions_for_repository.return_value = [version1, version2]
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["commit_sha"] == "abc"
    assert data[0]["branch"] == "main"
    assert data[0]["status"] == "SUCCESS"
    assert data[1]["commit_sha"] == "def"
    
@pytest.mark.asyncio
async def test_get_repository_versions_empty(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_versions_for_repository.return_value = []
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions")
    assert response.status_code == 200
    data = response.json()
    assert data == []

@pytest.mark.asyncio
async def test_get_repository_versions_not_found_or_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"


# Active Version Tests
@pytest.mark.asyncio
async def test_get_active_repository_version_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version = RepositoryVersion(id=uuid4(), repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions/active")
    assert response.status_code == 200
    data = response.json()
    assert data["commit_sha"] == "abc"
@pytest.mark.asyncio
async def test_get_repository_overview_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    from app.models.knowledge import AnalysisResult
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    
    analysis = AnalysisResult(
        repository_version_id=version_id,
        analysis_type="OVERVIEW",
        payload={"total_files": 10, "repository_id": repo_id, "branch": "main", "commit_sha": "abc"}
    )
    mock_knowledge_repo_instance.get_analysis_result.return_value = analysis
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "OVERVIEW"
    assert data["payload"]["total_files"] == 10

@pytest.mark.asyncio
async def test_get_repository_overview_no_active_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/overview")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert response.json()["error"]["message"] == "No active version found for this repository."

@pytest.mark.asyncio
async def test_get_repository_overview_missing_analysis(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    mock_knowledge_repo_instance.get_analysis_result.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/overview")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ANALYSIS_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_overview_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    # Do NOT patch mock_auth_dep, forcing RepositoryRepository.get_for_user to return None
    mock_repo_repo = mocker.patch("app.api.deps.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/overview")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_active_repository_version_not_found(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions/active")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "No active version found for this repository."

@pytest.mark.asyncio
async def test_get_active_repository_version_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/versions/active")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_technology_stack_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    from app.models.knowledge import AnalysisResult
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    
    analysis = AnalysisResult(
        repository_version_id=version_id,
        analysis_type="TECH_STACK",
        payload={"languages": ["python"], "frameworks": [{"name": "FastAPI"}], "libraries": [], "tools": []}
    )
    mock_knowledge_repo_instance.get_analysis_result.return_value = analysis
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/technology-stack")
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "TECH_STACK"
    assert data["payload"]["frameworks"][0]["name"] == "FastAPI"

@pytest.mark.asyncio
async def test_get_repository_technology_stack_no_active_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/technology-stack")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "No active version found for this repository."

@pytest.mark.asyncio
async def test_get_repository_technology_stack_missing_analysis(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    repo = Repository(id=UUID(repo_id), owner="owner", name="repo", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    mock_knowledge_repo_instance.get_analysis_result.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/technology-stack")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ANALYSIS_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_technology_stack_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    # Do NOT patch mock_auth_dep, forcing RepositoryRepository.get_for_user to return None
    mock_repo_repo = mocker.patch("app.api.deps.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/technology-stack")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_architecture_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    from app.models.knowledge import AnalysisResult
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    analysis_result = AnalysisResult(repository_version_id=version_id, analysis_type="ARCHITECTURE", payload={"nodes": [], "relationships": []})
    mock_knowledge_repo_instance.get_analysis_result.return_value = analysis_result
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/architecture")
    assert response.status_code == 200
    assert response.json()["payload"]["nodes"] == []

@pytest.mark.asyncio
async def test_get_repository_architecture_no_active_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/architecture")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_architecture_missing_analysis(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    mock_knowledge_repo_instance.get_analysis_result.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/architecture")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ANALYSIS_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_architecture_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    mock_repo_repo = mocker.patch("app.api.deps.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/architecture")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_files_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    from app.models.knowledge import File
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    
    file_id = uuid4()
    mock_file = File(id=file_id, repository_version_id=version_id, file_path="src/main.py", file_name="main.py", language="python", size_bytes=1024, hash="abcdef")
    mock_knowledge_repo_instance.get_files_for_version.return_value = [mock_file]
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files")
    assert response.status_code == 200
    
    data = response.json()
    assert "files" in data
    assert len(data["files"]) == 1
    
    f = data["files"][0]
    assert f["id"] == str(file_id)
    assert f["path"] == "src/main.py"
    assert f["language"] == "python"
    assert f["size"] == 1024
    assert f["sha256"] == "abcdef"

@pytest.mark.asyncio
async def test_get_repository_files_no_active_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_files_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    
    mock_repo_repo = mocker.patch("app.api.deps.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_file_content_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    file_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    from app.models.knowledge import File
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    
    mock_file = File(id=UUID(file_id), repository_version_id=version_id, file_path="src/main.py", file_name="main.py", language="python", size_bytes=1024, hash="abcdef")
    mock_knowledge_repo_instance.get_file_content_for_version.return_value = (mock_file, "print('hello world')")
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files/{file_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == file_id
    assert data["path"] == "src/main.py"
    assert data["content"] == "print('hello world')"
    assert data["size"] == 1024

@pytest.mark.asyncio
async def test_get_repository_file_content_no_active_version(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    file_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_active_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files/{file_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_file_content_missing_file(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    file_id = str(uuid4())
    
    from app.models.repository import Repository
    repo = Repository(id=UUID(repo_id), name="test-repo", clone_url="https://github.com/test/test", is_private=False)
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = repo
    
    from datetime import datetime, timezone
    from app.models.repository import RepositoryVersion
    
    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    
    version_id = uuid4()
    version = RepositoryVersion(id=version_id, repository_id=UUID(repo_id), commit_sha="abc", index_status="SUCCESS", branch="main", indexed_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    mock_repo_repo_instance.get_active_version.return_value = version
    
    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo_instance = mock_knowledge_repo.return_value
    mock_knowledge_repo_instance.get_file_content_for_version.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files/{file_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "FILE_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_repository_file_content_unauthorized(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = str(uuid4())
    file_id = str(uuid4())
    
    mock_repo_repo = mocker.patch("app.api.deps.RepositoryRepository")
    mock_repo_repo_instance = mock_repo_repo.return_value
    mock_repo_repo_instance.get_for_user.return_value = None
    
    response = await async_client.get(f"{settings.API_V1_STR}/repositories/{repo_id}/files/{file_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"
