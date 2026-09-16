from app.core.config import Settings
from app.services.embedding.provider import EmbeddingProvider
from app.services.embedding.gemini import GeminiEmbeddingProvider

def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """
    Factory to retrieve the appropriate embedding provider.
    """
    if settings.EMBEDDING_PROVIDER == "google":
        return GeminiEmbeddingProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION
        )
    raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")
