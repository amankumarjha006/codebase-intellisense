import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion
from app.models.knowledge import File, Symbol, CodeChunk, Embedding
from app.repositories.knowledge import KnowledgeRepository
from app.services.embedding.service import EmbeddingService
from tests.services.test_embedding_service import FakeEmbeddingProvider

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

def test_embedding_db_integration_and_cascade(db_session):
    repo = Repository(
        id=uuid4(), owner="test_o", name=f"test_r_{uuid4()}",
        github_repo_id=str(uuid4())[:20], clone_url="http://test", is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="abc", branch="main"
    )
    db_session.add(repo)
    db_session.add(version)
    db_session.flush()

    # Create file
    f = File(
        id=uuid4(), repository_version_id=version.id,
        file_path="src/main.py", file_name="main.py", language="python",
        size_bytes=10, hash="abc"
    )
    db_session.add(f)
    db_session.flush()

    # Create chunk
    c = CodeChunk(
        id=uuid4(), file_id=f.id, content="def main(): pass",
        start_line=1, end_line=1, chunk_index=0
    )
    db_session.add(c)
    db_session.flush()

    # Eager load relationships for text builder
    c.file = f

    # Generate Embeddings
    provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    repo_service = KnowledgeRepository(db_session)
    service = EmbeddingService(repo_service, provider)
    
    stats = service.generate_and_store_embeddings([c])
    assert stats["embeddings_created"] == 1
    db_session.flush()

    # Verify embedding created
    embeddings = db_session.query(Embedding).filter(Embedding.code_chunk_id == c.id).all()
    assert len(embeddings) == 1
    
    emb = embeddings[0]
    assert emb.dimension == settings.EMBEDDING_DIMENSION
    assert emb.provider == settings.EMBEDDING_PROVIDER
    assert emb.model_name == settings.EMBEDDING_MODEL
    
    # In PostgreSQL, vector might be returned as numpy array or list
    assert len(emb.vector) == settings.EMBEDDING_DIMENSION
    
    # Verify cascade deletion! (Idempotency)
    # If the file is re-indexed, its chunks are deleted. This should delete the embedding.
    repo_service.delete_chunks_for_files([f.id])
    db_session.flush()
    
    chunks_after = db_session.query(CodeChunk).filter(CodeChunk.file_id == f.id).all()
    assert len(chunks_after) == 0
    
    embeddings_after = db_session.query(Embedding).filter(Embedding.code_chunk_id == c.id).all()
    assert len(embeddings_after) == 0

def test_embedding_db_transaction_rollback(db_session):
    # Setup base state
    repo = Repository(
        id=uuid4(), owner="test_o2", name=f"test_r2_{uuid4()}",
        github_repo_id=str(uuid4())[:20], clone_url="http://test2", is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="def", branch="main"
    )
    db_session.add(repo)
    db_session.add(version)
    
    f = File(
        id=uuid4(), repository_version_id=version.id,
        file_path="src/fail.py", file_name="fail.py", language="python",
        size_bytes=10, hash="abc"
    )
    db_session.add(f)
    db_session.flush()
    
    # Save a valid rollback point
    db_session.commit()
    
    # --- Start simulated indexing transaction ---
    try:
        c = CodeChunk(
            id=uuid4(), file_id=f.id, content="def fail(): pass",
            start_line=1, end_line=1, chunk_index=0
        )
        db_session.add(c)
        db_session.flush()
        c.file = f
        
        provider = FakeEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
        provider.should_fail = True
        
        repo_service = KnowledgeRepository(db_session)
        service = EmbeddingService(repo_service, provider)
        
        # This will fail
        service.generate_and_store_embeddings([c])
        
        db_session.commit() # Should never reach here
    except Exception:
        db_session.rollback()
        
    # --- Verification ---
    # The chunk we added in the transaction should not exist
    chunks_after = db_session.query(CodeChunk).filter(CodeChunk.file_id == f.id).all()
    assert len(chunks_after) == 0

