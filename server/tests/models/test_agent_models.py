import pytest
from uuid import uuid4
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion
from app.models.conversation import Conversation
from app.models.user import User
from app.models.agent import AgentRun, AgentCheckpoint

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    # Use function scope to isolate transactions per test
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

def create_base_entities(db_session):
    user = User(
        id=uuid4(),
        email="test@test.com",
        full_name="test"
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
    
    db_session.add(user)
    db_session.add(repo)
    db_session.add(version)
    db_session.add(conversation)
    db_session.flush()
    
    return repo, version, conversation

def test_agent_run_creation(db_session):
    repo, version, conversation = create_base_entities(db_session)
    
    run = AgentRun(
        repository_version_id=version.id,
        task="Test Task"
    )
    db_session.add(run)
    db_session.flush()
    
    assert run.id is not None
    assert run.status == "PENDING"
    assert run.task == "Test Task"
    assert run.repository_version_id == version.id
    assert run.created_at is not None
    assert run.updated_at is not None

def test_agent_run_with_conversation(db_session):
    repo, version, conversation = create_base_entities(db_session)
    
    run = AgentRun(
        repository_version_id=version.id,
        conversation_id=conversation.id,
        task="Task with Conversation"
    )
    db_session.add(run)
    db_session.flush()
    
    assert run.conversation_id == conversation.id

def test_agent_checkpoint_creation(db_session):
    repo, version, _ = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, task="Task")
    db_session.add(run)
    db_session.flush()
    
    chk = AgentCheckpoint(
        agent_run_id=run.id,
        step="test_step",
        state_json={"key": "value"}
    )
    db_session.add(chk)
    db_session.flush()
    
    assert chk.id is not None
    assert chk.agent_run_id == run.id
    assert chk.state_json == {"key": "value"}

def test_multiple_checkpoints_ordering(db_session):
    repo, version, _ = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, task="Task")
    db_session.add(run)
    db_session.flush()
    
    chk1 = AgentCheckpoint(agent_run_id=run.id, step="step1", state_json={"s": 1})
    chk2 = AgentCheckpoint(agent_run_id=run.id, step="step2", state_json={"s": 2})
    db_session.add_all([chk1, chk2])
    db_session.flush()
    
    checkpoints = db_session.query(AgentCheckpoint).filter_by(agent_run_id=run.id).order_by(AgentCheckpoint.created_at.asc()).all()
    assert len(checkpoints) == 2
    assert checkpoints[0].step == "step1"
    assert checkpoints[1].step == "step2"

def test_agent_run_status_enum_constraint(db_session):
    repo, version, _ = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, task="Task", status="INVALID_STATUS")
    db_session.add(run)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_agent_run_invalid_repository_version(db_session):
    run = AgentRun(repository_version_id=uuid4(), task="Task")
    db_session.add(run)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_agent_checkpoint_invalid_run(db_session):
    chk = AgentCheckpoint(agent_run_id=uuid4(), step="step1", state_json={})
    db_session.add(chk)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_agent_run_delete_cascades_to_checkpoints(db_session):
    repo, version, _ = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, task="Task")
    db_session.add(run)
    db_session.flush()
    
    chk = AgentCheckpoint(agent_run_id=run.id, step="step1", state_json={})
    db_session.add(chk)
    db_session.flush()
    
    # Delete run
    db_session.delete(run)
    db_session.flush()
    
    # Checkpoint should be deleted
    assert db_session.query(AgentCheckpoint).filter_by(id=chk.id).first() is None

def test_repository_version_deletion_is_restricted_by_agent_run(db_session):
    # Demonstrating the RESTRICT behavior on repository_version_id FK
    repo, version, conversation = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, task="Task")
    db_session.add(run)
    
    # Must delete conversation first, otherwise SQLAlchemy tries to nullify its repository_version_id
    db_session.delete(conversation)
    db_session.flush()
    
    # Try deleting the version
    db_session.delete(version)
    with pytest.raises(IntegrityError) as excinfo:
        db_session.flush()
        
    assert "agent_runs" in str(excinfo.value).lower() or "violates foreign key constraint" in str(excinfo.value).lower()
    db_session.rollback()

def test_conversation_deletion_sets_null(db_session):
    repo, version, conversation = create_base_entities(db_session)
    run = AgentRun(repository_version_id=version.id, conversation_id=conversation.id, task="Task")
    db_session.add(run)
    db_session.flush()
    
    db_session.delete(conversation)
    db_session.flush()
    
    db_session.refresh(run)
    assert run.conversation_id is None
