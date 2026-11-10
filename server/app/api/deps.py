from fastapi import Depends, Request, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
import redis.asyncio as redis
import logging
from typing import AsyncGenerator, Generator, Optional
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.redis import get_redis_client
from app.models.user import User
from app.models.repository import Repository
from app.repositories.repository import RepositoryRepository

logger = logging.getLogger(__name__)
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
        logger.debug(
            "auth_cookie_missing",
            extra={
                "cookies_received": list(request.cookies.keys()),
                "has_cookie_header": "cookie" in request.headers,
                "origin": request.headers.get("origin"),
            }
        )
        return None

    try:
        user_id_str = await redis_client.get(f"session:{session_id}")
        if not user_id_str:
            logger.warning(
                "auth_session_not_in_redis",
                extra={"session_prefix": session_id[:8] if len(session_id) >= 8 else session_id}
            )
            return None
        user_uuid = UUID(user_id_str)
        from app.repositories.user import UserAccountRepository
        user_repo = UserAccountRepository(db)
        user = user_repo.get_user_by_id(user_uuid)
        if not user:
            logger.warning("auth_user_not_found_in_db", extra={"user_id": str(user_uuid)})
        return user
    except Exception as exc:
        logger.exception("auth_lookup_failed", extra={"error_detail": str(exc)})
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


def get_embedding_provider_dep():
    """Dependency for obtaining the configured embedding provider."""
    from app.services.embedding.factory import get_embedding_provider
    return get_embedding_provider(settings)


def get_retrieval_service(
    db: Session = Depends(get_db),
    provider = Depends(get_embedding_provider_dep),
):
    """Dependency for constructing the hybrid retrieval service."""
    from app.repositories.knowledge import KnowledgeRepository
    from app.services.retrieval import (
        RetrievalService,
        SemanticRetrievalStrategy,
        KeywordRetrievalStrategy,
        HybridRetrievalStrategy,
    )
    from app.services.embedding.service import EmbeddingService

    knowledge_repo = KnowledgeRepository(db)
    embedding_service = EmbeddingService(knowledge_repo, provider)
    semantic_strategy = SemanticRetrievalStrategy(knowledge_repo, embedding_service)
    keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
    hybrid_strategy = HybridRetrievalStrategy(keyword_strategy, semantic_strategy)
    return RetrievalService(hybrid_strategy)


def get_rag_query_service(
    db: Session = Depends(get_db),
    retrieval_service = Depends(get_retrieval_service),
):
    """Dependency for constructing the end-to-end RAG query service."""
    from app.services.context.builder import ContextBuilder
    from app.services.llm.factory import create_llm_provider
    from app.services.rag.service import RAGService
    from app.services.citation.service import CitationService
    from app.services.answer.service import AnswerService
    from app.services.rag_query.service import RAGQueryService

    repo_repo = RepositoryRepository(db)
    context_builder = ContextBuilder()
    llm_provider = create_llm_provider(settings)
    rag_service = RAGService(llm_provider)
    citation_service = CitationService()
    answer_service = AnswerService()

    return RAGQueryService(
        repository_repo=repo_repo,
        retrieval_service=retrieval_service,
        context_builder=context_builder,
        rag_service=rag_service,
        citation_service=citation_service,
        answer_service=answer_service,
    )
