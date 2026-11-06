from typing import Dict, Tuple, Any
from app.core.config import Settings
from app.services.embedding.provider import EmbeddingProvider
from app.services.embedding.gemini import GeminiEmbeddingProvider
from app.services.embedding.fastembed import FastEmbedProvider

_cached_providers: Dict[Tuple[Any, ...], EmbeddingProvider] = {}


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """
    Factory to retrieve the appropriate embedding provider.
    Reuses instances to avoid reloading ONNX models on every request.
    """
    provider_name = settings.EMBEDDING_PROVIDER.lower()
    cache_key = (
        provider_name,
        getattr(settings, "EMBEDDING_MODEL", None),
        getattr(settings, "EMBEDDING_DIMENSION", None),
        getattr(settings, "GEMINI_API_KEY", None) if provider_name == "google" else None,
    )
    if cache_key in _cached_providers:
        return _cached_providers[cache_key]

    if provider_name == "google":
        provider = GeminiEmbeddingProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    elif provider_name in ("fastembed", "local"):
        provider = FastEmbedProvider(
            model_name=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    else:
        raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")

    _cached_providers[cache_key] = provider
    return provider
