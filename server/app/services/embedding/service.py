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
        self.batch_size = settings.EMBEDDING_BATCH_SIZE
        self.max_retries = settings.EMBEDDING_MAX_RETRIES

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
        
        # We process chunks in batches
        for i in range(0, len(chunks), self.batch_size):
            batch_chunks = chunks[i:i + self.batch_size]
            
            # 1. Build deterministic texts
            texts = [ChunkEmbeddingTextBuilder.build(chunk) for chunk in batch_chunks]
            
            # 2. Call provider with retries
            vectors = self._embed_with_retry(texts)
            
            # 3. Create Embedding records
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
                
            # 4. Persist (without committing)
            self.knowledge_repo.bulk_create_embeddings(embedding_records)
            embeddings_created += len(embedding_records)
            
            logger.info(f"Persisted {len(embedding_records)} embeddings for current batch")

        return {"embeddings_created": embeddings_created}

    def _embed_with_retry(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a list of texts with bounded exponential backoff for transient errors.
        """
        attempt = 0
        while True:
            try:
                attempt += 1
                return self.provider.embed(texts)
            except EmbeddingError as e:
                # Basic transient error detection: we only retry if it feels transient.
                # Since EmbeddingError wrappers provider-specific errors, we look for clues
                # like 429, 500, 503, "timeout", "rate limit"
                err_msg = str(e).lower()
                is_transient = any(keyword in err_msg for keyword in ["429", "500", "502", "503", "504", "timeout", "rate limit", "temporarily", "unavailable"])
                
                if not is_transient or attempt > self.max_retries:
                    logger.error(f"Embedding provider failed permanently or max retries exceeded: {str(e)}")
                    raise
                    
                backoff_time = 2 ** attempt
                logger.warning(f"Transient embedding error (attempt {attempt}/{self.max_retries}). Retrying in {backoff_time}s: {str(e)}")
                time.sleep(backoff_time)

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
