from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, NotFoundException
from app.core.rate_limit import general_rate_limiter
from app.models.user import User
from app.models.agent import AgentRun, AgentCheckpoint
from app.repositories.repository import RepositoryRepository
from app.schemas.agent import (
    AgentRunCreate,
    AgentRunOut,
    AgentCheckpointCreate,
    AgentCheckpointOut,
)
from app.services.agent_execution import AgentExecutionService
from app.services.agent_state import AgentStateService, AgentRunNotFoundError

router = APIRouter()


def _authorize_version(db: Session, user: User, repository_version_id: UUID):
    repo_repo = RepositoryRepository(db)
    version = repo_repo.get_version_by_id(repository_version_id)
    if not version:
        raise NotFoundException(
            code="VERSION_NOT_FOUND",
            message="The requested repository version was not found.",
        )
    repo = repo_repo.get_for_user(user_id=user.id, repository_id=version.repository_id)
    if not repo:
        raise NotFoundException(
            code="REPOSITORY_NOT_FOUND",
            message="The requested repository was not found or you do not have permission to access it.",
        )
    return version


def _get_authorized_run(db: Session, user: User, run_id: UUID) -> AgentRun:
    state_service = AgentStateService(db)
    try:
        run = state_service.get_run(run_id)
    except AgentRunNotFoundError:
        raise NotFoundException(
            code="AGENT_RUN_NOT_FOUND",
            message=f"Agent run {run_id} not found.",
        )
    _authorize_version(db, user, run.repository_version_id)
    return run


@router.post(
    "/runs",
    response_model=AgentRunOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create and start an agent run",
    dependencies=[Depends(general_rate_limiter)],
)
def create_agent_run(
    payload: AgentRunCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_version(db, user, payload.repository_version_id)
    execution_service = AgentExecutionService(db)
    run = execution_service.start_run(
        repository_version_id=payload.repository_version_id,
        task=payload.task,
        conversation_id=payload.conversation_id,
        current_step=payload.current_step,
        initial_state=payload.initial_state,
    )
    db.commit()
    return run


@router.get(
    "/runs/{run_id}",
    response_model=AgentRunOut,
    summary="Get an agent run",
    dependencies=[Depends(general_rate_limiter)],
)
def get_agent_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _get_authorized_run(db, user, run_id)


@router.get(
    "/runs/{run_id}/checkpoints",
    response_model=list[AgentCheckpointOut],
    summary="List checkpoints for an agent run",
    dependencies=[Depends(general_rate_limiter)],
)
def list_checkpoints(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_authorized_run(db, user, run_id)
    state_service = AgentStateService(db)
    return state_service.list_checkpoints(run_id)


@router.post(
    "/runs/{run_id}/checkpoints",
    response_model=AgentCheckpointOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a checkpoint for an agent run",
    dependencies=[Depends(general_rate_limiter)],
)
def create_checkpoint(
    run_id: UUID,
    payload: AgentCheckpointCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_authorized_run(db, user, run_id)
    execution_service = AgentExecutionService(db)
    checkpoint = execution_service.checkpoint_step(
        run_id=run_id,
        step=payload.step,
        state=payload.state,
    )
    db.commit()
    return checkpoint


@router.post(
    "/runs/{run_id}/complete",
    response_model=AgentRunOut,
    summary="Complete an agent run",
    dependencies=[Depends(general_rate_limiter)],
)
def complete_agent_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_authorized_run(db, user, run_id)
    execution_service = AgentExecutionService(db)
    run = execution_service.complete_run(run_id)
    db.commit()
    return run


@router.post(
    "/runs/{run_id}/fail",
    response_model=AgentRunOut,
    summary="Mark an agent run as failed",
    dependencies=[Depends(general_rate_limiter)],
)
def fail_agent_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_authorized_run(db, user, run_id)
    execution_service = AgentExecutionService(db)
    run = execution_service.fail_run(run_id)
    db.commit()
    return run
