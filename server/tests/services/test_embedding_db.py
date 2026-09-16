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
