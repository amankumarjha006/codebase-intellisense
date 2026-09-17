from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.agent import AgentRun, AgentCheckpoint
from app.services.agent_state import AgentStateService


class AgentExecutionService:
    def __init__(
        self,
        db: Session,
        state_service: AgentStateService | None = None,
    ):
        self.db = db
        self.state_service = state_service or AgentStateService(db)

    def start_run(
        self,
        *,
        repository_version_id: UUID,
        task: str,
        conversation_id: UUID | None = None,
        current_step: str | None = None,
        initial_state: dict[str, Any] | None = None,
    ) -> AgentRun:
        """
        Start a new AgentRun.
        Creates the run, transitions to RUNNING, optionally sets current_step,
        and creates an initial checkpoint if initial_state is provided.
        """
        run = self.state_service.create_run(
            repository_version_id=repository_version_id,
            task=task,
            conversation_id=conversation_id,
        )
        
        # Transition to RUNNING to establish started_at
        run = self.state_service.update_run_status(run.id, "RUNNING")
        
        if current_step:
            run = self.state_service.update_current_step(run.id, current_step)
            
        if initial_state is not None:
            checkpoint_step = current_step or "initial"
            self.state_service.create_checkpoint(
                agent_run_id=run.id,
                step=checkpoint_step,
                state=initial_state
            )
            
        return run

    def checkpoint_step(
        self,
        *,
        run_id: UUID,
        step: str,
        state: dict[str, Any],
    ) -> AgentCheckpoint:
        """
        Atomically update the current step and create a checkpoint.
        Delegates persistence to AgentStateService under the caller's transaction.
        """
        self.state_service.update_current_step(run_id, step)
        return self.state_service.create_checkpoint(
            agent_run_id=run_id,
            step=step,
            state=state,
        )

    def complete_run(self, run_id: UUID) -> AgentRun:
        """
        Transition the run to COMPLETED and populate completed_at.
        """
        return self.state_service.update_run_status(run_id, "COMPLETED")

    def fail_run(self, run_id: UUID) -> AgentRun:
        """
        Transition the run to FAILED and populate completed_at.
        """
        return self.state_service.update_run_status(run_id, "FAILED")

    def restore_state(
        self,
        run_id: UUID,
    ) -> dict[str, Any] | None:
        """
        Retrieve the latest structured state JSON without mutating the run.
        """
        return self.state_service.restore_state(run_id)
