import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from app.services.auth import AuthService
from app.models.user import User, GithubAccount, GithubInstallation

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def auth_service(mock_db):
    return AuthService(mock_db)

class TestAuthService:
    @patch("app.services.auth.encrypt_token", return_value="encrypted_tok")
    def test_provision_new_user(self, mock_encrypt, auth_service, mock_db):
        auth_service.user_repo.get_github_account_by_github_user_id = MagicMock(return_value=None)
        auth_service.user_repo.get_user_by_email = MagicMock(return_value=None)
        
        mock_user = User(id=uuid4(), email="new@example.com", full_name="New User")
        auth_service.user_repo.create_user = MagicMock(return_value=mock_user)
        auth_service.user_repo.create_github_account = MagicMock()
        
        user = auth_service.provision_user_and_installation(
            github_user_data={
                "github_user_id": "123",
                "username": "newuser",
                "email": "new@example.com",
                "full_name": "New User"
            },
            access_token="tok",
            verified_installation=None,
            installation_id=None
        )
        
        assert user == mock_user
        auth_service.user_repo.create_user.assert_called_once()
        auth_service.user_repo.create_github_account.assert_called_once()
        mock_db.commit.assert_called_once()

    @patch("app.services.auth.encrypt_token", return_value="encrypted_tok")
    def test_update_existing_account(self, mock_encrypt, auth_service, mock_db):
        mock_user = User(id=uuid4(), email="old@example.com", full_name="Old Name")
        mock_account = GithubAccount(id=uuid4(), user_id=mock_user.id, user=mock_user)
        
        auth_service.user_repo.get_github_account_by_github_user_id = MagicMock(return_value=mock_account)
        auth_service.user_repo.create_user = MagicMock()
        auth_service.user_repo.create_github_account = MagicMock()
        
        user = auth_service.provision_user_and_installation(
            github_user_data={
                "github_user_id": "123",
                "username": "newuser",
                "email": "new@example.com",
                "full_name": "New Name"
            },
            access_token="tok",
            verified_installation=None,
            installation_id=None
        )
        
        assert user.email == "new@example.com"
        assert mock_account.username == "newuser"
        auth_service.user_repo.create_user.assert_not_called()
        auth_service.user_repo.create_github_account.assert_not_called()
        mock_db.commit.assert_called_once()

    @patch("app.services.auth.encrypt_token", return_value="encrypted_tok")
    def test_provision_installation(self, mock_encrypt, auth_service, mock_db):
        mock_user = User(id=uuid4(), email="new@example.com", full_name="New User")
        mock_account = GithubAccount(id=uuid4(), user_id=mock_user.id, user=mock_user)
        
        auth_service.user_repo.get_github_account_by_github_user_id = MagicMock(return_value=mock_account)
        auth_service.user_repo.get_installation_by_installation_id = MagicMock(return_value=None)
        auth_service.user_repo.create_installation = MagicMock()
        
        auth_service.provision_user_and_installation(
            github_user_data={
                "github_user_id": "123",
                "username": "newuser",
                "email": "new@example.com",
                "full_name": "New User"
            },
            access_token="tok",
            verified_installation={"id": 999, "target_type": "User"},
            installation_id="999"
        )
        
        auth_service.user_repo.create_installation.assert_called_once_with(
            github_account_id=mock_account.id,
            installation_id="999",
            target_type="User"
        )
        mock_db.commit.assert_called_once()

    def test_rollback_on_failure(self, auth_service, mock_db):
        with patch("app.services.auth.encrypt_token", side_effect=Exception("DB Error")):
            with pytest.raises(Exception, match="DB Error"):
                auth_service.provision_user_and_installation(
                    github_user_data={
                        "github_user_id": "123",
                        "username": "newuser",
                        "email": "new@example.com",
                        "full_name": "New User"
                    },
                    access_token="tok",
                    verified_installation=None,
                    installation_id=None
                )
        mock_db.rollback.assert_called_once()
        mock_db.commit.assert_not_called()
