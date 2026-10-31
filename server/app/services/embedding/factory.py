from app.core.config import Settings
from app.services.embedding.provider import EmbeddingProvider
from app.services.embedding.gemini import GeminiEmbeddingProvider
from app.services.embedding.fastembed import FastEmbedProvider


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """
    Factory to retrieve the appropriate embedding provider.
    """
    provider_name = settings.EMBEDDING_PROVIDER.lower()
    if provider_name == "google":
        return GeminiEmbeddingProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    elif provider_name in ("fastembed", "local"):
        return FastEmbedProvider(
            model_name=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")
