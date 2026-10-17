from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentRunCreate(BaseModel):
    repository_version_id: UUID
    task: str = Field(..., min_length=1)
    conversation_id: Optional[UUID] = None
    current_step: Optional[str] = None
    initial_state: Optional[dict[str, Any]] = None


class AgentCheckpointCreate(BaseModel):
    step: str = Field(..., min_length=1)
    state: dict[str, Any] = Field(default_factory=dict)


class AgentCheckpointOut(BaseModel):
    id: UUID
    agent_run_id: UUID
    step: str
    state_json: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def state(self) -> dict[str, Any]:
        return self.state_json


class AgentRunOut(BaseModel):
    id: UUID
    repository_version_id: UUID
    conversation_id: Optional[UUID] = None
    task: str
    status: str
    current_step: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
