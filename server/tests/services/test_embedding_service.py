import pytest
import time
import requests
from unittest.mock import patch, MagicMock

from google.genai.errors import APIError
from app.models.knowledge import CodeChunk, File, Symbol
from app.services.embedding.text_builder import ChunkEmbeddingTextBuilder
from app.services.embedding.service import EmbeddingService
from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError
from app.core.config import settings
from app.services.embedding.gemini import GeminiEmbeddingProvider
from app.services.embedding.exceptions import (
    EmbeddingProviderError,
    EmbeddingProviderRateLimitError,
    EmbeddingProviderTimeoutError,
    EmbeddingProviderConnectionError,
    EmbeddingProviderServerError,
    EmbeddingProviderClientError,
    EmbeddingProviderAuthError
)
from app.schemas.repository import IndexJobOut

class FakeEmbeddingProvider(EmbeddingProvider):
    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self.calls = []
        self.should_fail_with = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        if self.should_fail_with:
            raise self.should_fail_with
        return [[float(len(text))] * self.dimension for text in texts]

class FakeKnowledgeRepository:
    def __init__(self):
        self.embeddings = []

    def bulk_create_embeddings(self, embeddings):
        self.embeddings.extend(embeddings)
        return embeddings

def test_text_builder_deterministic():
    f = File(file_path="src/test.py", language="python")
    s = Symbol(name="my_func", symbol_type="function")
    c = CodeChunk(file=f, symbol=s, start_line=10, end_line=15, content="def my_func():\n    pass")
    
    text1 = ChunkEmbeddingTextBuilder.build(c)
    text2 = ChunkEmbeddingTextBuilder.build(c)
    
    assert text1 == text2

def test_embedding_service_batching():
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    # Configure tight limits for testing
    service.max_batch_items = 2
    service.max_batch_tokens = 100
    
    from uuid import uuid4
    chunks = []
    # 5 chunks. Each content is 30 characters -> ~10 tokens.
    # Total tokens per chunk = 10. Max tokens 100. So max items 2 will trigger first.
    for i in range(5):
        f = File(file_path=f"src/file_{i}.py", language="python")
        c = CodeChunk(id=uuid4(), file=f, start_line=1, end_line=2, content="a" * 30)
        chunks.append(c)
        
    stats = service.generate_and_store_embeddings(chunks)
    
    assert stats["embeddings_created"] == 5
    assert len(provider.calls) == 3
    assert len(provider.calls[0]) == 2
    assert len(provider.calls[1]) == 2
    assert len(provider.calls[2]) == 1
    
@patch("time.sleep")
def test_embedding_service_retry(mock_sleep):
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    provider.should_fail_with = EmbeddingProviderServerError("500 Internal Server Error")
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    service.max_retries = 2
    
    from uuid import uuid4
    c = CodeChunk(id=uuid4(), content="test")
    
    with pytest.raises(EmbeddingProviderServerError):
        service.generate_and_store_embeddings([c])
        
    assert len(provider.calls) == 3
    assert mock_sleep.call_count == 2

@patch("time.sleep")
def test_embedding_service_retry_with_retry_after(mock_sleep):
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    provider.should_fail_with = EmbeddingProviderRateLimitError("429 Too Many Requests", retry_after=10.0)
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    
    from uuid import uuid4
    c = CodeChunk(id=uuid4(), content="test")
    
    with pytest.raises(EmbeddingProviderRateLimitError):
        service.generate_and_store_embeddings([c])

    # Check that sleep was called with delay > 10.0 (due to jitter)
    for call in mock_sleep.call_args_list:
        delay = call[0][0]
        assert delay >= 10.0

def test_gemini_error_classification():
    provider = GeminiEmbeddingProvider(api_key="test", model="test", dimension=768)
    
    # Test Timeout
    with pytest.raises(EmbeddingProviderTimeoutError):
        with patch.object(provider, 'client') as mock_client:
            mock_client.models.embed_content.side_effect = requests.exceptions.Timeout("timeout")
            provider.embed(["test"])

    # Test ConnectionError
    with pytest.raises(EmbeddingProviderConnectionError):
        with patch.object(provider, 'client') as mock_client:
            mock_client.models.embed_content.side_effect = requests.exceptions.ConnectionError("conn error")
            provider.embed(["test"])

    # Test 429 APIError with header
    mock_resp = MagicMock(spec=requests.Response)
    mock_resp.status_code = 429
    mock_resp.headers = {"Retry-After": "15"}
    
    with pytest.raises(EmbeddingProviderRateLimitError) as exc_info:
        with patch.object(provider, 'client') as mock_client:
            mock_client.models.embed_content.side_effect = APIError(429, mock_resp)
            provider.embed(["test"])
    assert exc_info.value.retry_after == 15.0

    # Test 503 APIError
    mock_resp_503 = MagicMock(spec=requests.Response)
    mock_resp_503.status_code = 503
    with pytest.raises(EmbeddingProviderServerError):
        with patch.object(provider, 'client') as mock_client:
            mock_client.models.embed_content.side_effect = APIError(503, mock_resp_503)
            provider.embed(["test"])

def test_index_job_out_sanitization():
    # Legacy row with null failure_code should map to INTERNAL_ERROR
    from datetime import datetime
    import uuid
    
    job = IndexJobOut.model_validate({
        "id": uuid.uuid4(),
        "repository_id": uuid.uuid4(),
        "repository_version_id": uuid.uuid4(),
        "status": "FAILED",
        "started_at": datetime.now(),
        "completed_at": datetime.now(),
        "failure_code": None
    })
    
    assert job.failure_code == "INTERNAL_ERROR"
    assert "internal error" in job.failure_message.lower()

    # Rate limit code mapping
    job2 = IndexJobOut.model_validate({
        "id": uuid.uuid4(),
        "repository_id": uuid.uuid4(),
        "repository_version_id": uuid.uuid4(),
        "status": "FAILED",
        "started_at": datetime.now(),
        "completed_at": datetime.now(),
        "failure_code": "EMBEDDING_PROVIDER_RATE_LIMITED"
    })

    assert job2.failure_code == "EMBEDDING_PROVIDER_RATE_LIMITED"
    assert "rate limit" in job2.failure_message.lower()
