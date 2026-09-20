"""
Retrieval strategies.

A strategy encapsulates how retrieval results are produced from a
RetrievalRequest. The current implementation provides only KeywordRetrievalStrategy.

Future strategies (SemanticRetrievalStrategy, HybridRetrievalStrategy) will
satisfy the same Protocol, returning the same RetrievalResult contract.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from sqlalchemy.orm import Session

from app.repositories.knowledge import KnowledgeRepository
from app.services.retrieval.models import RetrievalRequest, RetrievalResult


@runtime_checkable
class RetrievalStrategy(Protocol):
    """
    Contract for a retrieval strategy.

    Every strategy receives a RetrievalRequest (which already contains a
    concrete repository_version_id) and returns an ordered list of
    RetrievalResult objects.
    """
    def retrieve(self, request: RetrievalRequest) -> list[RetrievalResult]:
        ...


class KeywordRetrievalStrategy:
    """
    Deterministic literal keyword search over CodeChunk content.

    Delegates the actual SQL query to KnowledgeRepository.search_code_chunks(),
    which performs case-insensitive ILIKE with proper wildcard escaping,
    version-scoped filtering, deterministic ordering, and database-side LIMIT.

    Score semantics:
        score=1.0 for every match — this is a binary presence indicator,
        not a semantic relevance score.
    """
    def __init__(self, knowledge_repo: KnowledgeRepository) -> None:
        self._knowledge_repo = knowledge_repo

    def retrieve(self, request: RetrievalRequest) -> list[RetrievalResult]:
        rows = self._knowledge_repo.search_code_chunks(
            repository_version_id=request.repository_version_id,
            query=request.query,
            limit=request.limit,
        )

        results: list[RetrievalResult] = []
        for chunk, file in rows:
            results.append(
                RetrievalResult(
                    code_chunk_id=chunk.id,
                    repository_version_id=file.repository_version_id,
                    file_id=file.id,
                    symbol_id=chunk.symbol_id,
                    file_path=file.file_path,
                    content=chunk.content,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    score=1.0,
                    source="keyword",
                )
            )
        return results


class SemanticRetrievalStrategy:
    """
    Semantic vector search over CodeChunk embeddings.

    Delegates query embedding to EmbeddingService (with retry logic but no persistence).
    Delegates the SQL cosine distance vector search to KnowledgeRepository.

    Score semantics:
        score = 1.0 - cosine_distance
        Higher score means more semantically similar.
    """
    def __init__(self, knowledge_repo: KnowledgeRepository, embedding_service: 'app.services.embedding.service.EmbeddingService') -> None:
        self._knowledge_repo = knowledge_repo
        self._embedding_service = embedding_service

    def retrieve(self, request: RetrievalRequest) -> list[RetrievalResult]:
        # Embed the query
        query_vector = self._embedding_service.embed_query(request.query)

        # Search the database
        rows = self._knowledge_repo.search_semantic_chunks(
            repository_version_id=request.repository_version_id,
            query_vector=query_vector,
            limit=request.limit,
        )

        results: list[RetrievalResult] = []
        for chunk, file, distance in rows:
            results.append(
                RetrievalResult(
                    code_chunk_id=chunk.id,
                    repository_version_id=file.repository_version_id,
                    file_id=file.id,
                    symbol_id=chunk.symbol_id,
                    file_path=file.file_path,
                    content=chunk.content,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    score=1.0 - distance,
                    source="semantic",
                )
            )
        return results
