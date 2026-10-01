import asyncio
import uuid
import secrets
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))
from app.core.db import SessionLocal
from app.core.redis import get_redis_client
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion, UserRepository, IndexJob
from app.core.config import settings
from datetime import datetime, timezone

async def main():
    db = SessionLocal()

    # User A
    user_a_email = "user_a@example.com"
    user_a = db.query(User).filter(User.email == user_a_email).first()
    if not user_a:
        user_a = User(id=uuid.uuid4(), email=user_a_email, full_name="User A")
        github_a = GithubAccount(id=uuid.uuid4(), user_id=user_a.id, github_user_id="user_a_gh", username="user_a", access_token_encrypted=b"test")
        db.add(user_a)
        db.add(github_a)
        db.commit()
        db.refresh(user_a)

    # User B
    user_b_email = "user_b@example.com"
    user_b = db.query(User).filter(User.email == user_b_email).first()
    if not user_b:
        user_b = User(id=uuid.uuid4(), email=user_b_email, full_name="User B")
        github_b = GithubAccount(id=uuid.uuid4(), user_id=user_b.id, github_user_id="user_b_gh", username="user_b", access_token_encrypted=b"test")
        db.add(user_b)
        db.add(github_b)
        db.commit()
        db.refresh(user_b)

    # Repo A (User A)
    user_a_repo_mapping = db.query(UserRepository).filter(UserRepository.user_id == user_a.id).first()
    if not user_a_repo_mapping:
        repo_a = Repository(
            id=uuid.uuid4(),
            github_repo_id="repo_a_123",
            owner="user_a",
            name="repo_a",
            clone_url="https://github.com/user_a/repo_a.git",
            is_private=False
        )
        db.add(repo_a)
        db.commit()
        db.refresh(repo_a)
        
        user_a_repo_mapping = UserRepository(id=uuid.uuid4(), user_id=user_a.id, repository_id=repo_a.id)
        db.add(user_a_repo_mapping)
        db.commit()
    else:
        repo_a = db.query(Repository).filter(Repository.id == user_a_repo_mapping.repository_id).first()

    # Repo B (User B)
    user_b_repo_mapping = db.query(UserRepository).filter(UserRepository.user_id == user_b.id).first()
    if not user_b_repo_mapping:
        repo_b = Repository(
            id=uuid.uuid4(),
            github_repo_id="repo_b_123",
            owner="user_b",
            name="repo_b",
            clone_url="https://github.com/user_b/repo_b.git",
            is_private=False
        )
        db.add(repo_b)
        db.commit()
        db.refresh(repo_b)
        
        user_b_repo_mapping = UserRepository(id=uuid.uuid4(), user_id=user_b.id, repository_id=repo_b.id)
        db.add(user_b_repo_mapping)
        db.commit()
    else:
        repo_b = db.query(Repository).filter(Repository.id == user_b_repo_mapping.repository_id).first()

    # Create a version and job for Repo A
    version_a = db.query(RepositoryVersion).filter(RepositoryVersion.repository_id == repo_a.id, RepositoryVersion.index_status == "SUCCESS").first()
    if not version_a:
        version_a = RepositoryVersion(
            id=uuid.uuid4(),
            repository_id=repo_a.id,
            commit_sha="commit_a_123",
            branch="main",
            index_status="SUCCESS",
            indexed_at=datetime.now(timezone.utc)
        )
        db.add(version_a)
        db.commit()
        db.refresh(version_a)
        
        job_a = IndexJob(
            id=uuid.uuid4(),
            repository_id=repo_a.id,
            repository_version_id=version_a.id,
            status="READY",
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.add(job_a)
        db.commit()
        db.refresh(job_a)
    else:
        job_a = db.query(IndexJob).filter(IndexJob.repository_version_id == version_a.id).first()

    # Inject sessions
    redis_client = await get_redis_client()
    session_id_a = secrets.token_urlsafe(32)
    session_id_b = secrets.token_urlsafe(32)
    
    await redis_client.setex(f"session:{session_id_a}", 86400, str(user_a.id))
    await redis_client.setex(f"session:{session_id_b}", 86400, str(user_b.id))
    
    import json
    env = {
        "id": str(uuid.uuid4()),
        "name": "Local_Pre_Phase_4",
        "values": [
            {"key": "base_url", "value": "http://127.0.0.1:8000/api/v1", "enabled": True},
            {"key": "user_a_id", "value": str(user_a.id), "enabled": True},
            {"key": "user_b_id", "value": str(user_b.id), "enabled": True},
            {"key": "session_a", "value": session_id_a, "enabled": True},
            {"key": "session_b", "value": session_id_b, "enabled": True},
            {"key": "repo_a_id", "value": str(repo_a.id), "enabled": True},
            {"key": "repo_b_id", "value": str(repo_b.id), "enabled": True},
            {"key": "version_a_id", "value": str(version_a.id), "enabled": True},
            {"key": "job_a_id", "value": str(job_a.id), "enabled": True},
        ]
    }
    with open(os.path.join(os.path.dirname(__file__), 'pre_phase_4_env.json'), 'w') as f:
        json.dump(env, f, indent=2)
        
    print("Bootstrap complete. Environment saved to scratch/pre_phase_4_env.json")

if __name__ == "__main__":
    asyncio.run(main())