def test_search_semantic_chunks(db_session):
    repo = Repository(
        id=uuid4(), owner="test_s", name=f"test_s_{uuid4()}",
        github_repo_id=str(uuid4())[:20], clone_url="http://test_s", is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="semantic", branch="main"
    )
    version2 = RepositoryVersion(
        id=uuid4(), repository_id=repo.id, commit_sha="semantic2", branch="main"
    )
    db_session.add(repo)
    db_session.add(version)
    db_session.add(version2)
    db_session.flush()

    f = File(
        id=uuid4(), repository_version_id=version.id,
        file_path="src/match.py", file_name="match.py", language="python",
        size_bytes=10, hash="abc"
    )
    db_session.add(f)
    
    # Another version's file, should not match
    f2 = File(
        id=uuid4(), repository_version_id=version2.id,
        file_path="src/match.py", file_name="match.py", language="python",
        size_bytes=10, hash="abc"
    )
    db_session.add(f2)
    db_session.flush()

    c1 = CodeChunk(id=uuid4(), file_id=f.id, content="def best_match(): pass", start_line=1, end_line=1, chunk_index=0)
    c2 = CodeChunk(id=uuid4(), file_id=f.id, content="def second_match(): pass", start_line=2, end_line=2, chunk_index=1)
    
    # Tie-breaker chunk (same distance, same file, higher chunk index)
    c3 = CodeChunk(id=uuid4(), file_id=f.id, content="def tie_match(): pass", start_line=3, end_line=3, chunk_index=2)
    
    # Chunk in another version
    c4 = CodeChunk(id=uuid4(), file_id=f2.id, content="def another_version(): pass", start_line=1, end_line=1, chunk_index=0)
    
    db_session.add_all([c1, c2, c3, c4])
    db_session.flush()

    # Create manual embeddings
    # Using small dimension for test simplicity, but schema expects 768
    def make_vec(val):
        v = [0.0] * settings.EMBEDDING_DIMENSION
        v[0] = val
        return v
        
    e1 = Embedding(code_chunk_id=c1.id, vector=make_vec(1.0), provider="test", model_name="test")
    e2 = Embedding(code_chunk_id=c2.id, vector=make_vec(0.5), provider="test", model_name="test")
    e3 = Embedding(code_chunk_id=c3.id, vector=make_vec(0.5), provider="test", model_name="test")
    e4 = Embedding(code_chunk_id=c4.id, vector=make_vec(1.0), provider="test", model_name="test")
    
    db_session.add_all([e1, e2, e3, e4])
    db_session.flush()

    repo_service = KnowledgeRepository(db_session)
    
    query_vec = make_vec(1.0)
    
    results = repo_service.search_semantic_chunks(version.id, query_vec, limit=10)
    
    # Should only return chunks from version 1
    assert len(results) == 3
    
    # Check ordering: cosine distance ASC
    # Cosine distance between [1.0, 0...] and [1.0, 0...] is 0
    # Cosine distance between [1.0, 0...] and [0.5, 0...] is 0 (since they are parallel), wait.
    # Actually, pgvector cosine distance: 1 - cosine_similarity.
    # If they are parallel, similarity is 1, distance is 0.
    
    # Since all vectors are parallel [X, 0, 0...], they all have distance 0.
    # Therefore, tie-breaking logic applies: file_path ASC, chunk_index ASC, code_chunk_id ASC
    
    assert results[0][0].id == c1.id
    assert results[1][0].id == c2.id
    assert results[2][0].id == c3.id
    
    # Let's make an explicitly distant vector
    query_vec_diff = make_vec(0.0)
    query_vec_diff[1] = 1.0 # orthogonal vector
    
    results_diff = repo_service.search_semantic_chunks(version.id, query_vec_diff, limit=10)
    assert len(results_diff) == 3
    assert results_diff[0][2] >= 0.0 # cosine distance
    
