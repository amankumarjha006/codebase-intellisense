import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion
from app.models.conversation import Conversation
from app.models.user import User
from app.services.agent_state import (
    AgentStateService,
    AgentRunNotFoundError,
    RepositoryVersionNotFoundError,
)

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def base_entities(db_session):
    user = User(
        id=uuid4(),
        email="test_service@test.com",
        full_name="test service"
    )
    repo = Repository(
        id=uuid4(), owner="test_o", name=f"test_r_{uuid4()}",
        github_repo_id=str(uuid4())[:20], clone_url="http://test", is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="abc1234", branch="main"
    )
    conversation = Conversation(
        id=uuid4(), repository_id=repo.id, user_id=user.id, repository_version_id=version.id
    )
    
    db_session.add_all([user, repo, version, conversation])
    db_session.flush()
    return {"user": user, "repo": repo, "version": version, "conversation": conversation}


@pytest.fixture
def service(db_session):
    return AgentStateService(db_session)


def test_create_run(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(
        repository_version_id=version.id,
        task="Test task"
    )
    assert run.id is not None
    assert run.repository_version_id == version.id
    assert run.task == "Test task"
    assert run.status == "PENDING"
    assert run.started_at is None
    assert run.completed_at is None
    assert run.current_step is None


def test_create_run_invalid_version(service):
    with pytest.raises(RepositoryVersionNotFoundError):
        service.create_run(
            repository_version_id=uuid4(),
            task="Task"
        )


def test_get_run(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    fetched = service.get_run(run.id)
    assert fetched.id == run.id


def test_get_run_missing(service):
    with pytest.raises(AgentRunNotFoundError):
        service.get_run(uuid4())


def test_update_run_status_running_timestamp(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    assert run.started_at is None
    
    # Transition to RUNNING
    run = service.update_run_status(run.id, "RUNNING")
    assert run.status == "RUNNING"
    assert run.started_at is not None
    original_started_at = run.started_at
    
    # Repeated update should not reset started_at
    run = service.update_run_status(run.id, "RUNNING")
    assert run.started_at == original_started_at


def test_update_run_status_terminal_timestamp(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    assert run.completed_at is None
    
    # Transition to COMPLETED
    run = service.update_run_status(run.id, "COMPLETED")
    assert run.status == "COMPLETED"
    assert run.completed_at is not None
    original_completed_at = run.completed_at
    
    # Repeated update should not reset completed_at
    run = service.update_run_status(run.id, "COMPLETED")
    assert run.completed_at == original_completed_at


def test_update_run_status_failed_cancelled(service, base_entities):
    version = base_entities["version"]
    
    run_failed = service.create_run(repository_version_id=version.id, task="Task F")
    run_failed = service.update_run_status(run_failed.id, "FAILED")
    assert run_failed.completed_at is not None
    
    run_cancel = service.create_run(repository_version_id=version.id, task="Task C")
    run_cancel = service.update_run_status(run_cancel.id, "CANCELLED")
    assert run_cancel.completed_at is not None


def test_update_current_step(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    run = service.update_current_step(run.id, "step_1")
    assert run.current_step == "step_1"
    
    run = service.update_current_step(run.id, None)
    assert run.current_step is None


def test_create_checkpoint(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    state = {"a": 1, "b": {"c": 2}}
    chk = service.create_checkpoint(
        agent_run_id=run.id,
        step="step_1",
        state=state
    )
    
    assert chk.id is not None
    assert chk.agent_run_id == run.id
    assert chk.step == "step_1"
    assert chk.state_json == state


def test_create_checkpoint_missing_run(service):
    with pytest.raises(AgentRunNotFoundError):
        service.create_checkpoint(
            agent_run_id=uuid4(),
            step="step",
            state={}
        )


def test_get_latest_checkpoint_and_list(service, base_entities, db_session):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    chk1 = service.create_checkpoint(agent_run_id=run.id, step="s1", state={"id": 1})
    chk1.created_at = datetime(2026, 1, 1, 10, 0, 1, tzinfo=timezone.utc)
    db_session.flush()

    chk2 = service.create_checkpoint(agent_run_id=run.id, step="s2", state={"id": 2})
    chk2.created_at = datetime(2026, 1, 1, 10, 0, 2, tzinfo=timezone.utc)
    db_session.flush()

    chk3 = service.create_checkpoint(agent_run_id=run.id, step="s3", state={"id": 3})
    chk3.created_at = datetime(2026, 1, 1, 10, 0, 3, tzinfo=timezone.utc)
    db_session.flush()
    
    latest = service.get_latest_checkpoint(run.id)
    assert latest.id == chk3.id
    assert latest.step == "s3"
    
    checkpoints = service.list_checkpoints(run.id)
    assert len(checkpoints) == 3
    assert checkpoints[0].id == chk1.id
    assert checkpoints[1].id == chk2.id
    assert checkpoints[2].id == chk3.id


def test_restore_state(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    # Missing checkpoint
    state = service.restore_state(run.id)
    assert state is None
    
    # With checkpoint
    service.create_checkpoint(agent_run_id=run.id, step="s1", state={"status": "working"})
    state = service.restore_state(run.id)
    assert state == {"status": "working"}


def test_restore_state_missing_run(service):
    with pytest.raises(AgentRunNotFoundError):
        service.restore_state(uuid4())


def test_transaction_semantics(service, base_entities, db_session):
    # Ensure service does not commit
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    db_session.rollback()
    
    # After rollback, the run should not exist if the service didn't commit
    with pytest.raises(AgentRunNotFoundError):
        service.get_run(run.id)


def test_get_latest_checkpoint_missing_run(service):
    with pytest.raises(AgentRunNotFoundError):
        service.get_latest_checkpoint(uuid4())


def test_list_checkpoints_missing_run(service):
    with pytest.raises(AgentRunNotFoundError):
        service.list_checkpoints(uuid4())


def test_update_run_status_direct_to_completed(service, base_entities):
    version = base_entities["version"]
    run = service.create_run(repository_version_id=version.id, task="Task")
    
    assert run.started_at is None
    assert run.completed_at is None
    
    # Transition directly to COMPLETED without RUNNING
    run = service.update_run_status(run.id, "COMPLETED")
    
    assert run.status == "COMPLETED"
    assert run.started_at is None
    assert run.completed_at is not None
