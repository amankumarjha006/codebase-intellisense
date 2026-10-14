import logging
import time
from typing import List, Any
from app.models.knowledge import CodeChunk, Embedding
from app.repositories.knowledge import KnowledgeRepository
from app.services.embedding.provider import EmbeddingProvider
from app.services.embedding.text_builder import ChunkEmbeddingTextBuilder
from app.core.config import settings
from app.services.indexing import EmbeddingError

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Orchestrates the generation and persistence of embeddings for CodeChunks.
    Uses the configured EmbeddingProvider to generate vectors in batches.
    Does NOT manage transactions (caller must commit).
    """
    def __init__(self, knowledge_repo: KnowledgeRepository, provider: EmbeddingProvider):
        self.knowledge_repo = knowledge_repo
        self.provider = provider
        self.max_batch_items = settings.EMBEDDING_MAX_BATCH_ITEMS
        self.max_batch_tokens = settings.EMBEDDING_MAX_BATCH_TOKENS
        self.max_retries = settings.EMBEDDING_MAX_RETRIES

    def _estimate_tokens(self, text: str) -> int:
        """
        Heuristic for estimating tokens.
        A conservative estimate is 1 token per 3-4 characters. We use 3 for safety.
        """
        return max(1, len(text) // 3)

    def generate_and_store_embeddings(self, chunks: List[CodeChunk]) -> dict[str, int]:
        """
        Generate and persist embeddings for the given chunks.
        Idempotency rule: the provided chunks should be new or those requiring embedding.
        If chunks were just recreated by ChunkBuilderService, their old embeddings were
        automatically cascade-deleted by PostgreSQL.
        """
        if not chunks:
            return {"embeddings_created": 0}

        embeddings_created = 0
        
        # Token-aware batching
        batches = []
        current_batch = []
        current_tokens = 0

        for chunk in chunks:
            text = ChunkEmbeddingTextBuilder.build(chunk)
            tokens = self._estimate_tokens(text)
            
            if current_batch and (len(current_batch) >= self.max_batch_items or current_tokens + tokens > self.max_batch_tokens):
                batches.append(current_batch)
                current_batch = []
                current_tokens = 0

            current_batch.append((chunk, text, tokens))
            current_tokens += tokens

        if current_batch:
            batches.append(current_batch)

        total_batches = len(batches)

        for i, batch in enumerate(batches):
            batch_num = i + 1
            batch_chunks = [item[0] for item in batch]
            texts = [item[1] for item in batch]
            total_tokens = sum(item[2] for item in batch)
            
            logger.info(f"Processing embedding batch {batch_num}/{total_batches} (items: {len(batch_chunks)}, estimated_tokens: {total_tokens})")
            
            # Call provider with retries
            vectors = self._embed_with_retry(texts, batch_num, total_batches)

            # Create Embedding records
            embedding_records = []
            for chunk, vector in zip(batch_chunks, vectors):
                record = Embedding(
                    code_chunk_id=chunk.id,
                    vector=vector,
                    provider=settings.EMBEDDING_PROVIDER,
                    model_name=settings.EMBEDDING_MODEL,
                    dimension=settings.EMBEDDING_DIMENSION
                )
                embedding_records.append(record)
                
            # Persist (without committing)
            self.knowledge_repo.bulk_create_embeddings(embedding_records)
            embeddings_created += len(embedding_records)
            
            if settings.EMBEDDING_MIN_INTERVAL_SECONDS > 0:
                time.sleep(settings.EMBEDDING_MIN_INTERVAL_SECONDS)

        return {"embeddings_created": embeddings_created}

    def _embed_with_retry(self, texts: List[str], batch_num: int = 1, total_batches: int = 1) -> List[List[float]]:
        """
        Embeds a list of texts with bounded exponential backoff for transient errors.
        Handles rate limits (429) using Retry-After, and backs off on 5xx and timeouts.
        """
        import random
        from app.services.embedding.exceptions import (
            EmbeddingProviderRateLimitError,
            EmbeddingProviderTimeoutError,
            EmbeddingProviderConnectionError,
            EmbeddingProviderServerError
        )

        attempt = 0
        max_attempts = 1 + self.max_retries
        base_delay = 2.0

        while True:
            attempt += 1
            try:
                return self.provider.embed(texts)
            except Exception as e:
                is_transient = isinstance(e, (
                    EmbeddingProviderRateLimitError,
                    EmbeddingProviderTimeoutError,
                    EmbeddingProviderConnectionError,
                    EmbeddingProviderServerError
                ))
                
                if not is_transient or attempt >= max_attempts:
                    logger.error(
                        f"Embedding provider failed on batch {batch_num}/{total_batches} "
                        f"(attempt {attempt}/{max_attempts}, transient: {is_transient}): {e.__class__.__name__} - {str(e)}"
                    )
                    raise

                # Determine backoff
                delay = base_delay * (2 ** (attempt - 1))
                if isinstance(e, EmbeddingProviderRateLimitError):
                    # Provider rate limits (e.g. Gemini 60s quota windows) need longer backoff
                    delay = max(delay, 12.0 * attempt)
                    if e.retry_after is not None:
                        delay = max(delay, e.retry_after)

                # Add jitter
                delay = min(delay, 60.0)
                jitter = delay * random.uniform(0.1, 0.3)
                final_delay = delay + jitter

                logger.warning(
                    f"Transient error on batch {batch_num}/{total_batches} (attempt {attempt}/{max_attempts}). "
                    f"Retrying in {final_delay:.1f}s. Exception: {e.__class__.__name__} - {str(e)}"
                )
                time.sleep(final_delay)

    def embed_query(self, text: str) -> List[float]:
        """
        Embeds a single query string and returns its vector.
        Does NOT persist the embedding to the database.
        Reuses the exponential backoff retry mechanism.
        """
        vectors = self._embed_with_retry([text])
        if not vectors:
            raise EmbeddingError("Provider returned empty vector list for query")
        return vectors[0]
