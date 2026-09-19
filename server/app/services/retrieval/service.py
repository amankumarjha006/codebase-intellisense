"""
RetrievalService — orchestrates retrieval operations.

Responsibilities:
- Receives a RetrievalRequest (with a concrete repository_version_id).
- Delegates to the configured RetrievalStrategy.
- Returns RetrievalResult objects.

Non-responsibilities:
- Does NOT execute SQL directly.
- Does NOT know FastAPI, HTTP status codes, or Pydantic API schemas.
- Does NOT resolve user authorization or repository versions.
- Does NOT create database transactions.
- Does NOT call LLMs, generate embeddings, or perform RAG.
"""
from __future__ import annotations

from app.services.retrieval.models import RetrievalRequest, RetrievalResult
from app.services.retrieval.strategies import RetrievalStrategy


class RetrievalService:
    """
    Thin orchestration layer over retrieval strategies.

    Construction follows the existing project convention of
    constructor injection (cf. RepositoryService, EmbeddingService).
    """
    def __init__(self, strategy: RetrievalStrategy) -> None:
        self._strategy = strategy

    def search(self, request: RetrievalRequest) -> list[RetrievalResult]:
        """
        Execute retrieval using the configured strategy.

        The request must contain a concrete, already-validated
        repository_version_id. The service does not validate versions.
        """
        return self._strategy.retrieve(request)
