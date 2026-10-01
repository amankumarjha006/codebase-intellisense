import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock
from uuid import uuid4

from app.main import app
from app.core.config import settings
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion
from app.models.conversation import Conversation, Message

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
def user_id():
    return uuid4()

@pytest.fixture
def mock_auth(mocker, mock_redis, mock_db, user_id):
    mock_redis.get.return_value = str(user_id)
    
    mock_user = User(id=user_id, email="test@example.com", full_name="Test User")
    mock_account = GithubAccount(github_user_id="123", username="testuser", access_token_encrypted="encrypted_tok")
    mock_user.github_accounts = [mock_account]
    
    mock_user_repo = mocker.patch("app.repositories.user.UserAccountRepository")
    mock_user_repo_instance = mock_user_repo.return_value
    mock_user_repo_instance.get_user_by_id.return_value = mock_user
    
    return mock_user

@pytest.fixture
def repo_id():
    return uuid4()

@pytest.fixture
def active_version_id():
    return uuid4()

@pytest.fixture
def mock_repo(repo_id, active_version_id):
    repo = Repository(id=repo_id, owner="testowner", name="testrepo", is_private=False)
    version = RepositoryVersion(id=active_version_id, repository_id=repo_id, commit_sha="abc", index_status="SUCCESS")
    repo.versions = [version]
    repo.active_version = version
    return repo

@pytest.fixture
def mock_auth_dep(mocker, mock_repo):
    mock_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_dep_instance = mock_dep.return_value
    mock_dep_instance.get_for_user.return_value = mock_repo
    return mock_dep_instance

@pytest.fixture
def mock_repo_repo(mocker, mock_repo):
    mock_repo_class = mocker.patch("app.repositories.repository.RepositoryRepository")
    mock_instance = mock_repo_class.return_value
    mock_instance.get_active_version.return_value = mock_repo.active_version
    return mock_instance

@pytest.mark.asyncio
async def test_create_conversation_success(async_client, mock_auth, mock_db, mocker, repo_id, active_version_id, user_id, mock_auth_dep, mock_repo_repo):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    conv_id = uuid4()
    mock_create = mocker.patch("app.repositories.conversation.ConversationRepository.create")
    def side_effect(c):
        c.id = conv_id
        c.created_at = datetime.now(timezone.utc)
        return c
    mock_create.side_effect = side_effect

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/conversations",
        json={"title": "My New Conversation"}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(conv_id)
    assert data["repository_id"] == str(repo_id)
    assert data["user_id"] == str(user_id)
    assert data["repository_version_id"] == str(active_version_id)
    assert data["title"] == "My New Conversation"

@pytest.mark.asyncio
async def test_create_conversation_no_active_version(async_client, mock_auth, mock_db, mocker, repo_id, mock_auth_dep, mock_repo_repo):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    # Remove active version
    mock_repo_repo.get_active_version.return_value = None

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/conversations",
        json={"title": "Test"}
    )
    
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

@pytest.mark.asyncio
async def test_create_conversation_unauthorized(async_client, mock_auth, mock_db, mocker, repo_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    
    mock_auth_dep = mocker.patch("app.api.deps.RepositoryRepository")
    mock_auth_dep_instance = mock_auth_dep.return_value
    mock_auth_dep_instance.get_for_user.return_value = None

    response = await async_client.post(
        f"{settings.API_V1_STR}/repositories/{repo_id}/conversations",
        json={"title": "Test"}
    )
    
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"

from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_get_conversation_success(async_client, mock_auth, mock_db, mocker, user_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    conv_id = uuid4()
    mock_get = mocker.patch("app.repositories.conversation.ConversationRepository.get_for_user")
    mock_get.return_value = Conversation(
        id=conv_id,
        user_id=user_id,
        repository_id=uuid4(),
        repository_version_id=uuid4(),
        title="Test Conv",
        created_at=datetime.now(timezone.utc)
    )

    response = await async_client.get(
        f"{settings.API_V1_STR}/conversations/{conv_id}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(conv_id)
    assert response.json()["title"] == "Test Conv"

@pytest.mark.asyncio
async def test_get_conversation_not_found(async_client, mock_auth, mock_db, mocker):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    conv_id = uuid4()
    mock_get = mocker.patch("app.repositories.conversation.ConversationRepository.get_for_user")
    mock_get.return_value = None

    response = await async_client.get(
        f"{settings.API_V1_STR}/conversations/{conv_id}"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.asyncio
async def test_list_conversations(async_client, mock_auth, mock_db, mocker, repo_id, user_id, mock_auth_dep):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    conv_id = uuid4()
    mock_list = mocker.patch("app.repositories.conversation.ConversationRepository.list_for_user")
    mock_list.return_value = (
        [
            Conversation(
                id=conv_id,
                user_id=user_id,
                repository_id=repo_id,
                repository_version_id=uuid4(),
                title="List Test",
                created_at=datetime.now(timezone.utc)
            )
        ],
        1
    )

    response = await async_client.get(
        f"{settings.API_V1_STR}/repositories/{repo_id}/conversations?page=1&limit=10"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == str(conv_id)
    assert not data["has_more"]

@pytest.mark.asyncio
async def test_list_messages(async_client, mock_auth, mock_db, mocker, user_id):
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    conv_id = uuid4()
    msg_id = uuid4()
    
    # Mock conversation exists and owned by user
    mock_get = mocker.patch("app.repositories.conversation.ConversationRepository.get_for_user")
    mock_get.return_value = Conversation(id=conv_id, user_id=user_id, created_at=datetime.now(timezone.utc))

    # Mock messages
    mock_list_msgs = mocker.patch("app.repositories.message.MessageRepository.list_for_conversation")
    mock_list_msgs.return_value = (
        [
            Message(
                id=msg_id,
                conversation_id=conv_id,
                role="user",
                content="Hello!",
                created_at=datetime.now(timezone.utc)
            )
        ],
        1
    )

    response = await async_client.get(
        f"{settings.API_V1_STR}/conversations/{conv_id}/messages?page=1&limit=50"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == str(msg_id)
    assert data["items"][0]["role"] == "user"
    assert data["items"][0]["content"] == "Hello!"
