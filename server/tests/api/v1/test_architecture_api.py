"""Tests for Architecture V2 API endpoints."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from app.api.deps import get_current_user, get_db, get_redis, get_authorized_repository
from app.core.config import settings
from app.main import app
from app.models.knowledge import AnalysisResult, File
from app.models.repository import Repository, RepositoryVersion
from app.models.user import GithubAccount, User


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_db():
    mock_db_session = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db_session
    return mock_db_session


@pytest.fixture
def mock_redis():
    mock_redis_client = AsyncMock()
    mock_redis_client.eval.return_value = [0, 60]  # rate limiter allow
    app.dependency_overrides[get_redis] = lambda: mock_redis_client
    return mock_redis_client


@pytest.fixture
def mock_auth(mock_redis, mock_db):
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test User")
    mock_account = GithubAccount(
        github_user_id="123",
        username="testuser",
        access_token_encrypted="encrypted_tok",
    )
    mock_user.github_accounts = [mock_account]

    app.dependency_overrides[get_current_user] = lambda: mock_user
    return mock_user


@pytest.mark.asyncio
async def test_get_architecture_success(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()
    version_id = uuid4()

    mock_repo = Repository(
        id=repo_id,
        owner="testuser",
        name="test-repo",
        clone_url="https://github.com/testuser/test-repo",
        is_private=False,
    )
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo

    mock_version = RepositoryVersion(
        id=version_id,
        repository_id=repo_id,
        commit_sha="abcdef123456",
        branch="main",
            )

    mock_repo_repo = mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository")
    mock_repo_repo.return_value.get_active_version.return_value = mock_version

    sample_payload = {
        "schema_version": 2,
        "status": "ready",
        "system": {
            "nodes": [
                {
                    "id": "sys_service_web",
                    "name": "Service: web",
                    "kind": "service",
                    "metadata": {},
                    "source_file": "docker-compose.yml",
                    "line_number": 2,
                }
            ],
            "edges": [],
        },
        "components": [
            {
                "id": "comp_api",
                "name": "api",
                "path_prefix": "api",
                "file_count": 5,
                "language_mix": {"python": 5},
                "layer": 0,
                "summary": None,
            }
        ],
        "edges": [],
        "flows": [],
        "coverage": {
            "internal_imports_total": 10,
            "resolved": 10,
            "ratio": 1.0,
            "languages_analyzed": ["python"],
            "languages_not_analyzed": [],
        },
        "limits": {"truncated": False, "max_components": 40},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }

    mock_analysis = AnalysisResult(
        id=uuid4(),
        repository_version_id=version_id,
        analysis_type="ARCHITECTURE",
        payload=sample_payload,
    )

    mock_knowledge_repo = mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository")
    mock_knowledge_repo.return_value.get_analysis_result.return_value = mock_analysis

    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["schema_version"] == 2
    assert data["status"] == "ready"
    assert len(data["components"]) == 1
    assert data["components"][0]["id"] == "comp_api"
    assert data["coverage"]["ratio"] == 1.0


@pytest.mark.asyncio
async def test_get_architecture_unauthorized_gives_404(async_client, mock_auth, mock_db, mocker):
    """Anti-leakage check: non-owner gets 404 REPOSITORY_NOT_FOUND, never 403."""
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()

    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep.return_value.get_for_user.return_value = None  # unauthorized

    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_architecture_analysis_not_found(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()
    version_id = uuid4()

    mock_repo = Repository(id=repo_id, owner="testuser", name="test-repo", clone_url="https://github.com/t/t", is_private=False)
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo

    mock_version = RepositoryVersion(id=version_id, repository_id=repo_id, commit_sha="abc", branch="main", )
    mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository").return_value.get_active_version.return_value = mock_version

    mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository").return_value.get_analysis_result.return_value = None

    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ANALYSIS_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_component_files_pagination_and_cap(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()
    version_id = uuid4()

    mock_repo = Repository(id=repo_id, owner="testuser", name="test-repo", clone_url="https://github.com/t/t", is_private=False)
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo

    mock_version = RepositoryVersion(id=version_id, repository_id=repo_id, commit_sha="abc", branch="main", )
    mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository").return_value.get_active_version.return_value = mock_version

    sample_payload = {
        "components": [
            {"id": "comp_api", "path_prefix": "api"}
        ]
    }
    mock_analysis = AnalysisResult(id=uuid4(), repository_version_id=version_id, analysis_type="ARCHITECTURE", payload=sample_payload)
    mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository").return_value.get_analysis_result.return_value = mock_analysis

    # Mock DB files query
    mock_query = mock_db.query.return_value.filter.return_value.filter.return_value
    mock_query.count.return_value = 1
    mock_file = MagicMock()
    mock_file.file_path = "api/routes.py"
    mock_file.language = "python"
    mock_file.size_bytes = 1024
    mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_file]

    # Request with limit=250 (should be capped to 150)
    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture/components/comp_api/files?page=1&limit=250"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["component_id"] == "comp_api"
    assert data["limit"] == 150  # Hard capped at 150
    assert len(data["files"]) == 1
    assert data["files"][0]["path"] == "api/routes.py"


@pytest.mark.asyncio
async def test_get_component_files_component_not_found(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()
    version_id = uuid4()

    mock_repo = Repository(id=repo_id, owner="testuser", name="test-repo", clone_url="https://github.com/t/t", is_private=False)
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo

    mock_version = RepositoryVersion(id=version_id, repository_id=repo_id, commit_sha="abc", branch="main", )
    mocker.patch("app.api.v1.endpoints.repositories.RepositoryRepository").return_value.get_active_version.return_value = mock_version

    sample_payload = {"components": [{"id": "comp_api", "path_prefix": "api"}]}
    mock_analysis = AnalysisResult(id=uuid4(), repository_version_id=version_id, analysis_type="ARCHITECTURE", payload=sample_payload)
    mocker.patch("app.api.v1.endpoints.repositories.KnowledgeRepository").return_value.get_analysis_result.return_value = mock_analysis

    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture/components/comp_nonexistent/files"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "COMPONENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_architecture_error_envelope_and_request_id(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    repo_id = uuid4()

    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep.return_value.get_for_user.return_value = None

    custom_req_id = "test-arch-req-id-777"
    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/architecture",
        headers={"X-Request-ID": custom_req_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "REPOSITORY_NOT_FOUND"
    assert data["error"]["request_id"] == custom_req_id
    assert response.headers.get("x-request-id") == custom_req_id
