import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from app.repositories.user import UserAccountRepository
from app.models.user import User, GithubAccount, GithubInstallation

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def repo(mock_db):
    return UserAccountRepository(mock_db)

class TestUserAccountRepository:
    def test_get_github_account_by_github_user_id(self, repo, mock_db):
        repo.get_github_account_by_github_user_id("123")
        mock_db.query.assert_called_with(GithubAccount)
        
    def test_get_user_by_email(self, repo, mock_db):
        repo.get_user_by_email("test@example.com")
        mock_db.query.assert_called_with(User)

    def test_get_user_by_id(self, repo, mock_db):
        user_id = uuid4()
        repo.get_user_by_id(user_id)
        mock_db.query.assert_called_with(User)

    def test_get_installation_by_installation_id(self, repo, mock_db):
        repo.get_installation_by_installation_id("inst_123")
        mock_db.query.assert_called_with(GithubInstallation)

    def test_create_user(self, repo, mock_db):
        user = repo.create_user(email="test@example.com", full_name="Test")
        assert user.email == "test@example.com"
        mock_db.add.assert_called_once_with(user)
        mock_db.flush.assert_called_once()

    def test_create_github_account(self, repo, mock_db):
        user_id = uuid4()
        account = repo.create_github_account(
            user_id=user_id,
            github_user_id="123",
            username="testuser",
            access_token_encrypted="encrypted_tok"
        )
        assert account.username == "testuser"
        mock_db.add.assert_called_once_with(account)
        mock_db.flush.assert_called_once()

    def test_create_installation(self, repo, mock_db):
        account_id = uuid4()
        installation = repo.create_installation(
            github_account_id=account_id,
            installation_id="456",
            target_type="Organization"
        )
        assert installation.installation_id == "456"
        mock_db.add.assert_called_once_with(installation)
        mock_db.flush.assert_called_once()
