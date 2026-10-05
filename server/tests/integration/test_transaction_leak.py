"""
Integration tests for C1: transaction open during network I/O.

These tests prove that the production code holds an open PostgreSQL
transaction while waiting on LLM/embedding/rewriter network calls.

Each test is marked ``xfail(strict=True, raises=AssertionError)`` so
it counts as an expected failure.  The fix will remove the xfail.

Detection strategy
------------------
1. **Primary**: ``engine.pool.checkedout()`` is evaluated INSIDE the
   FakeLLMProvider.stream hook, the FakeLLMProvider.generate hook
   (used by the rewriter), and the FakeEmbeddingProvider.embed hook,
   at the moment each fake is entered.  If ``checkedout() > 0``, a
   checked-out connection is being held while waiting on network I/O.

2. **Secondary**: ``pg_stat_activity`` via a SEPARATE monitoring engine
   (excluding its own pid) confirms ``idle in transaction`` connections
   exist during the hooks.

Isolation
---------
* ``data_factory`` / ``db_session`` use short-lived sessions that are
  **closed** before the app call, so they never hold a connection.
* The app gets its **own** Session per request via the override.
"""
import asyncio
import json
from collections import Counter
from uuid import UUID

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from tests.integration.conftest import (
    _TEST_DB_NAME,
    _TEST_DATABASE_URL,
)

pytestmark = [pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pg_idle_in_transaction(monitoring_engine) -> tuple[int, list[str]]:
    """
    Query pg_stat_activity using a SEPARATE monitoring engine.
    Excludes its own pid.  Returns (count, [query_texts]).
    """
    with monitoring_engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT state, query "
                "FROM pg_stat_activity "
                "WHERE datname = :db AND pid != pg_backend_pid()"
            ),
            {"db": _TEST_DB_NAME},
        ).fetchall()
    idle_queries = [row[1] for row in rows if row[0] == "idle in transaction"]
    return len(idle_queries), idle_queries


def _build_assertion_msg(
    hook_name: str,
    checkedout: int,
    idle_count: int,
    idle_queries: list[str],
) -> str:
    return (
        f"C1 violation in {hook_name}: "
        f"pool.checkedout()={checkedout}, "
        f"idle_in_transaction={idle_count}, "
        f"queries={idle_queries}"
    )


def _build_streaming_service(
    app_engine,
    fake_llm,
    fake_embed,
    redis_ref,
):
    """Build a ConversationStreamingService using the given engine."""
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
    from app.services.conversation.streaming_service import ConversationStreamingService

    AppSession = sessionmaker(bind=app_engine)
    app_db = AppSession()

    conversation_repo = ConversationRepository(app_db)
    message_repo = MessageRepository(app_db)
    repo_repo = RepositoryRepository(app_db)
    knowledge_repo = KnowledgeRepository(app_db)

    embedding_service = EmbeddingService(knowledge_repo, fake_embed)
    keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
    semantic_strategy = SemanticRetrievalStrategy(
        knowledge_repo, embedding_service
    )
    hybrid_strategy = HybridRetrievalStrategy(
        keyword_strategy, semantic_strategy
    )
    retrieval_service = RetrievalService(hybrid_strategy)
    context_builder = ContextBuilder()
    rag_service = RAGService(fake_llm)
    citation_service = CitationService()
    answer_service = AnswerService()
    query_rewriter = QueryRewriter(llm_provider=fake_llm)

    svc = ConversationStreamingService(
        conversation_repo=conversation_repo,
        message_repo=message_repo,
        repository_repo=repo_repo,
        query_rewriter=query_rewriter,
        retrieval_service=retrieval_service,
        context_builder=context_builder,
        rag_service=rag_service,
        citation_service=citation_service,
        answer_service=answer_service,
        redis_client=redis_ref,
    )
    return svc, app_db


def _build_message_service(app_engine, fake_llm, fake_embed):
    """Build a ConversationMessageService (sync POST path) using the given engine."""
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
    from app.services.rag_query.service import RAGQueryService
    from app.services.conversation.message_service import ConversationMessageService

    AppSession = sessionmaker(bind=app_engine)
    app_db = AppSession()

    conversation_repo = ConversationRepository(app_db)
    message_repo = MessageRepository(app_db)
    repo_repo = RepositoryRepository(app_db)
    knowledge_repo = KnowledgeRepository(app_db)

    embedding_service = EmbeddingService(knowledge_repo, fake_embed)
    keyword_strategy = KeywordRetrievalStrategy(knowledge_repo)
    semantic_strategy = SemanticRetrievalStrategy(
        knowledge_repo, embedding_service
    )
    hybrid_strategy = HybridRetrievalStrategy(
        keyword_strategy, semantic_strategy
    )
    retrieval_service = RetrievalService(hybrid_strategy)
    context_builder = ContextBuilder()
    rag_service = RAGService(fake_llm)
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

    svc = ConversationMessageService(
        conversation_repo=conversation_repo,
        message_repo=message_repo,
        rag_query_service=rag_query_service,
    )
    return svc, app_db


