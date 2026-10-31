import logging
import os
from typing import List, Optional

from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError

logger = logging.getLogger(__name__)


class FastEmbedProvider(EmbeddingProvider):
    """
    Implements the EmbeddingProvider protocol using FastEmbed (ONNX Runtime).
    Runs locally on CPU, highly optimized for memory and speed with zero API costs.
    """

    def __init__(
        self,
        model_name: str = "nomic-ai/nomic-embed-text-v1.5-Q",
        dimension: int = 768,
        threads: Optional[int] = None,
        batch_size: int = 2,
    ):
        self.model_name = model_name
        self.dimension = dimension
        self.batch_size = batch_size
        # Cap CPU threads to leave headroom for OS and UI processes
        cpu_count = os.cpu_count() or 4
        self.threads = threads if threads is not None else max(1, min(cpu_count, 4))
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from fastembed import TextEmbedding

                logger.info(
                    f"Initializing FastEmbed model '{self.model_name}' (threads={self.threads})..."
                )
                self._model = TextEmbedding(
                    model_name=self.model_name,
                    threads=self.threads,
                )
                logger.info(f"FastEmbed model '{self.model_name}' initialized successfully.")
            except Exception as e:
                logger.error(
                    f"Failed to initialize FastEmbed model '{self.model_name}': {e}",
                    exc_info=True,
                )
                raise EmbeddingError(f"Failed to initialize local embedding model: {e}") from e
        return self._model

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        try:
            model = self._get_model()
            # FastEmbed's default batch_size is 256. On long code chunks, passing all texts in
            # one forward pass causes ONNX Runtime self-attention matrices to explode quadratically
            # (e.g. 5+ GB on 64 items), triggering OOM on 8GB RAM machines.
            # Using a conservative micro-batch (batch_size=2) bounds working memory to <150MB.
            embeddings_gen = model.embed(texts, batch_size=self.batch_size)
            vectors = [vec.tolist() for vec in embeddings_gen]

            if len(vectors) != len(texts):
                raise EmbeddingError(
                    f"FastEmbed returned {len(vectors)} embeddings, expected {len(texts)}"
                )

            for vec in vectors:
                if len(vec) != self.dimension:
                    raise EmbeddingError(
                        f"FastEmbed vector dimension mismatch: expected {self.dimension}, got {len(vec)}"
                    )

            return vectors
        except EmbeddingError:
            raise
        except Exception as e:
            logger.error(f"FastEmbed error during embedding generation: {e}", exc_info=True)
            raise EmbeddingError(f"Local embedding generation failed: {e}") from e
