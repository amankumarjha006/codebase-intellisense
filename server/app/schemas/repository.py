from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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

class RepositoryListItemOut(BaseModel):
    """Schema for repository items in the list endpoint, includes status data."""
    id: UUID
    owner: str
    name: str
    is_private: bool
    created_at: datetime
    latest_job_status: str | None = None
    latest_job_failure_code: str | None = None
    active_version_short_sha: str | None = None
    last_indexed_at: datetime | None = None


class RepositoryListOut(BaseModel):
    items: list[RepositoryListItemOut]
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
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failure_code: str | None = None
    failure_message: str | None = None
    
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def sanitize_failure(self) -> "IndexJobOut":
        if self.status == "FAILED":
            if not self.failure_code:
                self.failure_code = "INTERNAL_ERROR"

            # Map code to safe message
            messages = {
                "CLONE_FAILED": "Failed to clone the repository. Check permissions and URL.",
                "REPOSITORY_TOO_LARGE": "The repository is too large to be indexed.",
                "EMBEDDING_PROVIDER_RATE_LIMITED": "Indexing paused due to rate limits. It will be retried automatically.",
                "EMBEDDING_PROVIDER_UNAVAILABLE": "AI provider is temporarily unavailable. It will be retried.",
                "EMBEDDING_PROVIDER_AUTH": "AI provider authentication failed.",
                "INTERNAL_ERROR": "An internal error occurred during indexing."
            }
            self.failure_message = messages.get(self.failure_code, "An unexpected error occurred.")
        return self


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
    total: int | None = None

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

class RAGQueryRequestSchema(BaseModel):
    query: str
    repository_version_id: UUID | None = None
    retrieval_limit: int = Field(default=20, ge=1)
    max_context_chars: int = Field(default=32000, ge=1)

class CitationOut(BaseModel):
    id: str = Field(validation_alias="citation_id")
    file_path: str
    start_line: int
    end_line: int
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class RAGQueryResponseSchema(BaseModel):
    answer: str
    citations: list[CitationOut]
    repository_version_id: UUID
    
    model_config = ConfigDict(from_attributes=True)