# ---------------------------------------------------------------------------
# Instrumented fakes that check engine state on entry
# ---------------------------------------------------------------------------

class InstrumentedLLMProvider:
    """
    FakeLLMProvider that checks engine.pool.checkedout() and
    pg_stat_activity on entry to generate() and stream().
    """
    def __init__(self, *, app_engine, monitoring_engine, chunks=None):
        self.app_engine = app_engine
        self.monitoring_engine = monitoring_engine
        self.chunks = chunks if chunks is not None else ["Hello", " World"]
        self.violations: list[str] = []
        self.call_count = 0
        self.stream_call_count = 0

    def _check(self, hook_name: str):
        checkedout = self.app_engine.pool.checkedout()
        idle_count, idle_queries = _pg_idle_in_transaction(self.monitoring_engine)
        if checkedout > 0 or idle_count > 0:
            self.violations.append(
                _build_assertion_msg(hook_name, checkedout, idle_count, idle_queries)
            )

    async def generate(self, prompt: str, system_instruction: str | None = None) -> str:
        self.call_count += 1
        self._check("LLMProvider.generate")
        return "".join(self.chunks)

    async def stream(self, prompt: str, system_instruction: str | None = None):
        self.stream_call_count += 1
        self._check("LLMProvider.stream (entry)")
        for chunk in self.chunks:
            self._check("LLMProvider.stream (before chunk)")
            yield chunk
        self._check("LLMProvider.stream (after loop)")


