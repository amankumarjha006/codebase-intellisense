import pytest
import pytest_asyncio

pytestmark = pytest.mark.usefixtures("valid_encryption_key")
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.main import app
from app.core.config import settings
from app.services.github import GithubAuthError
from app.models.user import User, GithubAccount, GithubInstallation

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
def mock_redis(mocker):
    # Mock redis client methods used in auth
    mock_redis_client = AsyncMock()
    # Mock the dependency
    mocker.patch("app.api.v1.endpoints.auth.get_redis", return_value=mock_redis_client)
    mocker.patch("app.api.deps.get_redis_client", return_value=mock_redis_client)
    # mock delete properly to return int
    mock_redis_client.delete.return_value = 1
    return mock_redis_client

@pytest.fixture
def mock_db(mocker):
    mock_db_session = mocker.MagicMock()
    mocker.patch("app.api.v1.endpoints.auth.get_db", return_value=mock_db_session)
    from app.api.deps import get_db
    app.dependency_overrides[get_db] = lambda: mock_db_session
    yield mock_db_session
    app.dependency_overrides.clear()

@pytest.fixture
def mock_github_service(mocker):
    mock_service = mocker.patch("app.api.v1.endpoints.auth.github_service")
    mock_service.exchange_code_for_token = AsyncMock(return_value="mock_access_token")
    mock_service.get_authenticated_user = AsyncMock(return_value={
        "github_user_id": "123456",
        "username": "testuser",
        "email": "primary_verified@example.com",
        "full_name": "Test User"
    })
    mock_service.verify_user_installation = AsyncMock(return_value={"id": 999, "target_type": "Organization"})
    mock_service.get_authorization_url.return_value = "https://github.com/login/oauth/authorize?state=mocked_state"
    return mock_service

# --- OAuth State Tests ---

@pytest.mark.asyncio
async def test_login_github_redirects_and_generates_state(async_client, mock_redis, mock_github_service):
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"].startswith("https://github.com/login/oauth/authorize")
    
    # Verify state is stored in redis with expiration
    mock_redis.setex.assert_called_once()
    args, kwargs = mock_redis.setex.call_args
    assert args[0].startswith("oauth_state:")
    assert args[1] == 600  # 10 minutes expiration
    assert args[2] == "1"

@pytest.mark.asyncio
async def test_github_callback_missing_state_or_code(async_client):
    # Missing state
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc")
    assert response.status_code == 422  # Pydantic validation error for missing query param

    # Missing code
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?state=xyz")
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_github_callback_invalid_state(async_client, mock_redis):
    mock_redis.getdel.return_value = None  # State not found
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=invalid_state")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    mock_redis.getdel.assert_called_once_with("oauth_state:invalid_state")

@pytest.mark.asyncio
async def test_github_callback_state_single_use(async_client, mock_redis, mock_github_service, mock_db):
    # Setup mock to simulate single use: returns "1" first time, then None
    mock_redis.getdel.side_effect = ["1", None]
    mock_db.query().filter().first.return_value = None # new user
    
    # First call (valid state)
    res1 = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid_state", follow_redirects=False)
    assert res1.status_code == 302
    
    # Second call (replayed state)
    res2 = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid_state", follow_redirects=False)
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "INVALID_REQUEST"
    
    assert mock_redis.getdel.call_count == 2

# --- GitHub Callback Tests ---

@pytest.mark.asyncio
async def test_github_callback_token_exchange_failure(async_client, mock_redis, mock_github_service):
    mock_redis.getdel.return_value = "1"
    mock_github_service.exchange_code_for_token.side_effect = GithubAuthError("Token error")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid", follow_redirects=False)
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "GITHUB_API_ERROR"

@pytest.mark.asyncio
async def test_github_callback_profile_failure(async_client, mock_redis, mock_github_service):
    mock_redis.getdel.return_value = "1"
    mock_github_service.get_authenticated_user.side_effect = GithubAuthError("Profile error")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid", follow_redirects=False)
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "GITHUB_API_ERROR"

