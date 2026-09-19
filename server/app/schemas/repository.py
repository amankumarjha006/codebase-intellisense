from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.repository import RepositoryVersion
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
    branch: str
    indexed_at: datetime | None
    
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_version(cls, version: "RepositoryVersion") -> "RepositoryVersionSummary":
        return cls(
            id=version.id,
            commit_sha=version.commit_sha,
            status=version.index_status,
            branch=version.branch,
            indexed_at=version.indexed_at,
        )

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

class FileOut(BaseModel):
    id: UUID
    path: str = Field(validation_alias="file_path")
    language: str
    size: int = Field(validation_alias="size_bytes")
    sha256: str = Field(validation_alias="hash")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class FileDetailOut(BaseModel):
    id: UUID
    path: str = Field(validation_alias="file_path")
    language: str
    size: int = Field(validation_alias="size_bytes")
    sha256: str = Field(validation_alias="hash")
    content: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class FileListOut(BaseModel):
    files: list[FileOut]

class SearchRequest(BaseModel):
    query: str
    repository_version_id: UUID | None = None
    limit: int | None = Field(default=20, le=50, ge=1)
    
    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Query cannot be empty or whitespace")
        return v

class SearchResultItem(BaseModel):
    id: UUID
    file_path: str
    start_line: int | None
    end_line: int | None
    snippet: str
    score: float
    
    model_config = ConfigDict(from_attributes=True)

class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    repository_version_id: UUID
