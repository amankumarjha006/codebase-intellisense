from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.agent import AgentRun, AgentCheckpoint
from app.repositories.agent import AgentRepository
from app.repositories.repository import RepositoryRepository


class AgentStateError(Exception):
    """Base exception for agent state operations."""
    pass


class AgentRunNotFoundError(AgentStateError):
    """Raised when an AgentRun is not found."""
    pass


class RepositoryVersionNotFoundError(AgentStateError):
    """Raised when a referenced RepositoryVersion is not found."""
    pass


class AgentStateService:
    def __init__(self, db: Session):
        self.db = db
        self.agent_repo = AgentRepository(db)
        self.repo_repo = RepositoryRepository(db)

    def create_run(
        self,
        *,
        repository_version_id: UUID,
        task: str,
        conversation_id: UUID | None = None,
    ) -> AgentRun:
        """
        Create a new AgentRun in the PENDING state.
        Validates that the repository_version_id exists.
        """
        version = self.repo_repo.get_version_by_id(repository_version_id)
        if not version:
            raise RepositoryVersionNotFoundError(
                f"RepositoryVersion {repository_version_id} not found."
            )
        
        return self.agent_repo.create_run(
            repository_version_id=repository_version_id,
            task=task,
            conversation_id=conversation_id,
        )

    def get_run(self, agent_run_id: UUID) -> AgentRun:
        """
        Retrieve an AgentRun by ID.
        Raises AgentRunNotFoundError if missing.
        """
        run = self.agent_repo.get_run(agent_run_id)
        if not run:
            raise AgentRunNotFoundError(f"AgentRun {agent_run_id} not found.")
        return run

    def update_run_status(self, agent_run_id: UUID, status: str) -> AgentRun:
        """
        Update the lifecycle status of an AgentRun.
        Automatically manages `started_at` and `completed_at` timestamps.
        """
        run = self.get_run(agent_run_id)
        run.status = status

        now = datetime.now(timezone.utc)
        if status == "RUNNING" and run.started_at is None:
            run.started_at = now
        
        if status in ("COMPLETED", "FAILED", "CANCELLED") and run.completed_at is None:
            run.completed_at = now

        self.db.flush()
        return run

    def update_current_step(self, agent_run_id: UUID, current_step: str | None) -> AgentRun:
        """
        Update the logical current step of the run.
        """
        run = self.get_run(agent_run_id)
        run.current_step = current_step
        self.db.flush()
        return run

    def create_checkpoint(
        self,
        *,
        agent_run_id: UUID,
        step: str,
        state: dict[str, Any],
    ) -> AgentCheckpoint:
        """
        Create a new persistent AgentCheckpoint snapshot.
        Validates the run exists first.
        """
        # Ensure run exists
        self.get_run(agent_run_id)

        return self.agent_repo.create_checkpoint(
            agent_run_id=agent_run_id,
            step=step,
            state_json=state,
        )

    def get_latest_checkpoint(self, agent_run_id: UUID) -> AgentCheckpoint | None:
        """
        Get the most recent checkpoint for an AgentRun.
        Returns None if no checkpoints exist.
        """
        # We don't necessarily raise if the run is missing here, but checking keeps behavior clean.
        # Following normal conventions, it returns None.
        return self.agent_repo.get_latest_checkpoint(agent_run_id)

    def list_checkpoints(self, agent_run_id: UUID) -> list[AgentCheckpoint]:
        """
        List all checkpoints for an AgentRun in chronological order.
        """
        return self.agent_repo.list_checkpoints(agent_run_id)

    def restore_state(self, agent_run_id: UUID) -> dict[str, Any] | None:
        """
        Retrieve the structured state JSON of the latest checkpoint.
        Does not resume or mutate the AgentRun.
        """
        # Ensure the run exists to fail fast if it's invalid
        self.get_run(agent_run_id)

        latest = self.get_latest_checkpoint(agent_run_id)
        if latest:
            return latest.state_json
        return None
