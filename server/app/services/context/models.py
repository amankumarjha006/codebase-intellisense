"""
Domain models for the Context Assembly layer.

These models define the boundaries between retrieval results and the structured
text passed to an LLM.
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID
from typing import List

from app.services.retrieval.models import RetrievalResult


@dataclass(frozen=True)
class ContextItem:
    """
    A single assembled context item.
    Preserves all provenance from the RetrievalResult.
    """
    code_chunk_id: UUID
    repository_version_id: UUID
    file_id: UUID
    symbol_id: UUID | None
    file_path: str
    start_line: int
    end_line: int
    content: str
    retrieval_score: float
    retrieval_source: str
    chunk_index: int


@dataclass(frozen=True)
class ContextRequest:
    """
    Request to assemble context from a list of retrieval results.
    """
    query: str
    retrieval_results: List[RetrievalResult]
    max_context_chars: int


@dataclass(frozen=True)
class AssembledContext:
    """
    The final formatted and bounded context ready for the LLM.
    """
    items: List[ContextItem]
    formatted_context: str
    used_budget: int
    max_budget: int
