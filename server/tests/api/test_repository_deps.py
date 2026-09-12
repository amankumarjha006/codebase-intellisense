"""
Phase 3.4 Repository Authorization Helper Tests
Verifies the get_authorized_repository dependency correctly checks access
through UserRepository and throws the correct NotFoundException.
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.api.deps import get_authorized_repository, NotFoundException
from app.models.user import User
from app.models.repository import Repository

@pytest.fixture
def mock_repo_repo():
    with patch("app.api.deps.RepositoryRepository") as mock:
        yield mock

class TestGetAuthorizedRepository:
    def test_authorized_repository_returns_repo(self, mock_repo_repo):
        """
        1. Authorized repository
        User A, Repository X, UserRepository(A, X) -> return Repository X
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        expected_repo = Repository(id=repo_id)
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        repo_instance.get_for_user.return_value = expected_repo
        
        result = get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
        
        assert result == expected_repo
        repo_instance.get_for_user.assert_called_once_with(user_id=user.id, repository_id=repo_id)

    def test_unauthorized_repository_raises_exception(self, mock_repo_repo):
        """
        2. Unauthorized repository
        User A, Repository X, UserRepository(B, X) -> reject User A
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        # get_for_user returns None if User A doesn't have a UserRepository row for Repository X
        repo_instance.get_for_user.return_value = None
        
        with pytest.raises(NotFoundException) as exc_info:
            get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
            
        assert exc_info.value.code == "REPOSITORY_NOT_FOUND"
        assert exc_info.value.status_code == 404
        repo_instance.get_for_user.assert_called_once_with(user_id=user.id, repository_id=repo_id)

    def test_nonexistent_repository_raises_same_exception(self, mock_repo_repo):
        """
        3. Repository does not exist
        User A, Repository UUID that does not exist -> same externally safe behavior as unauthorized
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        repo_instance.get_for_user.return_value = None
        
        with pytest.raises(NotFoundException) as exc_info:
            get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
            
        assert exc_info.value.code == "REPOSITORY_NOT_FOUND"
        assert exc_info.value.status_code == 404

    def test_same_repository_different_users(self, mock_repo_repo):
        """
        4. Same repository, different users
        Both users authorized independently.
        """
        user_a = User(id=uuid4())
        user_b = User(id=uuid4())
        repo_id = uuid4()
        expected_repo = Repository(id=repo_id)
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        
        # Test User A
        repo_instance.get_for_user.return_value = expected_repo
        result_a = get_authorized_repository(repository_id=repo_id, db=mock_db, user=user_a)
        assert result_a == expected_repo
        repo_instance.get_for_user.assert_called_with(user_id=user_a.id, repository_id=repo_id)
        
        # Test User B
        repo_instance.get_for_user.return_value = expected_repo
        result_b = get_authorized_repository(repository_id=repo_id, db=mock_db, user=user_b)
        assert result_b == expected_repo
        repo_instance.get_for_user.assert_called_with(user_id=user_b.id, repository_id=repo_id)

    def test_repository_existence_alone_does_not_grant_access(self, mock_repo_repo):
        """
        5. Repository existence alone does not grant access
        Repository X exists, User A has no UserRepository row -> rejected
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        # The fact that it exists is irrelevant if get_for_user returns None
        repo_instance.get_for_user.return_value = None
        
        with pytest.raises(NotFoundException):
            get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
            
        repo_instance.get_for_user.assert_called_once_with(user_id=user.id, repository_id=repo_id)

    def test_github_installation_does_not_bypass_user_repository(self, mock_repo_repo):
        """
        6. GitHub installation does not grant access
        It still requires a UserRepository access row.
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        # Even if a GithubInstallation exists, get_for_user enforces UserRepository
        repo_instance.get_for_user.return_value = None
        
        with pytest.raises(NotFoundException):
            get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
            
        # Assert no other methods were called to attempt a bypass
        assert len(repo_instance.method_calls) == 1
        assert repo_instance.method_calls[0][0] == "get_for_user"

    def test_correct_repository_query_is_used(self, mock_repo_repo):
        """
        7. Correct repository query
        Verify the helper uses the existing access-controlled repository lookup.
        """
        user = User(id=uuid4())
        repo_id = uuid4()
        mock_db = MagicMock()
        
        repo_instance = mock_repo_repo.return_value
        repo_instance.get_for_user.return_value = Repository(id=repo_id)
        
        get_authorized_repository(repository_id=repo_id, db=mock_db, user=user)
        
        # Verify get_for_user was used rather than some manual db query
        repo_instance.get_for_user.assert_called_once_with(user_id=user.id, repository_id=repo_id)
