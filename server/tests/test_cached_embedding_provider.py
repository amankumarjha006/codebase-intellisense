import json
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from eval.cached_embedding_provider import CachedEmbeddingProvider, DEFAULT_CACHE_PATH
from app.services.embedding.provider import EmbeddingProvider


def test_default_cache_path_anchored():
    mock_provider = MagicMock(spec=EmbeddingProvider)
    provider = CachedEmbeddingProvider(
        provider=mock_provider,
        model="text-embedding-004",
        dimension=768,
    )
    assert provider.cache_path == DEFAULT_CACHE_PATH
    assert provider.cache_path.is_absolute()
    assert provider.cache_path.name == "query_embeddings_cache.json"


def test_custom_cache_path(tmp_path: Path):
    mock_provider = MagicMock(spec=EmbeddingProvider)
    cache_file = tmp_path / "custom_cache.json"
    provider = CachedEmbeddingProvider(
        provider=mock_provider,
        model="text-embedding-004",
        dimension=768,
        cache_path=str(cache_file),
    )
    assert provider.cache_path == cache_file


def test_embed_caches_and_persists(tmp_path: Path):
    mock_provider = MagicMock(spec=EmbeddingProvider)
    mock_provider.embed.return_value = [[0.1, 0.2], [0.3, 0.4]]
    
    cache_file = tmp_path / "subdir" / "cache.json"
    provider = CachedEmbeddingProvider(
        provider=mock_provider,
        model="text-embedding-004",
        dimension=2,
        cache_path=cache_file,
    )
    
    result = provider.embed(["foo", "bar"])
    assert result == [[0.1, 0.2], [0.3, 0.4]]
    assert mock_provider.embed.call_count == 1
    assert cache_file.exists()

    # Second call should hit the in-memory cache without calling mock_provider again
    result2 = provider.embed(["bar", "foo"])
    assert result2 == [[0.3, 0.4], [0.1, 0.2]]
    assert mock_provider.embed.call_count == 1

    # New provider pointing to the same cache file loads it from disk
    provider2 = CachedEmbeddingProvider(
        provider=mock_provider,
        model="text-embedding-004",
        dimension=2,
        cache_path=cache_file,
    )
    result3 = provider2.embed(["foo"])
    assert result3 == [[0.1, 0.2]]
    assert mock_provider.embed.call_count == 1


def test_corrupted_cache_raises_error(tmp_path: Path):
    cache_file = tmp_path / "corrupted.json"
    cache_file.write_text("invalid json content", encoding="utf-8")
    
    mock_provider = MagicMock(spec=EmbeddingProvider)
    with pytest.raises(ValueError, match="is corrupted"):
        CachedEmbeddingProvider(
            provider=mock_provider,
            model="text-embedding-004",
            dimension=768,
            cache_path=cache_file,
        )
