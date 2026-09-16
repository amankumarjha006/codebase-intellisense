import pytest
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.repository import Repository, RepositoryVersion
from app.models.knowledge import File, Symbol, CodeChunk
from app.repositories.knowledge import KnowledgeRepository
from app.services.chunking import ChunkBuilderService
from app.core.config import settings

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    """Provides a real database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

def test_chunk_builder_idempotency(db_session, tmp_path):
    # Setup test data
    repo = Repository(
        id=uuid4(),
        owner="testowner", 
        name=f"testrepo_{uuid4()}", 
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/testrepo.git",
        is_private=False
    )
    version = RepositoryVersion(
        id=uuid4(),
        repository_id=repo.id,
        commit_sha="abc1234567890",
        branch="main"
    )
    db_session.add(repo)
    db_session.add(version)
    db_session.flush()
    
    file_id = uuid4()
    file = File(
        id=file_id,
        repository_version_id=version.id,
        file_path="src/main.py",
        file_name="main.py",
        language="python",
        size_bytes=100,
        hash="hash123"
    )
    db_session.add(file)
    db_session.flush()
    
    # Mock source content to parse
    src_dir = tmp_path / "src"
    src_dir.mkdir(parents=True)
    main_py = src_dir / "main.py"
    main_py.write_bytes(b"def foo():\n    pass\n")

    knowledge_repo = KnowledgeRepository(db_session)
    service = ChunkBuilderService(knowledge_repo, repo_path=str(tmp_path))
    
    # Run once
    stats1 = service.build_chunks(version, [file])
    db_session.flush()
    
    chunks1 = db_session.query(CodeChunk).filter(CodeChunk.file_id == file_id).all()
    assert len(chunks1) > 0
    assert stats1["chunks_created"] == len(chunks1)
    
    chunk_ids = {c.id for c in chunks1}
    
    # Run again (Idempotency check)
    stats2 = service.build_chunks(version, [file])
    db_session.flush()
    
    chunks2 = db_session.query(CodeChunk).filter(CodeChunk.file_id == file_id).all()
    assert len(chunks2) == len(chunks1)
    
    # New IDs should be generated because chunks were deleted and recreated
    new_chunk_ids = {c.id for c in chunks2}
    assert chunk_ids.isdisjoint(new_chunk_ids)
    
    # Content should be the same
    assert chunks1[0].content == chunks2[0].content
    assert chunks1[0].start_line == chunks2[0].start_line
    assert chunks1[0].chunk_index == chunks2[0].chunk_index
