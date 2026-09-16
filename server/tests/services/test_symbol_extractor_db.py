"""
Genuine Database Transaction Rollback Test for Symbol Extraction

This test uses a real PostgreSQL database session to verify that a failure
during symbol insertion correctly rolls back the transaction, preserving
previously existing symbols (no orphaned deletions).
"""
import pytest
import os
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User
from app.models.repository import Repository, RepositoryVersion
from app.models.knowledge import File, Symbol
from app.repositories.knowledge import KnowledgeRepository
from app.services.symbol_extractor.service import SymbolExtractorService

# Setup test DB engine (requires codebase_postgres container running)
# We use the same URL from settings
engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    """Provides a real database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback() # Ensure cleanup
        session.close()

def create_mock_source_file(tmp_path) -> str:
    """Creates a temporary Python file to act as the source to parse."""
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    py_file = repo_root / "main.py"
    py_file.write_text("def new_func(): pass")
    return str(repo_root)

def test_symbol_extraction_db_rollback(db_session, tmp_path, monkeypatch):
    """
    Test that if symbol extraction fails during bulk insert, the transaction
    is rolled back, meaning the initial deletion of the old symbol is also
    rolled back, leaving the old symbol safely intact in the database.
    """
    # 1. Setup real records in the DB
    user = User(email=f"test_{uuid4()}@example.com", full_name="Test User")
    db_session.add(user)
    db_session.commit()

    repo = Repository(
        owner="testowner", 
        name=f"testrepo_{uuid4()}", 
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/testrepo.git",
        is_private=False
    )
    db_session.add(repo)
    db_session.commit()

    version = RepositoryVersion(repository_id=repo.id, commit_sha="abc1234", branch="main", index_status="SUCCESS")
    db_session.add(version)
    db_session.commit()

    file = File(
        repository_version_id=version.id,
        file_path="main.py",
        file_name="main.py",
        language="python",
        size_bytes=100,
        hash="testhash"
    )
    db_session.add(file)
    db_session.commit()

    # Create an old symbol that should SURVIVE the rollback
    old_symbol = Symbol(
        file_id=file.id,
        name="old_func",
        qualified_name="old_func",
        symbol_type="function",
        start_line=1,
        end_line=2
    )
    db_session.add(old_symbol)
    db_session.commit()

    repo_root = create_mock_source_file(tmp_path)
    
    # 2. Start Extraction Phase
    knowledge_repo = KnowledgeRepository(db_session)
    service = SymbolExtractorService(knowledge_repo, repo_root)

    # We want to simulate a failure during the INSERT phase of extraction
    # The extractor does: DELETE old symbols -> PARSE -> INSERT new symbols
    
    # We monkeypatch the bulk_create_symbols method on the *instance* of KnowledgeRepository
    # to raise an error when it tries to insert the new 'new_func' symbol.
    original_bulk_create = knowledge_repo.bulk_create_symbols
    
    def failing_bulk_create(symbols):
        # We simulate that the DB flush failed during insert
        raise RuntimeError("Forced DB Insert Failure")
        
    monkeypatch.setattr(knowledge_repo, "bulk_create_symbols", failing_bulk_create)

    # 3. Execute extraction (will fail)
    with pytest.raises(RuntimeError, match="Forced DB Insert Failure"):
        # The caller (indexing service) is responsible for commit/rollback.
        # Since an exception is raised, the caller would catch it and rollback.
        try:
            service.extract_symbols(version, [file])
            db_session.commit() # Should never reach here
        except Exception:
            db_session.rollback() # Caller rolls back the transaction
            raise

    # 4. Verify rollback
    # The old symbol MUST still exist because the DELETE was rolled back
    surviving_symbols = db_session.query(Symbol).filter(Symbol.file_id == file.id).all()
    assert len(surviving_symbols) == 1, "Old symbol was lost!"
    assert surviving_symbols[0].name == "old_func", "Old symbol name mismatch"

def test_symbol_extraction_idempotency(db_session, tmp_path):
    """
    Test real idempotency. If we run extraction twice on the same file,
    the old symbols are deleted and new ones are inserted.
    """
    repo_root = tmp_path / "repo2"
    repo_root.mkdir()
    py_file = repo_root / "main.py"
    
    # Run 1
    py_file.write_text("def first_func(): pass")
    
    user = User(email=f"test_{uuid4()}@example.com", full_name="Test User")
    db_session.add(user)
    db_session.commit()
    
    repo = Repository(
        owner="testowner", 
        name=f"testrepo_{uuid4()}", 
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/testrepo2.git",
        is_private=False
    )
    db_session.add(repo)
    db_session.flush()
    version = RepositoryVersion(repository_id=repo.id, commit_sha="abc1234", branch="main", index_status="SUCCESS")
    db_session.add(version)
    db_session.commit()

    file = File(
        repository_version_id=version.id,
        file_path="main.py",
        file_name="main.py",
        language="python",
        size_bytes=100,
        hash="testhash"
    )
    db_session.add(file)
    db_session.commit()
    
    knowledge_repo = KnowledgeRepository(db_session)
    service = SymbolExtractorService(knowledge_repo, str(repo_root))
    
    # Execute first extraction
    service.extract_symbols(version, [file])
    db_session.commit()
    
    symbols1 = db_session.query(Symbol).filter(Symbol.file_id == file.id).all()
    assert len(symbols1) == 1
    assert symbols1[0].name == "first_func"
    
    # Run 2: File changed
    py_file.write_text("def second_func(): pass")
    
    # Execute second extraction
    service.extract_symbols(version, [file])
    db_session.commit()
    
    symbols2 = db_session.query(Symbol).filter(Symbol.file_id == file.id).all()
    assert len(symbols2) == 1
    assert symbols2[0].name == "second_func"
    # Ensure first_func is gone
    assert not any(s.name == "first_func" for s in symbols2)
