"""
Retrieval domain models.

These are internal domain contracts used by the retrieval layer.
They are NOT API schemas — the API layer adapts these into HTTP responses.

The retrieval layer operates against a concrete repository_version_id,
never against a bare repository_id. Version resolution is the
responsibility of the API/service layer above.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID


@dataclass(frozen=True)
class RetrievalRequest:
    """
    Describes what the retrieval layer needs to execute a search.

    Invariants:
    - repository_version_id must be a concrete, already-validated,
      SUCCESS-status version. The retrieval layer does not resolve
      or validate versions.
    - query is the user's search string, already validated at the API layer.
    - limit is capped and validated at the API layer.
    """
    repository_version_id: UUID
    query: str
    limit: int = 20


@dataclass(frozen=True)
class RetrievalResult:
    """
    A single retrieval result with full provenance.

    Every result traces back to:
        Repository → RepositoryVersion → File → CodeChunk

    This contract supports downstream consumers:
    - API search results (SearchResultItem)
    - Future RAG context construction
    - Future citation rendering
    - Future agent tool results
    - Debugging and evaluation

    Fields:
        code_chunk_id: The CodeChunk that matched.
        repository_version_id: The version this result belongs to.
        file_id: The File containing the chunk.
        symbol_id: The Symbol associated with the chunk (may be None).
        file_path: The file path within the repository.
        content: The full chunk content (not truncated).
        start_line: Start line of the chunk in the file.
        end_line: End line of the chunk in the file.
        score: Relevance score. Semantics depend on `source`.
        source: Identifies the retrieval strategy that produced this result.
                e.g. "keyword", "semantic", "hybrid" (future).
    """
    code_chunk_id: UUID
    repository_version_id: UUID
    file_id: UUID
    symbol_id: UUID | None
    file_path: str
    content: str
    start_line: int
    end_line: int
    score: float
    source: str
