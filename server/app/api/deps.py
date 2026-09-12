from fastapi import Depends, Request, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
import redis.asyncio as redis
from typing import AsyncGenerator, Generator
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.redis import get_redis_client
from app.models.user import User
from app.models.repository import Repository
from app.repositories.repository import RepositoryRepository

# Exception handling for auth to match ERROR_CONTRACT.md
class AuthException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 401):
        self.code = code
        self.message = message
        self.status_code = status_code

class NotFoundException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 404):
        self.code = code
        self.message = message
        self.status_code = status_code

def get_db() -> Generator[Session, None, None]:
    """Dependency for SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_redis() -> AsyncGenerator[redis.Redis, None]:
    """Dependency for Redis client."""
    client = await get_redis_client()
    yield client

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
) -> User:
    """
    Dependency to get the currently authenticated user from the HTTP-only session cookie.
    Raises AuthException (handled by a custom exception handler to return 401) if invalid.
    """
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_id:
        raise AuthException(
            code="UNAUTHENTICATED", 
            message="User session is invalid or missing."
        )

    # Lookup user ID in Redis
    user_id_str = await redis_client.get(f"session:{session_id}")
    if not user_id_str:
        raise AuthException(
            code="UNAUTHENTICATED", 
            message="User session is invalid or missing."
        )

    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        raise AuthException(
            code="UNAUTHENTICATED", 
            message="User session is invalid or missing."
        )

    # Fetch user from database
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise AuthException(
            code="UNAUTHENTICATED", 
            message="User session is invalid or missing."
        )

    return user

def get_authorized_repository(
    repository_id: UUID = Path(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> Repository:
    """
    Dependency to fetch a repository only if the authenticated user has access to it.
    Raises a 404 (REPOSITORY_NOT_FOUND) if it doesn't exist or access is forbidden,
    preventing repository existence leakage.
    """
    repo_repo = RepositoryRepository(db)
    repository = repo_repo.get_for_user(
        user_id=user.id,
        repository_id=repository_id
    )
    if not repository:
        raise NotFoundException(
            code="REPOSITORY_NOT_FOUND",
            message="The requested repository was not found or you do not have permission to access it."
        )
    return repository
