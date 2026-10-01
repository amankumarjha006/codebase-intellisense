import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.core.config import settings
from app.services.rag_query.models import RAGQueryRequest, RAGQueryResponse
from app.services.rag_query.exceptions import (
    InvalidQueryError,
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError
from app.services.citation.models import Citation

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User, GithubAccount

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
def mock_auth_dep(mocker):
    """Mocks the get_authorized_repository dependency to simulate successful authorization."""
    mock_repo = mocker.patch("app.api.v1.endpoints.repositories.get_authorized_repository")
    repo = mocker.Mock()
    repo.id = uuid4()
    repo.owner = "test-owner"
    repo.name = "test-repo"
    mock_repo.return_value = repo
    return repo

@pytest.fixture
def repo_id():
    return uuid4()

@pytest.mark.asyncio
async def test_query_repository_happy_path(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Override get_authorized_repository to use our specific repo_id
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock()
    
    # We mock RAGQueryService entirely to prevent side effects and verify API leakage
    mock_rag_service = mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService")
    mock_instance = mock_rag_service.return_value
    mock_instance.execute = mock_execute

    version_id = uuid4()
    mock_execute.return_value = RAGQueryResponse(
        answer="This is a mocked answer.",
        citations=[
            Citation(
                citation_id="C1", 
                code_chunk_id=uuid4(),
                repository_version_id=version_id,
                file_id=uuid4(),
                file_path="main.py", 
                start_line=1, 
                end_line=10,
                retrieval_score=0.99,
                retrieval_source="semantic",
                chunk_index=1
            )
        ],
        repository_version_id=version_id
    )

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={
            "query": "How does auth work?",
            "retrieval_limit": 15,
            "max_context_chars": 10000
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "This is a mocked answer."
    assert data["repository_version_id"] == str(version_id)
    assert len(data["citations"]) == 1
    assert data["citations"][0]["id"] == "C1"
    assert data["citations"][0]["file_path"] == "main.py"

    # Verify Request Mapping (No leakage)
    mock_execute.assert_called_once()
    called_request: RAGQueryRequest = mock_execute.call_args[0][0]
    assert called_request.repository_id == repo_id
    assert called_request.query == "How does auth work?"
    assert called_request.retrieval_limit == 15
    assert called_request.max_context_chars == 10000
    assert called_request.repository_version_id is None

@pytest.mark.asyncio
async def test_query_repository_unauthorized(async_client, mock_auth, mock_redis, mock_db, mocker, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "test query"}
    )
    
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_query_repository_invalid_query(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock(side_effect=InvalidQueryError("Empty query"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService").return_value.execute = mock_execute

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "   "}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

@pytest.mark.asyncio
async def test_query_repository_no_indexed_version(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock(side_effect=NoIndexedVersionError("No active version"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService").return_value.execute = mock_execute

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "test query"}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.asyncio
async def test_query_repository_invalid_version(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock(side_effect=InvalidRepositoryVersionError("Version not SUCCESS"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService").return_value.execute = mock_execute

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "test query", "repository_version_id": str(uuid4())}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

@pytest.mark.asyncio
async def test_query_repository_transient_llm_error(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock(side_effect=TransientLLMError("Rate limit exceeded"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService").return_value.execute = mock_execute

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "test query"}
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "UPSTREAM_SERVICE_UNAVAILABLE"

@pytest.mark.asyncio
async def test_query_repository_permanent_llm_error(async_client, mock_auth, mock_redis, mocker, mock_auth_dep, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    mock_auth_dep.id = repo_id

    mock_execute = AsyncMock(side_effect=PermanentLLMError("Invalid API key"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService").return_value.execute = mock_execute

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "test query"}
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "UPSTREAM_SERVICE_ERROR"
