import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.core.encryption import decrypt_token, encrypt_token
from app.models.user import GithubAccount, User

# We can reuse the fixtures from test_auth
from tests.api.v1.test_auth import mock_redis, mock_db, async_client, mock_github_service

@pytest.mark.asyncio
async def test_github_token_is_persisted_and_encrypted(async_client, mock_redis, mock_github_service, mock_db):
    """1. GitHub token is persisted after successful callback
       2. stored value is encrypted
       3. plaintext token is never returned"""
    from app.core.config import settings
    mock_redis.getdel.return_value = "1"
    mock_db.query().filter().first.return_value = None # new user
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=mock_code&state=valid", follow_redirects=False)
    assert response.status_code == 302
    
    # Check that GithubAccount was added with encrypted token
    added_account = None
    for call in mock_db.add.call_args_list:
        obj = call[0][0]
        if isinstance(obj, GithubAccount):
            added_account = obj
            
    assert added_account is not None
    assert added_account.access_token_encrypted is not None
    # Token must not be stored in plaintext
    assert added_account.access_token_encrypted != "mock_access_token"
    # Decrypting it must yield the original mock token
    assert decrypt_token(added_account.access_token_encrypted) == "mock_access_token"

@pytest.mark.asyncio
async def test_existing_github_account_gets_token_updated(async_client, mock_redis, mock_github_service, mock_db):
    """5. existing GithubAccount gets its token updated"""
    from app.core.config import settings
    mock_redis.getdel.return_value = "1"
    
    existing_user = User(id=uuid4(), email="test@example.com", full_name="Old Name")
    existing_account = GithubAccount(id=uuid4(), github_user_id="123456", username="oldusername")
    existing_account.user = existing_user
    
    # Mock finding the existing account
    mock_db.query().filter().first.side_effect = [existing_account, existing_user]
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=mock_code&state=valid", follow_redirects=False)
    assert response.status_code == 302
    
    # Token should be updated
    assert existing_account.access_token_encrypted is not None
    assert decrypt_token(existing_account.access_token_encrypted) == "mock_access_token"
    
    # Ensure add was not called (account already exists)
    for call in mock_db.add.call_args_list:
        assert not isinstance(call[0][0], GithubAccount)

@pytest.mark.asyncio
async def test_failed_github_authentication_does_not_persist_token(async_client, mock_redis, mock_github_service, mock_db):
    """6. failed GitHub authentication does not persist a token
       7. database failure rolls back token persistence"""
    from app.core.config import settings
    from app.services.github import GithubAuthError
    mock_redis.getdel.return_value = "1"
    mock_github_service.exchange_code_for_token.side_effect = GithubAuthError("Failed")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/github/callback?code=mock_code&state=valid", follow_redirects=False)
    assert response.status_code == 502
    
    # Db transaction rolled back
    mock_db.rollback.assert_called_once()
    assert mock_db.add.call_count == 0

@pytest.mark.asyncio
async def test_plaintext_token_is_never_returned_by_me(async_client, mock_redis, mock_db):
    """Check that /me doesn't return the encrypted or plaintext token."""
    from app.core.config import settings
    user_id = str(uuid4())
    mock_redis.get.return_value = user_id
    
    mock_user = User(id=uuid4(), email="test@example.com", full_name="Test")
    mock_account = GithubAccount(
        github_user_id="123", 
        username="testuser",
        access_token_encrypted=encrypt_token("super_secret_token_123")
    )
    mock_user.github_accounts = [mock_account]
    mock_db.query().filter().first.return_value = mock_user
    
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    response = await async_client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 200
    data = response.json()
    
    assert "super_secret_token_123" not in str(data)
    assert "access_token" not in str(data)
    assert "access_token_encrypted" not in str(data)
