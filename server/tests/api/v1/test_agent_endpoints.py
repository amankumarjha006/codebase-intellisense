from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db, get_redis
from app.main import app
from app.models.agent import AgentCheckpoint, AgentRun
from app.models.repository import Repository, RepositoryVersion
from app.models.user import User


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def user_id():
    return uuid4()


@pytest.fixture
def mock_user(user_id):
    return User(id=user_id, email="dev@example.com", full_name="Dev User")


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def mock_redis():
    r = AsyncMock()
    return r


@pytest.fixture
def version_id():
    return uuid4()


@pytest.fixture
def repo_id():
    return uuid4()


@pytest.fixture
def mock_version(version_id, repo_id):
    return RepositoryVersion(id=version_id, repository_id=repo_id, commit_sha="abc1234", branch="main")


@pytest.fixture
def mock_repo(repo_id):
    return Repository(
        id=repo_id,
        github_repo_id="repo-123",
        name="my-repo",
        owner="my-owner",
        clone_url="https://github.com/my-owner/my-repo",
    )


@pytest.fixture
def auth_overrides(mock_db, mock_user, mock_redis):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_redis] = lambda: mock_redis
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_agent_run_success(client, auth_overrides, version_id, repo_id, mock_version, mock_repo):
    now = datetime.now(timezone.utc)
    mock_run = AgentRun(
        id=uuid4(),
        repository_version_id=version_id,
        task="Investigate performance bottleneck",
        status="RUNNING",
        current_step="start",
        created_at=now,
        updated_at=now,
        started_at=now,
        completed_at=None,
    )

    with patch("app.api.v1.endpoints.agent.RepositoryRepository") as mock_repo_cls, \
         patch("app.api.v1.endpoints.agent.AgentExecutionService") as mock_exec_cls:

        mock_repo_repo = MagicMock()
        mock_repo_repo.get_version_by_id.return_value = mock_version
        mock_repo_repo.get_for_user.return_value = mock_repo
        mock_repo_cls.return_value = mock_repo_repo

        mock_exec_service = MagicMock()
        mock_exec_service.start_run.return_value = mock_run
        mock_exec_cls.return_value = mock_exec_service

        resp = await client.post(
            "/api/v1/agent/runs",
            json={
                "repository_version_id": str(version_id),
                "task": "Investigate performance bottleneck",
                "current_step": "start",
                "initial_state": {"files": []},
            },
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == str(mock_run.id)
        assert data["status"] == "RUNNING"
        assert data["task"] == "Investigate performance bottleneck"


@pytest.mark.asyncio
async def test_create_agent_run_unauthorized_repository(client, auth_overrides, version_id):
    with patch("app.api.v1.endpoints.agent.RepositoryRepository") as mock_repo_cls:
        mock_repo_repo = MagicMock()
        mock_repo_repo.get_version_by_id.return_value = RepositoryVersion(
            id=version_id, repository_id=uuid4(), commit_sha="abc1234", branch="main"
        )
        # Not found for current user
        mock_repo_repo.get_for_user.return_value = None
        mock_repo_cls.return_value = mock_repo_repo

        resp = await client.post(
            "/api/v1/agent/runs",
            json={
                "repository_version_id": str(version_id),
                "task": "Unauthorized run",
            },
        )

        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "REPOSITORY_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_agent_run_success(client, auth_overrides, version_id, mock_version, mock_repo):
    run_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_run = AgentRun(
        id=run_id,
        repository_version_id=version_id,
        task="Analyze imports",
        status="RUNNING",
        current_step="parsing",
        created_at=now,
        updated_at=now,
        started_at=now,
        completed_at=None,
    )

    with patch("app.api.v1.endpoints.agent.RepositoryRepository") as mock_repo_cls, \
         patch("app.api.v1.endpoints.agent.AgentStateService") as mock_state_cls:

        mock_repo_repo = MagicMock()
        mock_repo_repo.get_version_by_id.return_value = mock_version
        mock_repo_repo.get_for_user.return_value = mock_repo
        mock_repo_cls.return_value = mock_repo_repo

        mock_state_service = MagicMock()
        mock_state_service.get_run.return_value = mock_run
        mock_state_cls.return_value = mock_state_service

        resp = await client.get(f"/api/v1/agent/runs/{run_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(run_id)
        assert data["current_step"] == "parsing"


@pytest.mark.asyncio
async def test_create_and_list_checkpoints(client, auth_overrides, version_id, mock_version, mock_repo):
    run_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_run = AgentRun(
        id=run_id,
        repository_version_id=version_id,
        task="Analyze imports",
        status="RUNNING",
        current_step="checkpoint_1",
        created_at=now,
        updated_at=now,
        started_at=now,
        completed_at=None,
    )

    mock_checkpoint = AgentCheckpoint(
        id=uuid4(),
        agent_run_id=run_id,
        step="checkpoint_1",
        state_json={"step_count": 1},
        created_at=now,
    )

    with patch("app.api.v1.endpoints.agent.RepositoryRepository") as mock_repo_cls, \
         patch("app.api.v1.endpoints.agent.AgentStateService") as mock_state_cls, \
         patch("app.api.v1.endpoints.agent.AgentExecutionService") as mock_exec_cls:

        mock_repo_repo = MagicMock()
        mock_repo_repo.get_version_by_id.return_value = mock_version
        mock_repo_repo.get_for_user.return_value = mock_repo
        mock_repo_cls.return_value = mock_repo_repo

        mock_state_service = MagicMock()
        mock_state_service.get_run.return_value = mock_run
        mock_state_service.list_checkpoints.return_value = [mock_checkpoint]
        mock_state_cls.return_value = mock_state_service

        mock_exec_service = MagicMock()
        mock_exec_service.checkpoint_step.return_value = mock_checkpoint
        mock_exec_cls.return_value = mock_exec_service

        # Create checkpoint
        post_resp = await client.post(
            f"/api/v1/agent/runs/{run_id}/checkpoints",
            json={"step": "checkpoint_1", "state": {"step_count": 1}},
        )
        assert post_resp.status_code == 201
        assert post_resp.json()["step"] == "checkpoint_1"

        # List checkpoints
        get_resp = await client.get(f"/api/v1/agent/runs/{run_id}/checkpoints")
        assert get_resp.status_code == 200
        checkpoints = get_resp.json()
        assert len(checkpoints) == 1
        assert checkpoints[0]["step"] == "checkpoint_1"


@pytest.mark.asyncio
async def test_complete_and_fail_run(client, auth_overrides, version_id, mock_version, mock_repo):
    run_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_run_completed = AgentRun(
        id=run_id,
        repository_version_id=version_id,
        task="Test task",
        status="COMPLETED",
        current_step=None,
        created_at=now,
        updated_at=now,
        started_at=now,
        completed_at=now,
    )

    with patch("app.api.v1.endpoints.agent.RepositoryRepository") as mock_repo_cls, \
         patch("app.api.v1.endpoints.agent.AgentStateService") as mock_state_cls, \
         patch("app.api.v1.endpoints.agent.AgentExecutionService") as mock_exec_cls:

        mock_repo_repo = MagicMock()
        mock_repo_repo.get_version_by_id.return_value = mock_version
        mock_repo_repo.get_for_user.return_value = mock_repo
        mock_repo_cls.return_value = mock_repo_repo

        mock_state_service = MagicMock()
        mock_state_service.get_run.return_value = mock_run_completed
        mock_state_cls.return_value = mock_state_service

        mock_exec_service = MagicMock()
        mock_exec_service.complete_run.return_value = mock_run_completed
        mock_exec_cls.return_value = mock_exec_service

        resp = await client.post(f"/api/v1/agent/runs/{run_id}/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"
