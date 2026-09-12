from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any
from uuid import UUID
from datetime import datetime

class RepositoryCreate(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("URL cannot be empty or whitespace")
        return v

class RepositoryOut(BaseModel):
    id: UUID
    owner: str
    name: str
    is_private: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class RepositoryListOut(BaseModel):
    items: list[RepositoryOut]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    limit: int = Field(ge=1, le=100)
    has_more: bool

class RepositoryVersionSummary(BaseModel):
    id: UUID
    commit_sha: str
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class RepositoryDetailOut(BaseModel):
    id: UUID
    owner: str
    name: str
    is_private: bool
    active_version: RepositoryVersionSummary | None
    
    model_config = ConfigDict(from_attributes=True)

class RepositoryAnalyzeRequest(BaseModel):
    branch: str | None = None
    
    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str | None) -> str | None:
        if v is not None and (not v or not v.strip()):
            raise ValueError("Branch cannot be empty or whitespace if provided")
        return v

class AnalyzeRepositoryOut(BaseModel):
    job_id: UUID
    repository_version_id: UUID
    status: str
    message: str

class IndexJobOut(BaseModel):
    id: UUID
    repository_id: UUID
    repository_version_id: UUID
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    
    model_config = ConfigDict(from_attributes=True)

class AnalysisResultOut(BaseModel):
    analysis_type: str
    repository_version_id: UUID
    payload: dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)
