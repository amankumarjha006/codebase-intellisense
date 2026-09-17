from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import AgentRun, AgentCheckpoint


class AgentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_run(
        self,
        *,
        repository_version_id: UUID,
        task: str,
        conversation_id: UUID | None = None,
    ) -> AgentRun:
        run = AgentRun(
            repository_version_id=repository_version_id,
            task=task,
            conversation_id=conversation_id,
            status="PENDING",
        )
        self.db.add(run)
        self.db.flush()
        return run

    def get_run(self, run_id: UUID) -> AgentRun | None:
        stmt = select(AgentRun).where(AgentRun.id == run_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_checkpoint(
        self,
        *,
        agent_run_id: UUID,
        step: str,
        state_json: dict[str, Any],
    ) -> AgentCheckpoint:
        chk = AgentCheckpoint(
            agent_run_id=agent_run_id,
            step=step,
            state_json=state_json,
        )
        self.db.add(chk)
        self.db.flush()
        return chk

    def get_latest_checkpoint(self, agent_run_id: UUID) -> AgentCheckpoint | None:
        stmt = (
            select(AgentCheckpoint)
            .where(AgentCheckpoint.agent_run_id == agent_run_id)
            .order_by(AgentCheckpoint.created_at.desc(), AgentCheckpoint.id.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_checkpoints(self, agent_run_id: UUID) -> list[AgentCheckpoint]:
        stmt = (
            select(AgentCheckpoint)
            .where(AgentCheckpoint.agent_run_id == agent_run_id)
            .order_by(AgentCheckpoint.created_at.asc(), AgentCheckpoint.id.asc())
        )
        return list(self.db.execute(stmt).scalars().all())
