from fastapi import Depends, Request, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
import redis.asyncio as redis
from typing import AsyncGenerator, Generator, Optional
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

async def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
) -> Optional[User]:
    """
    Dependency to get the currently authenticated user from the HTTP-only session cookie,
    returning None if unauthenticated or session is invalid.
    """
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_id:
        return None

    try:
        user_id_str = await redis_client.get(f"session:{session_id}")
        if not user_id_str:
            return None
        user_uuid = UUID(user_id_str)
        from app.repositories.user import UserAccountRepository
        user_repo = UserAccountRepository(db)
        return user_repo.get_user_by_id(user_uuid)
    except Exception:
        return None

async def get_current_user(
    user: Optional[User] = Depends(get_optional_current_user)
) -> User:
    """
    Dependency to get the currently authenticated user from the HTTP-only session cookie.
    Raises AuthException (handled by a custom exception handler to return 401) if invalid.
    """
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
