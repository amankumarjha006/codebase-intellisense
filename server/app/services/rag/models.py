"""
Domain models for the RAG Generation Service layer.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from app.services.context.models import AssembledContext, ContextItem


@dataclass(frozen=True)
class RAGRequest:
    """
    Request to generate an answer from an assembled context.
    """
    query: str
    context: AssembledContext


@dataclass(frozen=True)
class RAGResponse:
    """
    The generated answer and the context provenance used to answer it.
    """
    answer: str
    context_items: Tuple[ContextItem, ...]
