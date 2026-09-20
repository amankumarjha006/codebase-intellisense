import pytest
from app.models.knowledge import CodeChunk, File, Symbol
from app.services.embedding.text_builder import ChunkEmbeddingTextBuilder
from app.services.embedding.service import EmbeddingService
from app.services.embedding.provider import EmbeddingProvider
from app.services.indexing import EmbeddingError
from app.core.config import settings

class FakeEmbeddingProvider(EmbeddingProvider):
    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self.calls = []
        self.should_fail = False

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        if self.should_fail:
            raise EmbeddingError("Fake transient error: 503 Service Unavailable")
        
        # Return a deterministic vector for each text
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
    assert "File: src/test.py" in text1
    assert "Language: python" in text1
    assert "Symbol: my_func" in text1
    assert "def my_func():\n    pass" in text1

def test_embedding_service_batching():
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    
    from uuid import uuid4
    # Let's test with 65 chunks
    chunks = []
    for i in range(65):
        f = File(file_path=f"src/file_{i}.py", language="python")
        c = CodeChunk(id=uuid4(), file=f, start_line=1, end_line=2, content=f"content {i}")
        chunks.append(c)
        
    stats = service.generate_and_store_embeddings(chunks)
    
    assert stats["embeddings_created"] == 65
    
    # 65 chunks with batch_size 32 should result in 3 batches: 32, 32, 1
    assert len(provider.calls) == 3
    assert len(provider.calls[0]) == 32
    assert len(provider.calls[1]) == 32
    assert len(provider.calls[2]) == 1
    
    assert len(repo.embeddings) == 65

def test_embedding_service_retry():
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    provider.should_fail = True
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    
    from uuid import uuid4
    c = CodeChunk(id=uuid4(), content="test")
    
    # Should retry up to MAX_RETRIES then fail
    with pytest.raises(EmbeddingError):
        service.generate_and_store_embeddings([c])
        
    # initial call + max_retries
    assert len(provider.calls) == 1 + settings.EMBEDDING_MAX_RETRIES

def test_embedding_service_embed_query():
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    
    query = "test search query"
    vector = service.embed_query(query)
    
    # Provider returns [len(text)] * dimension
    assert len(vector) == settings.EMBEDDING_DIMENSION
    assert vector[0] == float(len(query))
    assert len(provider.calls) == 1
    assert provider.calls[0] == [query]
    
    # Verify no embeddings were persisted
    assert len(repo.embeddings) == 0

def test_embedding_service_embed_query_retry():
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    provider.should_fail = True
    repo = FakeKnowledgeRepository()
    service = EmbeddingService(repo, provider)
    
    query = "test query"
    
    with pytest.raises(EmbeddingError):
        service.embed_query(query)
        
    assert len(provider.calls) == 1 + settings.EMBEDDING_MAX_RETRIES

def test_gemini_provider_lazy_init():
    from app.services.embedding.gemini import GeminiEmbeddingProvider
    
    # Construction should succeed even with empty key
    provider = GeminiEmbeddingProvider(api_key="", model="test-model", dimension=768)
    
    # embed should raise EmbeddingError, not ValueError
    with pytest.raises(EmbeddingError) as exc_info:
        provider.embed(["test text"])
        
    assert "GEMINI_API_KEY must be provided" in str(exc_info.value)
