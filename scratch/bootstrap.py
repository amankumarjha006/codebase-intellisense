import asyncio
import uuid
import secrets
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))
from app.core.db import SessionLocal
from app.core.redis import get_redis_client
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion
from app.core.config import settings
from datetime import datetime, timezone

async def main():
    db = SessionLocal()
    
    # Check if a test user exists, otherwise create
    test_user_email = "postman_test_user@example.com"
    user = db.query(User).filter(User.email == test_user_email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=test_user_email,
            full_name="Postman Test User"
        )
        github_account = GithubAccount(
            id=uuid.uuid4(),
            user_id=user.id,
            github_user_id="postman_test_github_id",
            username="postman_tester",
            access_token_encrypted=b"test"
        )
        db.add(user)
        db.add(github_account)
        db.commit()
        db.refresh(user)

    # Second User for Isolation Test
    test_user_2_email = "postman_test_user_2@example.com"
    user2 = db.query(User).filter(User.email == test_user_2_email).first()
    if not user2:
        user2 = User(
            id=uuid.uuid4(),
            email=test_user_2_email,
            full_name="Postman Test User 2"
        )
        db.add(user2)
        db.commit()
        db.refresh(user2)

    # Check if a test repo exists
    from app.models.repository import UserRepository
    user_repo_mapping = db.query(UserRepository).filter(UserRepository.user_id == user.id).first()
    if not user_repo_mapping:
        repo = Repository(
            id=uuid.uuid4(),
            github_repo_id="999999",
            owner="postman_tester",
            name="test-repo",
            clone_url="https://github.com/postman_tester/test-repo.git",
            is_private=False
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
        user_repo_mapping = UserRepository(
            id=uuid.uuid4(),
            user_id=user.id,
            repository_id=repo.id
        )
        db.add(user_repo_mapping)
        db.commit()
    else:
        repo = db.query(Repository).filter(Repository.id == user_repo_mapping.repository_id).first()
    
    # Check if repo has a SUCCESS version
    version = db.query(RepositoryVersion).filter(
        RepositoryVersion.repository_id == repo.id,
        RepositoryVersion.index_status == "SUCCESS"
    ).first()
    if not version:
        version = RepositoryVersion(
            id=uuid.uuid4(),
            repository_id=repo.id,
            commit_sha="dummy_sha_123",
            branch="main",
            index_status="SUCCESS",
            indexed_at=datetime.now(timezone.utc)
        )
        db.add(version)
        db.commit()
        db.refresh(version)

    # Inject session into Redis
    redis_client = await get_redis_client()
    session_id_1 = secrets.token_urlsafe(32)
    session_id_2 = secrets.token_urlsafe(32)
    
    await redis_client.setex(f"session:{session_id_1}", 86400, str(user.id))
    await redis_client.setex(f"session:{session_id_2}", 86400, str(user2.id))
    
    print(f"USER_1_ID={user.id}")
    print(f"USER_1_SESSION={session_id_1}")
    print(f"REPO_ID={repo.id}")
    print(f"VERSION_ID={version.id}")
    print(f"USER_2_ID={user2.id}")
    print(f"USER_2_SESSION={session_id_2}")

if __name__ == "__main__":
    asyncio.run(main())
