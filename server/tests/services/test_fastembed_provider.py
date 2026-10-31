import pytest
from app.core.config import Settings
from app.services.embedding.fastembed import FastEmbedProvider
from app.services.embedding.factory import get_embedding_provider
from app.services.indexing import EmbeddingError


def test_fastembed_provider_init():
    provider = FastEmbedProvider(
        model_name="nomic-ai/nomic-embed-text-v1.5-Q",
        dimension=768,
        threads=2,
    )
    assert provider.model_name == "nomic-ai/nomic-embed-text-v1.5-Q"
    assert provider.dimension == 768
    assert provider.threads == 2


def test_fastembed_provider_empty():
    provider = FastEmbedProvider()
    assert provider.embed([]) == []


def test_fastembed_provider_embed_real():
    provider = FastEmbedProvider(model_name="nomic-ai/nomic-embed-text-v1.5-Q", dimension=768)
    texts = [
        "def add(a: int, b: int) -> int:\n    return a + b",
        "class KnowledgeRepository:\n    def get_by_id(self, id): pass"
    ]
    vectors = provider.embed(texts)
    assert len(vectors) == 2
    assert len(vectors[0]) == 768
    assert len(vectors[1]) == 768
    assert isinstance(vectors[0][0], float)


def test_fastembed_factory():
    settings = Settings(
        EMBEDDING_PROVIDER="fastembed",
        EMBEDDING_MODEL="nomic-ai/nomic-embed-text-v1.5-Q",
        EMBEDDING_DIMENSION=768,
    )
    provider = get_embedding_provider(settings)
    assert isinstance(provider, FastEmbedProvider)

    # Test alias 'local'
    settings_local = Settings(
        EMBEDDING_PROVIDER="local",
        EMBEDDING_MODEL="nomic-ai/nomic-embed-text-v1.5-Q",
        EMBEDDING_DIMENSION=768,
    )
    provider_local = get_embedding_provider(settings_local)
    assert isinstance(provider_local, FastEmbedProvider)


def test_fastembed_dimension_mismatch(monkeypatch):
    provider = FastEmbedProvider(dimension=512)  # mismatched with 768 model
    with pytest.raises(EmbeddingError) as exc_info:
        provider.embed(["test text"])
    assert "dimension mismatch" in str(exc_info.value)

