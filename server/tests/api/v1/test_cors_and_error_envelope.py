import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.main import app
from app.core.config import settings
from app.api.deps import get_current_user, get_authorized_repository, get_db, get_redis
from app.models.user import User, GithubAccount
from app.models.repository import Repository
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test"
    ) as ac:
        yield ac

@pytest.fixture(autouse=True)
def cleanup_overrides():
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_cors_expose_headers(async_client):
    """(b) A CORS request with an Origin header receives Access-Control-Expose-Headers containing X-Request-ID and Retry-After."""
    origin = "http://localhost:3000"
    
    response = await async_client.get(
        "/health",
        headers={"Origin": origin}
    )
    assert response.status_code == 200
    expose_headers = response.headers.get("access-control-expose-headers", "")
    assert expose_headers != ""
    headers_list = [h.strip().lower() for h in expose_headers.split(",")]
    assert "x-request-id" in headers_list
    assert "retry-after" in headers_list

@pytest.mark.asyncio
async def test_error_envelope_includes_request_id(async_client):
    """(c) Error envelopes produced by exception handlers include request_id."""
    custom_request_id = "test-request-id-envelope-999"
    response = await async_client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"X-Request-ID": custom_request_id}
    )
    # AuthException handler triggered (401 UNAUTHENTICATED)
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNAUTHENTICATED"
    assert data["error"]["request_id"] == custom_request_id
    assert response.headers.get("x-request-id") == custom_request_id

@pytest.mark.asyncio
async def test_global_exception_handler_request_id_and_no_secret_leak(async_client):
    """(c & d) 500 handler includes request_id and does not leak secrets placed in exception message."""
    fake_secret = "SUPER_SECRET_DATABASE_PASSWORD_XYZ123"
    
    def raise_with_secret():
        raise RuntimeError(f"Database error with credentials: {fake_secret}")
    
    app.dependency_overrides[get_current_user] = raise_with_secret
    
    custom_request_id = "test-secret-leak-req-id"
    response = await async_client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"X-Request-ID": custom_request_id}
    )
    assert response.status_code == 500
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert data["error"]["message"] == "An unexpected error occurred."
    assert data["error"]["request_id"] == custom_request_id
    
    # Assert secret is NOT in response body
    assert fake_secret not in response.text

@pytest.mark.asyncio
async def test_repository_endpoint_no_secret_leak_on_permanent_llm_error(async_client, mocker):
    """(d) No response body contains a fake secret placed in a PermanentLLMError message."""
    fake_secret = "AI_API_KEY_LEAK_TEST_SECRET_67890"
    
    user_id = uuid4()
    mock_user = User(id=user_id, email="test@example.com", full_name="Test User")
    mock_user.github_accounts = [GithubAccount(github_user_id="123", username="testuser")]
    
    repo_id = uuid4()
    mock_repo = MagicMock(spec=Repository)
    mock_repo.id = repo_id
    mock_repo.owner = "test-owner"
    mock_repo.name = "test-repo"
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo
    
    mock_execute = AsyncMock(side_effect=PermanentLLMError(f"OpenRouter auth failed: key={fake_secret}"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService.execute", mock_execute)
    
    # Mock redis for rate limiter
    mock_redis_client = AsyncMock()
    mock_redis_client.eval.return_value = [0, 60]
    app.dependency_overrides[get_redis] = lambda: mock_redis_client
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "Explain the architecture"}
    )
    
    assert response.status_code == 502
    data = response.json()
    assert data["error"]["code"] == "UPSTREAM_SERVICE_ERROR"
    assert data["error"]["message"] == "AI service encountered an error processing the request."
    
    # Crucial security check: fake secret must NOT be leaked
    assert fake_secret not in response.text

@pytest.mark.asyncio
async def test_repository_endpoint_no_secret_leak_on_transient_llm_error(async_client, mocker):
    """(d) No response body contains a fake secret placed in a TransientLLMError message."""
    fake_secret = "AI_TEMP_UNAVAILABLE_CREDENTIALS_112233"
    
    user_id = uuid4()
    mock_user = User(id=user_id, email="test@example.com", full_name="Test User")
    mock_user.github_accounts = [GithubAccount(github_user_id="123", username="testuser")]
    
    repo_id = uuid4()
    mock_repo = MagicMock(spec=Repository)
    mock_repo.id = repo_id
    mock_repo.owner = "test-owner"
    mock_repo.name = "test-repo"
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_authorized_repository] = lambda: mock_repo
    
    mock_execute = AsyncMock(side_effect=TransientLLMError(f"Rate limited upstream: token={fake_secret}"))
    mocker.patch("app.api.v1.endpoints.repositories.RAGQueryService.execute", mock_execute)
    
    mock_redis_client = AsyncMock()
    mock_redis_client.eval.return_value = [0, 60]
    app.dependency_overrides[get_redis] = lambda: mock_redis_client
    
    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/query",
        json={"query": "Explain the architecture"}
    )
    
    assert response.status_code == 502
    data = response.json()
    assert data["error"]["code"] == "UPSTREAM_SERVICE_UNAVAILABLE"
    assert data["error"]["message"] == "AI service is temporarily unavailable. Please try again later."
    
    # Crucial security check: fake secret must NOT be leaked
    assert fake_secret not in response.text
