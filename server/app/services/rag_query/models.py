from dataclasses import dataclass
from uuid import UUID
from app.services.citation.models import Citation

@dataclass(frozen=True)
class RAGQueryRequest:
    repository_id: UUID
    query: str
    repository_version_id: UUID | None = None
    retrieval_limit: int = 20
    max_context_chars: int = 32000

@dataclass(frozen=True)
class RAGQueryResponse:
    answer: str
    citations: tuple[Citation, ...]
    repository_version_id: UUID