class InstrumentedEmbeddingProvider:
    """
    FakeEmbeddingProvider that checks engine.pool.checkedout() and
    pg_stat_activity on entry to embed().
    """
    def __init__(self, *, app_engine, monitoring_engine, dimension=768):
        self.app_engine = app_engine
        self.monitoring_engine = monitoring_engine
        self.dimension = dimension
        self.violations: list[str] = []
        self.call_count = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        checkedout = self.app_engine.pool.checkedout()
        idle_count, idle_queries = _pg_idle_in_transaction(self.monitoring_engine)
        if checkedout > 0 or idle_count > 0:
            self.violations.append(
                _build_assertion_msg(
                    "EmbeddingProvider.embed", checkedout, idle_count, idle_queries
                )
            )
        return [[0.1] * self.dimension for _ in texts]


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class TestTransactionLeak:

    @pytest.fixture()
    def monitoring_engine(self, integration_engine):
        """A separate engine used only for pg_stat_activity queries."""
        eng = create_engine(_TEST_DATABASE_URL, pool_pre_ping=True)
        yield eng
        eng.dispose()

    @pytest.fixture()
    def app_engine(self, integration_engine):
        """
        A separate engine the app uses for its own sessions.
        Distinct from db_session's engine so we can measure checkedout().
        """
        eng = create_engine(_TEST_DATABASE_URL, pool_pre_ping=True, pool_size=2)
        yield eng
        eng.dispose()

    def _seed_data(self, db_session, redis_client, *, with_history=False):
        """
        Seed minimal data.  Returns (user_id, conv_id) as plain UUIDs.
        Closes the session afterwards so no test connection lingers.
        """
        from tests.integration.conftest import IntegrationDataFactory
        factory = IntegrationDataFactory(db_session, redis_client)
        user = factory.create_user()
        repo = factory.create_repository(user.id)
        version = factory.create_successful_version(repo.id)
        factory.create_file_with_chunks(version.id)
        conv = factory.create_conversation(user.id, repo.id, version.id)

        if with_history:
            from app.models.conversation import Message
            # Seed a prior user + assistant message pair so the rewriter
            # will actually call llm_provider.generate()
            prior_user = Message(
                conversation_id=conv.id,
                role="user",
                content="What is the main function?",
            )
            db_session.add(prior_user)
            db_session.commit()
            db_session.refresh(prior_user)

            prior_assistant = Message(
                conversation_id=conv.id,
                role="assistant",
                content="The main function is in src/main.py.",
            )
            db_session.add(prior_assistant)
            db_session.commit()
            db_session.refresh(prior_assistant)

        # Extract IDs before closing so we don't trigger lazy loads later
        user_id = user.id
        conv_id = conv.id
        db_session.commit()
        db_session.close()
        return user_id, conv_id

    # -----------------------------------------------------------------------
    # C1-i: Single-turn stream
    # -----------------------------------------------------------------------

    async def test_c1_single_turn_stream(
        self,
        app_engine,
        monitoring_engine,
        db_session,
        redis_client,
        integration_engine,
    ):
        """
        Single-turn stream.  The rewriter skips the LLM call (no history),
        but the stream hook and embed hook should fire.
        """
        user_id, conv_id = self._seed_data(db_session, redis_client)

        llm = InstrumentedLLMProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )
        embed = InstrumentedEmbeddingProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )

        from app.schemas.message import ConversationMessageRequest
        svc, app_db = _build_streaming_service(app_engine, llm, embed, redis_client)

        try:
            # Hook into message_repo.create to verify checkedout==0 before TX2
            original_create = svc.message_repo.create
            def patched_create(msg_in):
                if msg_in.role == "assistant":
                    checkedout = app_engine.pool.checkedout()
                    if checkedout > 0:
                        llm.violations.append(f"C1 violation before TX2 insert: checkedout={checkedout}")
                return original_create(msg_in)
            svc.message_repo.create = patched_create

            events = []
            async for event in svc.stream_message(
                user_id=user_id,
                conversation_id=conv_id,
                request=ConversationMessageRequest(content="What does hello() return?"),
            ):
                events.append(event)
                # Parse event and check connection state after TX2-dependent events
                if event.startswith("event:"):
                    # primitive parse
                    event_type = event.split("\n")[0].replace("event: ", "").strip()
                    if event_type in ("citation", "message_complete"):
                        checkedout = app_engine.pool.checkedout()
                        if checkedout > 0:
                            llm.violations.append(f"C1 violation after SSE '{event_type}': checkedout={checkedout}")

            all_violations = llm.violations + embed.violations
            assert len(all_violations) == 0, "\n".join(all_violations)
        finally:
            app_db.close()

    # -----------------------------------------------------------------------
    # C1-ii: Multi-turn stream (rewriter + embedding actually run)
    # -----------------------------------------------------------------------

    async def test_c1_multi_turn_stream(
        self,
        app_engine,
        monitoring_engine,
        db_session,
        redis_client,
        integration_engine,
    ):
        """
        Multi-turn stream with prior history.  The rewriter calls
        llm_provider.generate() AND the embedding provider fires.
        Both hooks should detect the open transaction.
        """
        user_id, conv_id = self._seed_data(
            db_session, redis_client, with_history=True
        )

        llm = InstrumentedLLMProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )
        embed = InstrumentedEmbeddingProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )

        from app.schemas.message import ConversationMessageRequest
        svc, app_db = _build_streaming_service(app_engine, llm, embed, redis_client)

        try:
            # Hook into message_repo.create to verify checkedout==0 before TX2
            original_create = svc.message_repo.create
            def patched_create(msg_in):
                if msg_in.role == "assistant":
                    checkedout = app_engine.pool.checkedout()
                    if checkedout > 0:
                        llm.violations.append(f"C1 violation before TX2 insert: checkedout={checkedout}")
                return original_create(msg_in)
            svc.message_repo.create = patched_create

            events = []
            async for event in svc.stream_message(
                user_id=user_id,
                conversation_id=conv_id,
                request=ConversationMessageRequest(content="Tell me more about it"),
            ):
                events.append(event)
                if event.startswith("event:"):
                    event_type = event.split("\n")[0].replace("event: ", "").strip()
                    if event_type in ("citation", "message_complete"):
                        checkedout = app_engine.pool.checkedout()
                        if checkedout > 0:
                            llm.violations.append(f"C1 violation after SSE '{event_type}': checkedout={checkedout}")

            # generate (rewriter) + stream (RAG) + embed should all fire
            assert llm.call_count >= 1, "Rewriter should have called generate()"
            assert llm.stream_call_count >= 1, "RAG should have called stream()"
            assert embed.call_count >= 1, "Embedding should have been called"

            all_violations = llm.violations + embed.violations
            assert len(all_violations) == 0, "\n".join(all_violations)
        finally:
            app_db.close()

    # -----------------------------------------------------------------------
    # C1-iii: Synchronous POST /messages
    # -----------------------------------------------------------------------

    async def test_c1_sync_post_messages(
        self,
        app_engine,
        monitoring_engine,
        db_session,
        redis_client,
        integration_engine,
    ):
        """
        Synchronous POST /messages via ConversationMessageService.send_message().
        The RAGQueryService.execute() calls the LLM provider (via RAGService)
        and the embedding provider while the DB session is open.
        """
        user_id, conv_id = self._seed_data(db_session, redis_client)

        llm = InstrumentedLLMProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )
        embed = InstrumentedEmbeddingProvider(
            app_engine=app_engine, monitoring_engine=monitoring_engine
        )

        from app.schemas.message import ConversationMessageRequest
        svc, app_db = _build_message_service(app_engine, llm, embed)

        try:
            original_create = svc.message_repo.create
            def patched_create(msg_in):
                if msg_in.role == "assistant":
                    checkedout = app_engine.pool.checkedout()
                    if checkedout > 0:
                        llm.violations.append(f"C1 violation before TX2 insert: checkedout={checkedout}")
                return original_create(msg_in)
            svc.message_repo.create = patched_create

            response = await svc.send_message(
                user_id=user_id,
                conversation_id=conv_id,
                request=ConversationMessageRequest(content="What does hello() return?"),
            )

            all_violations = llm.violations + embed.violations
            assert len(all_violations) == 0, "\n".join(all_violations)
        finally:
            app_db.close()
