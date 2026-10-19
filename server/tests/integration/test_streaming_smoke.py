"""
Integration smoke tests for the streaming conversation endpoint.

These tests exercise the full stack through real PostgreSQL and Redis,
with a FakeLLMProvider injected in place of the real LLM/embedding
providers.
"""
import asyncio
import json
from uuid import UUID

import pytest

from app.core.config import settings

pytestmark = [pytest.mark.integration]


def _parse_sse_events(body: str) -> list[dict]:
    """Parse an SSE response body into a list of {event, data} dicts."""
    events = []
    current_event = None
    for line in body.split("\n"):
        line = line.strip()
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_str = line[len("data:"):].strip()
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                data = data_str
            events.append({"event": current_event, "data": data})
            current_event = None
    return events


class TestStreamingSmoke:
    """
    Smoke test: POST a streaming message through the full stack with
    FakeLLMProvider and verify that:
    - SSE events (message_start, token, message_complete) are emitted
    - User and assistant messages are persisted in PostgreSQL
    """

    async def test_streaming_message_end_to_end(
        self,
        app_client,
        db_session,
        redis_client,
        data_factory,
        fake_llm_provider,
        fake_embedding_provider,
        integration_engine,
    ):
        """Full round-trip: create conversation, stream a message, verify persistence."""
        # --- Arrange ---
        from app.main import app
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
        _file, _chunks = data_factory.create_file_with_chunks(
            version.id,
            file_path="src/main.py",
            content="def hello():\n    return 'world'\n",
        )
        conv = data_factory.create_conversation(
            user.id, repo.id, version.id
        )

        fake_llm_provider.chunks = ["Hello", " [C1]", " World"]

        # Wire up the streaming service with the fake LLM provider
        from fastapi import Depends
        from app.api.deps import get_db, get_redis
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

        app.dependency_overrides[
            get_conversation_streaming_service
        ] = override_streaming_service

        # --- Act ---
        response = await app_client.post(
            f"/api/v1/conversations/{conv.id}/messages/stream",
            json={"content": "What does hello() return?"},
            cookies={settings.SESSION_COOKIE_NAME: session_id},
        )

        # --- Assert: HTTP status ---
        assert response.status_code == 200, (
            f"Expected 200 but got {response.status_code}: {response.text}"
        )

        # --- Assert: SSE events ---
        events = _parse_sse_events(response.text)
        event_types = [e["event"] for e in events]

        assert "message_start" in event_types, (
            f"Missing message_start in events: {event_types}"
        )
        assert "message_complete" in event_types, (
            f"Missing message_complete in events: {event_types}"
        )

        token_events = [e for e in events if e["event"] == "token"]
        assert len(token_events) >= 1, "Expected at least one token event"

        # The fake LLM emits ["Hello", " World"] — check the tokens arrived
        token_texts = [e["data"]["text"] for e in token_events]
        full_text = "".join(token_texts)
        assert "Hello" in full_text
        assert "World" in full_text

        # No error events
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) == 0, f"Unexpected errors: {error_events}"

        # --- Assert: Persistence in PostgreSQL ---
        from app.models.conversation import Message
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select

        messages = db_session.execute(
            select(Message)
            .options(selectinload(Message.citations))
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at)
        ).scalars().all()

        assert len(messages) == 2, (
            f"Expected 2 messages (user + assistant), got {len(messages)}"
        )
        assert messages[0].role == "user"
        assert messages[0].content == "What does hello() return?"

        assistant_msg = messages[1]
        assert assistant_msg.role == "assistant"
        assert "Hello" in assistant_msg.content
        assert "World" in assistant_msg.content

        # --- Assert: Citations ---
        assert len(assistant_msg.citations) > 0, "Expected at least one citation"
        chunk_ids = [c.id for c in _chunks]
        from app.models.knowledge import CodeChunk, File
        for citation in assistant_msg.citations:
            assert citation.code_chunk_id in chunk_ids, "Citation links to unknown chunk"
            # Verify chunk is in the pinned version
            chunk = db_session.execute(
                select(CodeChunk).where(CodeChunk.id == citation.code_chunk_id)
            ).scalar_one()
            file = db_session.execute(
                select(File).where(File.id == chunk.file_id)
            ).scalar_one()
            assert file.repository_version_id == version.id, "Citation is from wrong version"

        # --- Assert: Lock was released ---
        lock_val = await redis_client.get(f"conv_lock:{conv.id}")
        assert lock_val is None, "Conversation lock was not released"

        # --- Assert: Conversation reloaded via GET /conversations/{id}/messages returns the same citations ---
        reload_resp = await app_client.get(
            f"{settings.API_V1_STR}/conversations/{conv.id}/messages",
            cookies={settings.SESSION_COOKIE_NAME: session_id},
        )
        assert reload_resp.status_code == 200
        reload_data = reload_resp.json()
        assert reload_data["total"] == 2
        reloaded_user = reload_data["items"][0]
        reloaded_asst = reload_data["items"][1]
        assert reloaded_user["role"] == "user"
        assert reloaded_user["citations"] == []
        assert reloaded_asst["role"] == "assistant"
        assert len(reloaded_asst["citations"]) == len(assistant_msg.citations)
        for i, c in enumerate(assistant_msg.citations):
            rc = reloaded_asst["citations"][i]
            assert rc["file_path"] == c.file_path
            assert rc["start_line"] == c.start_line
            assert rc["end_line"] == c.end_line

