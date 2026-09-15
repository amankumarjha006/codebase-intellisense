#!/usr/bin/env python
"""Script to index the local codebase-intellisense repository."""

import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.core.db import SessionLocal, Base, engine
from app.models.repository import Repository, RepositoryVersion, IndexJob
from app.services.indexing import IndexingService
from app.repositories.repository import RepositoryRepository


def create_test_repository(db: Session) -> Repository:
    """Create or get a test repository entry for the local codebase."""
    repo_repo = RepositoryRepository(db)
    
    existing = repo_repo.get_by_github_repo_id("local-codebase-intellisense")
    if existing:
        return existing
    
    repo = Repository(
        github_repo_id="local-codebase-intellisense",
        owner="local",
        name="codebase-intellisense",
        clone_url="file:///local/codebase-intellisense",
        is_private=False,
    )
    db.add(repo)
    db.flush()
    return repo


def create_test_version(db: Session, repository: Repository) -> RepositoryVersion:
    """Create a test repository version."""
    repo_repo = RepositoryRepository(db)
    
    version = RepositoryVersion(
        repository_id=repository.id,
        commit_sha="local-dev",
        branch="main",
        index_status="PENDING",
    )
    db.add(version)
    db.flush()
    return version


def create_test_job(db: Session, repository: Repository, version: RepositoryVersion) -> IndexJob:
    """Create a test index job."""
    repo_repo = RepositoryRepository(db)
    
    job = IndexJob(
        repository_id=repository.id,
        repository_version_id=version.id,
        status="QUEUED",
    )
    db.add(job)
    db.flush()
    return job


def run_local_indexing():
    """Run indexing on the local codebase."""
    print("Setting up database...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Creating test repository entry...")
        repository = create_test_repository(db)
        print(f"Repository: {repository.id} - {repository.owner}/{repository.name}")
        
        print("Creating repository version...")
        version = create_test_version(db, repository)
        print(f"Version: {version.id} - {version.commit_sha}")
        
        print("Creating index job...")
        job = create_test_job(db, repository, version)
        print(f"Job: {job.id}")
        
        db.commit()
        
        print("\nStarting indexing pipeline...")
        print("=" * 50)
        
        indexing_service = IndexingService(db)
        indexing_service.run_indexing(job)
        
        print("=" * 50)
        print("Indexing completed successfully!")
        
        # Print statistics
        from sqlalchemy import func
        from app.models.knowledge import File, Symbol, CodeChunk, Embedding, AnalysisResult
        
        file_count = db.query(func.count(File.id)).filter(File.repository_version_id == version.id).scalar()
        symbol_count = db.query(func.count(Symbol.id)).join(File).filter(File.repository_version_id == version.id).scalar()
        chunk_count = db.query(func.count(CodeChunk.id)).join(File).filter(File.repository_version_id == version.id).scalar()
        embedding_count = db.query(func.count(Embedding.id)).join(CodeChunk).join(File).filter(File.repository_version_id == version.id).scalar()
        
        print(f"\nStatistics:")
        print(f"  Files indexed: {file_count}")
        print(f"  Symbols extracted: {symbol_count}")
        print(f"  Code chunks created: {chunk_count}")
        print(f"  Embeddings generated: {embedding_count}")
        
        analyses = db.query(AnalysisResult).filter(AnalysisResult.repository_version_id == version.id).all()
        for analysis in analyses:
            print(f"  Analysis: {analysis.analysis_type}")
            if analysis.analysis_type == "STATISTICS":
                for lang in analysis.payload.get("languages", []):
                    print(f"    - {lang['language']}: {lang['file_count']} files")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 1
    finally:
        db.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(run_local_indexing())