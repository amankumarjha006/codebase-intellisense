import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion
from app.models.conversation import Conversation
from app.models.user import User
from app.services.agent_execution import AgentExecutionService
from app.services.agent_state import AgentRunNotFoundError


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
        email="test_exec@test.com",
        full_name="test exec"
    )
    repo = Repository(
        id=uuid4(), owner="test_o", name=f"test_r_{uuid4()}",
        github_repo_id=str(uuid4())[:20], clone_url="http://test", is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="abc1234", branch="main"
    )
    version2 = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="def5678", branch="other"
    )
    conversation = Conversation(
        id=uuid4(), repository_id=repo.id, user_id=user.id, repository_version_id=version.id
    )
    
    db_session.add_all([user, repo, version, version2, conversation])
    db_session.flush()
    return {"user": user, "repo": repo, "version": version, "version2": version2, "conversation": conversation}


@pytest.fixture
def service(db_session):
    return AgentExecutionService(db_session)


# --- Lifecycle Tests ---

def test_start_run(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    assert run.id is not None
    assert run.status == "RUNNING"
    assert run.started_at is not None
    assert run.completed_at is None
    assert run.current_step is None


def test_start_run_repeated_status(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    original_started_at = run.started_at
    
    # Transitioning to RUNNING again via state_service directly preserves started_at
    run = service.state_service.update_run_status(run.id, "RUNNING")
    
    assert run.started_at == original_started_at


def test_start_run_with_initial_state(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(
        repository_version_id=version.id, 
        task="Task",
        current_step="custom_init",
        initial_state={"status": "starting"}
    )
    
    assert run.current_step == "custom_init"
    
    chk = service.state_service.get_latest_checkpoint(run.id)
    assert chk.step == "custom_init"
    assert chk.state_json == {"status": "starting"}


def test_start_run_with_initial_state_default_step(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(
        repository_version_id=version.id, 
        task="Task",
        initial_state={"status": "starting"}
    )
    
    assert run.current_step is None
    
    chk = service.state_service.get_latest_checkpoint(run.id)
    assert chk.step == "initial"
    assert chk.state_json == {"status": "starting"}


def test_complete_run(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    assert run.completed_at is None
    
    run = service.complete_run(run.id)
    
    assert run.status == "COMPLETED"
    assert run.completed_at is not None


def test_fail_run(service, base_entities):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    assert run.completed_at is None
    
    run = service.fail_run(run.id)
    
    assert run.status == "FAILED"
    assert run.completed_at is not None


# --- Checkpointing Tests ---

def test_checkpoint_step(service, base_entities, db_session):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    chk1 = service.checkpoint_step(run_id=run.id, step="step1", state={"progress": 1})
    chk1.created_at = datetime(2026, 1, 1, 10, 0, 1, tzinfo=timezone.utc)
    db_session.flush()

    chk2 = service.checkpoint_step(run_id=run.id, step="step2", state={"progress": 2})
    chk2.created_at = datetime(2026, 1, 1, 10, 0, 2, tzinfo=timezone.utc)
    db_session.flush()

    # Verify state exactness
    assert chk1.state_json == {"progress": 1}
    assert chk2.state_json == {"progress": 2}
    
    # Verify latest state
    latest = service.state_service.get_latest_checkpoint(run.id)
    assert latest.id == chk2.id
    assert latest.step == "step2"
    
    # Earlier states remain unchanged
    all_chks = service.state_service.list_checkpoints(run.id)
    assert len(all_chks) == 2
    assert all_chks[0].id == chk1.id
    assert all_chks[1].id == chk2.id


def test_restore_state(service, base_entities, db_session):
    version = base_entities["version"]
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    chk = service.checkpoint_step(run_id=run.id, step="step1", state={"progress": 1})
    
    # Should only read state, without mutating the run
    state = service.restore_state(run.id)
    assert state == {"progress": 1}
    
    # Verify run remains untouched logically
    fetched_run = service.state_service.get_run(run.id)
    assert fetched_run.status == "RUNNING"
    assert fetched_run.current_step == "step1"


def test_missing_run_behavior(service):
    with pytest.raises(AgentRunNotFoundError):
        service.checkpoint_step(run_id=uuid4(), step="s", state={})
        
    with pytest.raises(AgentRunNotFoundError):
        service.complete_run(uuid4())
        
    with pytest.raises(AgentRunNotFoundError):
        service.fail_run(uuid4())

    with pytest.raises(AgentRunNotFoundError):
        service.restore_state(uuid4())


# --- Transaction Semantics Tests ---

def test_transaction_rollback_clears_all(service, base_entities, db_session):
    version = base_entities["version"]
    
    run = service.start_run(repository_version_id=version.id, task="Task")
    service.checkpoint_step(run_id=run.id, step="s1", state={"a": 1})
    service.checkpoint_step(run_id=run.id, step="s2", state={"b": 2})
    
    # Everything is flushed but not committed. Now rollback.
    db_session.rollback()
    
    # The run should no longer exist
    with pytest.raises(AgentRunNotFoundError):
        service.state_service.get_run(run.id)


def test_checkpoint_atomicity(service, base_entities, db_session):
    version = base_entities["version"]
    
    run = service.start_run(repository_version_id=version.id, task="Task")
    
    # Assume we hit an error halfway through checkpointing. We simulate it by manual rollback.
    try:
        service.state_service.update_current_step(run.id, "bad_step")
        # Simulate create_checkpoint raising an exception
        raise ValueError("Boom")
    except ValueError:
        db_session.rollback()
        
    with pytest.raises(AgentRunNotFoundError):
        service.state_service.get_run(run.id)


# --- Version Isolation ---

def test_version_isolation(service, base_entities, db_session):
    v1 = base_entities["version"]
    v2 = base_entities["version2"]
    
    run1 = service.start_run(repository_version_id=v1.id, task="T1")
    chk1 = service.checkpoint_step(run_id=run1.id, step="s1", state={"repo": 1})
    chk1.created_at = datetime(2026, 1, 1, 10, 0, 1, tzinfo=timezone.utc)
    db_session.flush()

    run2 = service.start_run(repository_version_id=v2.id, task="T2")
    chk2 = service.checkpoint_step(run_id=run2.id, step="s2", state={"repo": 2})
    chk2.created_at = datetime(2026, 1, 1, 10, 0, 2, tzinfo=timezone.utc)
    db_session.flush()
    
    restored1 = service.restore_state(run1.id)
    assert restored1 == {"repo": 1}
    
    restored2 = service.restore_state(run2.id)
    assert restored2 == {"repo": 2}
    
    all1 = service.state_service.list_checkpoints(run1.id)
    assert len(all1) == 1
    assert all1[0].id == chk1.id
