from fastapi import Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
import redis.asyncio as redis
from typing import AsyncGenerator, Generator
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.redis import get_redis_client
from app.models.user import User

# Exception handling for auth to match ERROR_CONTRACT.md
class AuthException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 401):
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
