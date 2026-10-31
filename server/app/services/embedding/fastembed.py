import logging
import os
from typing import List, Optional, Tuple

from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError

logger = logging.getLogger(__name__)


def detect_execution_providers() -> Tuple[List[str], bool]:
    """
    Detects whether an NVIDIA or DirectX 12 GPU is available in ONNX Runtime.
    Returns (providers_list, is_gpu_enabled).
    """
    try:
        import onnxruntime as ort

        available = ort.get_available_providers()
        # 1. Check for DirectML (DirectX 12 on Windows - works with NVIDIA RTX 2050 without CUDA toolkit setup)
        if "DmlExecutionProvider" in available:
            logger.info("FastEmbed: NVIDIA / DirectX 12 GPU detected via DmlExecutionProvider.")
            return ["DmlExecutionProvider", "CPUExecutionProvider"], True

        # 2. Check for CUDA
        if "CUDAExecutionProvider" in available:
            logger.info("FastEmbed: NVIDIA GPU detected via CUDAExecutionProvider.")
            return ["CUDAExecutionProvider", "CPUExecutionProvider"], True

    except Exception as e:
        logger.warning(f"FastEmbed: Error detecting GPU execution providers: {e}")

    logger.info("FastEmbed: No GPU provider detected in onnxruntime, using CPUExecutionProvider.")
    return ["CPUExecutionProvider"], False


class FastEmbedProvider(EmbeddingProvider):
    """
    Implements the EmbeddingProvider protocol using FastEmbed (ONNX Runtime).
    Automatically leverages NVIDIA GPU (DirectML or CUDA) if available,
    falling back safely to multithreaded CPU execution.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-base-en-v1.5",
        dimension: int = 768,
        threads: Optional[int] = None,
        batch_size: Optional[int] = None,
    ):
        self.model_name = model_name
        self.dimension = dimension
        self.providers, self.is_gpu = detect_execution_providers()

        # On GPU, batch_size=8 maximizes tensor-core throughput within 4GB VRAM.
        # On CPU, batch_size=2 prevents self-attention buffer bloat on 8GB RAM PCs.
        if batch_size is not None:
            self.batch_size = batch_size
        else:
            self.batch_size = 8 if self.is_gpu else 2

        # Cap CPU threads to leave headroom for OS and UI processes
        cpu_count = os.cpu_count() or 4
        self.threads = threads if threads is not None else max(1, min(cpu_count, 4))
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from fastembed import TextEmbedding

                logger.info(
                    f"Initializing FastEmbed model '{self.model_name}' "
                    f"(GPU={self.is_gpu}, providers={self.providers}, batch_size={self.batch_size}, threads={self.threads})..."
                )
                self._model = TextEmbedding(
                    model_name=self.model_name,
                    threads=self.threads,
                    providers=self.providers,
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
