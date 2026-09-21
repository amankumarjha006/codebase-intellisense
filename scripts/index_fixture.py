#!/usr/bin/env python
"""Script to index the local codebase-intellisense repository."""

import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4

sys.path.insert(0, str(Path(__file__).parent.parent / "server"))

from sqlalchemy.orm import Session
from app.core.db import SessionLocal, Base, engine
from app.models.repository import Repository, RepositoryVersion, IndexJob
from app.services.indexing import IndexingService
from app.repositories.repository import RepositoryRepository


def create_test_repository(db: Session) -> Repository:
    """Create or get a test repository entry for the benchmark fixture."""
    repo_repo = RepositoryRepository(db)
    
    existing = repo_repo.get_by_github_repo_id("pallets-itsdangerous")
    if existing:
        existing.clone_url = "https://github.com/pallets/itsdangerous.git"
        db.commit()
        return existing
    
    repo = Repository(
        github_repo_id="pallets-itsdangerous",
        owner="pallets",
        name="itsdangerous",
        clone_url="https://github.com/pallets/itsdangerous.git",
        is_private=False,
    )
    db.add(repo)
    db.flush()
    return repo


def create_test_version(db: Session, repository: Repository) -> RepositoryVersion:
    """Create a test repository version."""
    existing = db.query(RepositoryVersion).filter(
        RepositoryVersion.repository_id == repository.id,
        RepositoryVersion.commit_sha == "672971d66a2ef9f85151e53283113f33d642dabd"
    ).first()
    if existing:
        return existing
        
    version = RepositoryVersion(
        repository_id=repository.id,
        commit_sha="672971d66a2ef9f85151e53283113f33d642dabd",
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
        
        from app.core.config import settings
        from app.repositories.knowledge import KnowledgeRepository
        from app.services.embedding.factory import get_embedding_provider
        from app.services.embedding.service import EmbeddingService
        
        if not settings.GEMINI_API_KEY:
            print("Error: GEMINI_API_KEY is not set in the configuration.")
            print("Local embedding-enabled indexing requires a valid GEMINI_API_KEY.")
            db.rollback()
            return 1
            
        knowledge_repo = KnowledgeRepository(db)
        provider = get_embedding_provider(settings)
        embedding_service = EmbeddingService(knowledge_repo, provider)
        
        indexing_service = IndexingService(db, embedding_service=embedding_service)
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