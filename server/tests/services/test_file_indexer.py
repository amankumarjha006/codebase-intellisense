import pytest
import os
import shutil
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.services.file_indexer import RepositoryFileIndexer
from app.models.repository import RepositoryVersion, Repository
from app.models.knowledge import File
from app.core.config import settings

@pytest.fixture
def temp_snapshot(tmp_path):
    root = tmp_path / "snapshot"
    root.mkdir()
    
    # Create normal text file
    (root / "src").mkdir()
    (root / "src" / "main.py").write_text("print('hello')")
    (root / "package.json").write_text('{"name": "test"}')
    
    # Hidden allowed directory
    (root / ".github").mkdir()
    (root / ".github" / "test.yml").write_text("name: Test")
    
    # Ignored directories
    (root / ".git").mkdir()
    (root / ".git" / "config").write_text("git config")
    (root / "node_modules").mkdir()
    (root / "node_modules" / "index.js").write_text("console.log()")
    
    # Binary file
    (root / "image.png").write_bytes(b"\x00\x01\x02")
    
    # Unknown text file
    (root / "config.custom").write_bytes(b"hello world")
    
    # Unknown binary file
    (root / "blob.unknown").write_bytes(b"\x00\x00\x00\x00")
    
    return root

@pytest.fixture
def repo_version():
    repo = Repository(
        id=uuid4(),
        github_repo_id="test_file_indexer",
        owner="owner",
        name="name",
        clone_url="http://",
        is_private=False
    )
    
    version = RepositoryVersion(
        id=uuid4(),
        repository_id=repo.id,
        commit_sha="abcd123",
        branch="main"
    )
    return version

@pytest.fixture
def mock_db():
    db = MagicMock(spec=Session)
    # Setup mock to return empty set for existing paths
    mock_execute = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_execute.scalars.return_value = mock_scalars
    db.execute.return_value = mock_execute
    return db

def test_file_indexer_basic(mock_db: Session, repo_version: RepositoryVersion, temp_snapshot: Path):
    indexer = RepositoryFileIndexer(mock_db)
    indexer.knowledge_repo = MagicMock()
    result = indexer.index_snapshot(repo_version, temp_snapshot)
    
    assert result.files_indexed == 4 # main.py, package.json, test.yml, config.custom
    assert result.files_skipped == 2 # image.png, blob.unknown (files in ignored dirs are not discovered)
    
    # Check posix paths
    files_inserted = indexer.knowledge_repo.bulk_create_files.call_args[0][0]
    paths = {f.file_path for f in files_inserted}
    assert "src/main.py" in paths
    assert "package.json" in paths
    assert ".github/test.yml" in paths
    assert "config.custom" in paths
    
    # Check language
    main_py = next(f for f in files_inserted if f.file_path == "src/main.py")
    assert main_py.language == "Python"
    
    custom = next(f for f in files_inserted if f.file_path == "config.custom")
    assert custom.language == "Unknown"
    
def test_file_indexer_size_limit(mock_db: Session, repo_version: RepositoryVersion, tmp_path: Path):
    root = tmp_path / "snapshot"
    root.mkdir()
    
    (root / "small.txt").write_text("small")
    
    big_file = root / "big.txt"
    with open(big_file, "wb") as f:
        f.write(b"0" * (settings.MAX_INDEXABLE_FILE_SIZE_BYTES + 1))
        
    indexer = RepositoryFileIndexer(mock_db)
    result = indexer.index_snapshot(repo_version, root)
    
    assert result.files_indexed == 1
    assert result.files_skipped == 1
    
def test_file_indexer_retry_idempotency(mock_db: Session, repo_version: RepositoryVersion, temp_snapshot: Path):
    # Simulate DB returning existing paths on retry
    mock_execute = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = ["src/main.py", "package.json", ".github/test.yml", "config.custom"]
    mock_execute.scalars.return_value = mock_scalars
    mock_db.execute.return_value = mock_execute
    
    indexer = RepositoryFileIndexer(mock_db)
    result = indexer.index_snapshot(repo_version, temp_snapshot)
    
    assert result.files_indexed == 0
    assert result.files_skipped == 6 # 2 binary + 4 existing


def test_file_indexer_sha256_deterministic(mock_db: Session, repo_version: RepositoryVersion, tmp_path: Path):
    root = tmp_path / "snapshot"
    root.mkdir()
    (root / "content.txt").write_text("deterministic content")
    
    indexer = RepositoryFileIndexer(mock_db)
    indexer.knowledge_repo = MagicMock()
    indexer.index_snapshot(repo_version, root)
    
    f1 = indexer.knowledge_repo.bulk_create_files.call_args[0][0][0]
    hash1 = f1.hash
    
    # Reset mock and run again
    indexer.knowledge_repo = MagicMock()
    indexer.index_snapshot(repo_version, root)
    f2 = indexer.knowledge_repo.bulk_create_files.call_args[0][0][0]
    hash2 = f2.hash
    
    assert hash1 == hash2
