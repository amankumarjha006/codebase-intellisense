import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.services.github import GithubService, GithubAuthError


@pytest.fixture
def github_service():
    return GithubService()


class TestGithubAuth:
    def test_authorization_url_includes_email_scope(self, github_service):
        github_service.client_id = "test_client_id"
        github_service.callback_url = "http://localhost/callback"
        url = github_service.get_authorization_url("test_state")
        
        assert "client_id=test_client_id" in url
        assert "redirect_uri=http%3A%2F%2Flocalhost%2Fcallback" in url
        assert "state=test_state" in url
        assert "scope=user%3Aemail" in url

    @pytest.mark.asyncio
    async def test_get_authenticated_user_sanitizes_errors(self, github_service):
        mock_profile_response = MagicMock()
        mock_profile_response.status_code = 200
        mock_profile_response.json.return_value = {
            "id": 1,
            "login": "testuser",
            "name": "Test User",
            "email": None
        }

        mock_emails_response = MagicMock()
        mock_emails_response.status_code = 403 # Simulate an error retrieving emails
        
        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            
            # Setup side effect for two calls: /user and /user/emails
            mock_client.get.side_effect = [mock_profile_response, mock_emails_response]
            
            with pytest.raises(GithubAuthError, match="Failed to retrieve user emails") as exc_info:
                await github_service.get_authenticated_user("super_secret_token")
                
            # Verify token isn't in the exception string
            assert "super_secret_token" not in str(exc_info.value)


class TestGetRepository:
    @pytest.mark.asyncio
    async def test_successful_fetch(self, github_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": 123,
            "name": "repo",
            "owner": {"login": "owner"},
            "clone_url": "https://github.com/owner/repo.git",
            "private": False,
        }

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_response

            result = await github_service.get_repository("token", "owner", "repo")

        assert result["id"] == 123
        assert result["name"] == "repo"
        mock_client.get.assert_awaited_once()
        call_args = mock_client.get.call_args
        assert "repos/owner/repo" in call_args[0][0]
        assert call_args[1]["headers"]["Authorization"] == "Bearer token"

    @pytest.mark.asyncio
    async def test_404_raises_error(self, github_service):
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_response

            with pytest.raises(GithubAuthError, match="not found"):
                await github_service.get_repository("token", "owner", "repo")

    @pytest.mark.asyncio
    async def test_403_raises_error(self, github_service):
        mock_response = MagicMock()
        mock_response.status_code = 403

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_response

            with pytest.raises(GithubAuthError, match="Access denied"):
                await github_service.get_repository("token", "owner", "repo")

    @pytest.mark.asyncio
    async def test_500_raises_error(self, github_service):
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_response

            with pytest.raises(GithubAuthError, match="Failed to retrieve"):
                await github_service.get_repository("token", "owner", "repo")

    @pytest.mark.asyncio
    async def test_no_token_leakage_in_error(self, github_service):
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = mock_response

            with pytest.raises(GithubAuthError) as exc_info:
                await github_service.get_repository("super_secret_token", "owner", "repo")

            assert "super_secret_token" not in str(exc_info.value)
