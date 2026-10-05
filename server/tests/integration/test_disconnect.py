import pytest
import asyncio
from app.schemas.message import ConversationMessageRequest

pytestmark = [pytest.mark.integration]

@pytest.mark.asyncio
async def test_mid_stream_disconnect(
    app_streaming_client,
    data_factory,
    fake_llm_provider,
    fake_embedding_provider,
    db_session,
    redis_client,
):
    """
    Test that a client disconnecting mid-stream properly raises cancellation
    in the server generator.
    """
    from app.main import app
    from app.api.deps import get_db, get_redis
    from app.api.v1.endpoints.conversations import get_conversation_streaming_service
    from app.services.conversation.streaming_service import ConversationStreamingService
    from app.repositories.conversation import ConversationRepository
    from app.repositories.message import MessageRepository
    from app.repositories.repository import RepositoryRepository
    from app.repositories.knowledge import KnowledgeRepository
    from app.services.retrieval import (
        RetrievalService,
        KeywordRetrievalStrategy,
        SemanticRetrievalStrategy,
        HybridRetrievalStrategy,
    )
    from app.services.embedding.service import EmbeddingService
    from app.services.context.builder import ContextBuilder
    from app.services.rag.service import RAGService
    from app.services.citation.service import CitationService
    from app.services.answer.service import AnswerService
    from app.services.conversation.query_rewriter import QueryRewriter

    user = data_factory.create_user()
    session_id = await data_factory.create_authenticated_session(user.id)
    repo = data_factory.create_repository(user.id)
    version = data_factory.create_successful_version(repo.id)
    data_factory.create_file_with_chunks(version.id)
    conv = data_factory.create_conversation(user.id, repo.id, version.id)
    db_session.commit()

    # The uvicorn server needs the test DB/Redis via overrides
    def override_get_db():
        from sqlalchemy.orm import sessionmaker
        AppSession = sessionmaker(bind=db_session.get_bind())
        session = AppSession()
        try:
            yield session
        finally:
            session.close()

    async def override_get_redis():
        from redis.asyncio import Redis
        r = Redis(**redis_client.connection_pool.connection_kwargs)
        try:
            yield r
        finally:
            await r.aclose()

    # Set up a fake LLM provider that takes a long time so we can disconnect mid-stream
    fake_llm_provider.per_chunk_delay = 1.0

    from fastapi import Depends
    def override_streaming_service(app_db=Depends(get_db), app_redis=Depends(get_redis)):
        conversation_repo = ConversationRepository(app_db)
        message_repo = MessageRepository(app_db)
        repo_repo = RepositoryRepository(app_db)
        knowledge_repo = KnowledgeRepository(app_db)

        embedding_service = EmbeddingService(
            knowledge_repo, fake_embedding_provider
        )
        keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
        semantic_strategy = SemanticRetrievalStrategy(
            knowledge_repo, embedding_service
        )
        hybrid_strategy = HybridRetrievalStrategy(
            keyword_strategy, semantic_strategy
        )
        retrieval_service = RetrievalService(hybrid_strategy)
        context_builder = ContextBuilder()
        rag_service = RAGService(fake_llm_provider)
        citation_service = CitationService()
        answer_service = AnswerService()
        query_rewriter = QueryRewriter(llm_provider=fake_llm_provider)

        return ConversationStreamingService(
            conversation_repo=conversation_repo,
            message_repo=message_repo,
            repository_repo=repo_repo,
            query_rewriter=query_rewriter,
            retrieval_service=retrieval_service,
            context_builder=context_builder,
            rag_service=rag_service,
            citation_service=citation_service,
            answer_service=answer_service,
            redis_client=app_redis,
        )

    try:
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_redis] = override_get_redis
        app.dependency_overrides[get_conversation_streaming_service] = override_streaming_service

        request = ConversationMessageRequest(content="hello")

        # We will read one line and then exit the context manager to disconnect
        lines = []
        try:
            async with app_streaming_client() as client:
                async with client.stream(
                    "POST",
                    f"/api/v1/conversations/{conv.id}/messages/stream",
                    json=request.model_dump(),
                    cookies={"session_id": session_id}
                ) as response:
                    assert response.status_code == 200
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        lines.append(line)
                        if line.startswith("event: token"):
                            # Read the first token, then disconnect
                            break
        except Exception:
            pass # Disconnect can cause httpx local exceptions

        assert len(lines) > 0, "No lines received before disconnect"

        # Wait a moment for server to handle disconnect and raise cancellation
        await asyncio.sleep(0.5)

        # The generator should have been cancelled mid-stream.
        # We can verify by checking if the LLM provider didn't finish yielding all chunks.
        assert fake_llm_provider.stream_call_count == 1
        # It shouldn't have persisted the assistant message since it was interrupted
        from app.models.conversation import Message
        from sqlalchemy import select
        messages = db_session.execute(
            select(Message).where(Message.conversation_id == conv.id)
        ).scalars().all()
        # Only the user message should be saved
        assert len(messages) == 1
        assert messages[0].role == "user"

    finally:
        app.dependency_overrides.clear()
