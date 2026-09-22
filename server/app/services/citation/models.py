"""
Citation domain models.
"""
from dataclasses import dataclass
from typing import Tuple
from uuid import UUID

from app.services.context.models import ContextItem


@dataclass(frozen=True)
class Citation:
    citation_id: str
    code_chunk_id: UUID
    repository_version_id: UUID
    file_id: UUID
    file_path: str
    start_line: int
    end_line: int
    retrieval_score: float
    retrieval_source: str
    chunk_index: int


@dataclass(frozen=True)
class CitationRequest:
    answer: str
    context_items: Tuple[ContextItem, ...]


@dataclass(frozen=True)
class CitationResponse:
    citations: Tuple[Citation, ...]
