from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_db, get_current_user, get_authorized_repository
from app.models.user import User
from app.models.repository import Repository
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.services.conversation.service import ConversationService
from app.services.conversation.exceptions import (
    ConversationNotFoundError,
    ActiveVersionNotFoundError,
)
from app.schemas.conversation import (
    ConversationCreate,
    ConversationOut,
    ConversationListOut,
    MessageListOut,
)
from app.repositories.repository import RepositoryRepository
from app.repositories.knowledge import KnowledgeRepository
from app.services.retrieval import RetrievalService, KeywordRetrievalStrategy, SemanticRetrievalStrategy, HybridRetrievalStrategy
from app.services.embedding.service import EmbeddingService
from app.services.embedding.gemini import GeminiEmbeddingProvider
from app.core.config import settings
from app.services.rag_query.service import RAGQueryService
from app.services.rag_query.exceptions import (
    InvalidQueryError,
    NoIndexedVersionError,
    InvalidRepositoryVersionError
)
from app.services.llm.exceptions import TransientLLMError, PermanentLLMError
from app.services.llm.factory import create_llm_provider
from app.services.context.builder import ContextBuilder
from app.services.rag.service import RAGService
from app.services.citation.service import CitationService
from app.services.answer.service import AnswerService

from app.services.conversation.message_service import ConversationMessageService
from app.schemas.message import ConversationMessageRequest, ConversationMessageResponse

router = APIRouter()

def get_conversation_service(db: Session = Depends(get_db)) -> ConversationService:
    conversation_repo = ConversationRepository(db)
    message_repo = MessageRepository(db)
    return ConversationService(conversation_repo, message_repo)

def get_conversation_message_service(db: Session = Depends(get_db)) -> ConversationMessageService:
    conversation_repo = ConversationRepository(db)
    message_repo = MessageRepository(db)
    
    repo_repo = RepositoryRepository(db)
    knowledge_repo = KnowledgeRepository(db)

    provider = GeminiEmbeddingProvider(
        api_key=settings.GEMINI_API_KEY,
        model=settings.EMBEDDING_MODEL,
        dimension=settings.EMBEDDING_DIMENSION,
    )
    embedding_service = EmbeddingService(knowledge_repo, provider)
    semantic_strategy = SemanticRetrievalStrategy(knowledge_repo, embedding_service)
    keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
    hybrid_strategy = HybridRetrievalStrategy(keyword_strategy, semantic_strategy)
    retrieval_service = RetrievalService(hybrid_strategy)

    context_builder = ContextBuilder()
    llm_provider = create_llm_provider(settings)
    rag_service = RAGService(llm_provider)
    citation_service = CitationService()
    answer_service = AnswerService()

    rag_query_service = RAGQueryService(
        repository_repo=repo_repo,
        retrieval_service=retrieval_service,
        context_builder=context_builder,
        rag_service=rag_service,
        citation_service=citation_service,
        answer_service=answer_service,
    )
    
    return ConversationMessageService(
        conversation_repo=conversation_repo,
        message_repo=message_repo,
        rag_query_service=rag_query_service
    )


@router.post("/repositories/{repository_id}/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED, summary="Create a Conversation")
def create_conversation(
    request: ConversationCreate,
    repository: Repository = Depends(get_authorized_repository),
    user: User = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    try:
        conversation = conversation_service.create_conversation(
            user_id=user.id,
            repository=repository,
            title=request.title
        )
        return conversation
    except ActiveVersionNotFoundError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": str(e)}}
        )


@router.get("/repositories/{repository_id}/conversations", response_model=ConversationListOut, summary="List Repository Conversations")
def list_conversations(
    repository: Repository = Depends(get_authorized_repository),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    skip = (page - 1) * limit
    items, total = conversation_service.list_conversations(
        user_id=user.id, repository=repository, skip=skip, limit=limit
    )
    
    return ConversationListOut(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_more=(skip + len(items)) < total
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut, summary="Get a Conversation")
def get_conversation(
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    try:
        conversation = conversation_service.get_conversation(conversation_id, user.id)
        return conversation
    except ConversationNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": str(e)}}
        )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a Conversation")
def delete_conversation(
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    try:
        conversation_service.delete_conversation(conversation_id, user.id)
    except ConversationNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": str(e)}}
        )


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListOut, summary="List Conversation Messages")
def list_messages(
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    try:
        skip = (page - 1) * limit
        items, total = conversation_service.list_messages(
            conversation_id=conversation_id, user_id=user.id, skip=skip, limit=limit
        )
        return MessageListOut(
            items=items,
            total=total,
            page=page,
            limit=limit,
            has_more=(skip + len(items)) < total
        )
    except ConversationNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": str(e)}}
        )


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationMessageResponse, status_code=status.HTTP_201_CREATED, summary="Send a Message")
async def send_message(
    conversation_id: UUID,
    request: ConversationMessageRequest,
    user: User = Depends(get_current_user),
    message_service: ConversationMessageService = Depends(get_conversation_message_service),
):
    try:
        response = await message_service.send_message(
            user_id=user.id,
            conversation_id=conversation_id,
            request=request
        )
        return response
    except ConversationNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": str(e)}}
        )
    except InvalidQueryError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": str(e)}}
        )
    except InvalidRepositoryVersionError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": str(e)}}
        )
    except NoIndexedVersionError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_REQUEST", "message": str(e)}}
        )
    except TransientLLMError as e:
        return JSONResponse(
            status_code=502,
            content={"error": {"code": "UPSTREAM_SERVICE_UNAVAILABLE", "message": str(e)}}
        )
    except PermanentLLMError as e:
        return JSONResponse(
            status_code=502,
            content={"error": {"code": "UPSTREAM_SERVICE_ERROR", "message": str(e)}}
        )
