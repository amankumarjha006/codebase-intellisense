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
from app.services.indexing import EmbeddingError



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
    Lexical search over CodeChunk content.

    Delegates the actual SQL query to KnowledgeRepository.search_code_chunks(),
    which combines exact substring matching (ILIKE) with PostgreSQL Full-Text Search.

    Score semantics:
        score = (1.0 if exact_match else 0.0) + ts_rank_cd
        Higher score means more lexically relevant. Exact matches are boosted above
        pure FTS matches.
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
        for chunk, file, score in rows:
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
                    chunk_index=chunk.chunk_index,
                    score=score,
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
                    chunk_index=chunk.chunk_index,
                    score=1.0 - distance,
                    source="semantic",
                )
            )
        return results


class HybridRetrievalStrategy:
    """
    Hybrid retrieval using Reciprocal Rank Fusion (RRF) over keyword and semantic strategies.
    
    Gracefully degrades to keyword-only retrieval if semantic retrieval fails.
    """
    def __init__(
        self,
        keyword_strategy: KeywordRetrievalStrategy,
        semantic_strategy: SemanticRetrievalStrategy,
        rrf_k: int = 60,
        candidate_limit: int = 50,
    ) -> None:
        self._keyword_strategy = keyword_strategy
        self._semantic_strategy = semantic_strategy
        self._rrf_k = rrf_k
        self._candidate_limit = candidate_limit

    def retrieve(self, request: RetrievalRequest) -> list[RetrievalResult]:
        import logging
        logger = logging.getLogger(__name__)

        candidate_request = RetrievalRequest(
            repository_version_id=request.repository_version_id,
            query=request.query,
            limit=self._candidate_limit,
        )

        keyword_candidates = self._keyword_strategy.retrieve(candidate_request)
        
        try:
            semantic_candidates = self._semantic_strategy.retrieve(candidate_request)
        except EmbeddingError as e:
            logger.warning(f"Semantic retrieval failed, falling back to keyword-only: {e}")
            semantic_candidates = []

        if not keyword_candidates and not semantic_candidates:
            return []

        # RRF Fusion
        rrf_scores: dict[str, float] = {}
        chunks_by_id: dict[str, RetrievalResult] = {}

        # 1-based ranks
        for rank, res in enumerate(keyword_candidates, start=1):
            chunk_id = str(res.code_chunk_id)
            chunks_by_id[chunk_id] = res
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (self._rrf_k + rank)

        for rank, res in enumerate(semantic_candidates, start=1):
            chunk_id = str(res.code_chunk_id)
            if chunk_id not in chunks_by_id:
                chunks_by_id[chunk_id] = res
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (self._rrf_k + rank)

        # Reconstruct results
        fused_results: list[RetrievalResult] = []
        for chunk_id, score in rrf_scores.items():
            base_res = chunks_by_id[chunk_id]
            fused_results.append(
                RetrievalResult(
                    code_chunk_id=base_res.code_chunk_id,
                    repository_version_id=base_res.repository_version_id,
                    file_id=base_res.file_id,
                    symbol_id=base_res.symbol_id,
                    file_path=base_res.file_path,
                    content=base_res.content,
                    start_line=base_res.start_line,
                    end_line=base_res.end_line,
                    chunk_index=base_res.chunk_index,
                    score=score,
                    source="hybrid"
                )
            )

        # Deterministic sorting
        fused_results.sort(
            key=lambda x: (
                -x.score, 
                x.file_path, 
                x.chunk_index,
                str(x.code_chunk_id)
            )
        )

        return fused_results[:request.limit]