@pytest.mark.asyncio
async def test_github_callback_successful_auth(async_client, mock_redis, mock_github_service, mock_db):
    mock_redis.getdel.return_value = "1"
    mock_db.query().filter().first.return_value = None # Simulate new user
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=mock_code&state=valid", follow_redirects=False)
    
    assert response.status_code == 302
    assert response.headers["location"] == settings.FRONTEND_URL
    
    # Verify mock calls
    mock_github_service.exchange_code_for_token.assert_called_once_with("mock_code")
    mock_github_service.get_authenticated_user.assert_called_once_with("mock_access_token")
    
    # DB calls
    assert mock_db.add.call_count == 2 # User and GithubAccount added
    assert mock_db.commit.call_count == 1
    
    # Session
    assert settings.SESSION_COOKIE_NAME in response.headers["set-cookie"]
    cookie_header = response.headers["set-cookie"]
    assert "HttpOnly" in cookie_header
    assert "Secure" in cookie_header if settings.ENVIRONMENT == "production" else True
    
    assert mock_redis.setex.call_count == 1
    session_key = mock_redis.setex.call_args[0][0]
    assert session_key.startswith("session:")
    
    # Security: Ensure no token leaked in headers or body
    assert "mock_access_token" not in str(response.headers)

# --- Installation Verification Tests ---

@pytest.mark.asyncio
async def test_github_callback_with_installation_verified(async_client, mock_redis, mock_github_service, mock_db):
    mock_redis.getdel.return_value = "1"
    mock_db.query().filter().first.side_effect = [None, None, None] # No existing user, account, or installation
    
    mock_github_service.verify_user_installation.return_value = {"id": 999, "target_type": "Organization"}
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid&installation_id=999", follow_redirects=False)
    
    assert response.status_code == 302
    mock_github_service.verify_user_installation.assert_called_once_with("mock_access_token", "999")
    # Verify DB add was called for installation
    assert mock_db.add.call_count == 3 # User, Account, Installation

@pytest.mark.asyncio
async def test_github_callback_with_installation_invalid(async_client, mock_redis, mock_github_service, mock_db):
    mock_redis.getdel.return_value = "1"
    mock_db.query().filter().first.return_value = None # No existing user/account
    
    mock_github_service.verify_user_installation.return_value = None # Invalid installation
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=abc&state=valid&installation_id=999", follow_redirects=False)
    
    assert response.status_code == 302 # Auth still succeeds
    mock_github_service.verify_user_installation.assert_called_once_with("mock_access_token", "999")
    # Verify DB add was NOT called for installation
    assert mock_db.add.call_count == 2 # Only User, Account

# --- Session & /me Tests ---

@pytest.mark.asyncio
async def test_me_unauthenticated_missing_cookie(async_client):
    response = await async_client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"

@pytest.mark.asyncio
async def test_me_invalid_session_in_redis(async_client, mock_redis):
    # Cookie present, but not in redis
    mock_redis.get.return_value = None
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "fake_session")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_me_malformed_user_id_in_redis(async_client, mock_redis):
    mock_redis.get.return_value = "not_a_uuid"
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "fake_session")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_me_successful(async_client, mock_redis, mock_db):
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    
    # Mock DB returning user
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test")
    mock_account = GithubAccount(github_user_id="123", username="testuser")
    mock_user.github_accounts = [mock_account]
    mock_db.query().filter().first.return_value = mock_user
    
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["github"]["username"] == "testuser"
    assert "mock_access_token" not in str(data) # Security check

# --- Logout Tests ---

@pytest.mark.asyncio
async def test_logout_successful(async_client, mock_redis, mock_db):
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test")
    mock_db.query().filter().first.return_value = mock_user
    
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    response = await async_client.post(f"{settings.API_V1_STR}/auth/logout")
    assert response.status_code == 204
    
    # Verify redis deleted
    mock_redis.delete.assert_called_once_with("session:valid_session")
    
    # Verify cookie cleared (FastAPI sends Set-Cookie with max-age=0)
    assert settings.SESSION_COOKIE_NAME in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"] or "max-age=0" in response.headers["set-cookie"].lower()
