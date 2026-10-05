"""
Integration test fixtures.

Provides real PostgreSQL, real Redis, a FastAPI test client wired to
real infrastructure, and fake LLM / embedding providers with
controllable behaviour.

Requirements
------------
* docker-compose services ``postgres`` and ``redis`` must be running.
* Tests are skipped automatically when infrastructure is unavailable.

Run with::

    pytest -m integration

"""
import asyncio
import logging
import os
import subprocess
import threading
import time
import socket
from collections import Counter
from datetime import datetime, timezone
from typing import AsyncGenerator, Generator
from uuid import UUID, uuid4

import pytest
import redis.asyncio as aioredis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.db import Base

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Infrastructure connection parameters (from existing docker-compose)
# ---------------------------------------------------------------------------
_TEST_DB_NAME = "codebase_intellisense_test"
_PG_BASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0]  # strip db name
_TEST_DATABASE_URL = f"{_PG_BASE_URL}/{_TEST_DB_NAME}"
_TEST_REDIS_DB = 15  # use a dedicated DB number so we don't clobber dev data
_TEST_REDIS_URL = settings.REDIS_URL.rsplit("/", 1)[0] + f"/{_TEST_REDIS_DB}"


# ---------------------------------------------------------------------------
# Skip entire module when infrastructure is down
# ---------------------------------------------------------------------------
def _pg_is_reachable() -> bool:
    try:
        eng = create_engine(_PG_BASE_URL + "/postgres", pool_pre_ping=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


def _redis_is_reachable() -> bool:
    import redis as sync_redis

    try:
        r = sync_redis.from_url(_TEST_REDIS_URL)
        r.ping()
        r.close()
        return True
    except Exception:
        return False


_INFRA_AVAILABLE = _pg_is_reachable() and _redis_is_reachable()

# Auto-skip every test in this package when infra is missing
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not _INFRA_AVAILABLE,
        reason="Integration infrastructure (PostgreSQL / Redis) unavailable",
    ),
]


# ---------------------------------------------------------------------------
# Session-scoped: create the test database and apply schema once
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def _create_test_database():
    """Create the test database (if missing) and apply the full schema."""
    admin_engine = create_engine(
        _PG_BASE_URL + "/postgres",
        isolation_level="AUTOCOMMIT",
    )
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :db"),
            {"db": _TEST_DB_NAME},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_TEST_DB_NAME}"'))
    admin_engine.dispose()

    # Enable pgvector extension in the test database
    test_engine = create_engine(_TEST_DATABASE_URL)
    with test_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()
    test_engine.dispose()

    # Create all tables using Alembic.
    import app.models  # noqa: F401

    # Clean database before running alembic
    schema_engine = create_engine(_TEST_DATABASE_URL)
    Base.metadata.drop_all(bind=schema_engine)
    with schema_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        conn.commit()
    schema_engine.dispose()

    env = os.environ.copy()
    env["ALEMBIC_DATABASE_URL"] = _TEST_DATABASE_URL
    import sys
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        env=env,
        check=True
    )

    yield

    # Teardown: we intentionally leave the DB around for debugging.



# ---------------------------------------------------------------------------
# Session-scoped engine / session factory
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def integration_engine(_create_test_database):
    engine = create_engine(_TEST_DATABASE_URL, pool_pre_ping=True, echo=False)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def _SessionFactory(integration_engine):
    return sessionmaker(
        autocommit=False, autoflush=False, bind=integration_engine
    )


# ---------------------------------------------------------------------------
# Per-test database session with table truncation
# ---------------------------------------------------------------------------

# Tables truncated between tests â€” order respects FK constraints via CASCADE.
_TRUNCATABLE_TABLES = [
    "citations",
    "messages",
    "conversations",
    "embeddings",
    "code_chunks",
    "symbols",
    "file_relationships",
    "symbol_relationships",
    "analysis_results",
    "files",
    "index_jobs",
    "repository_versions",
    "user_repositories",
    "repositories",
    "github_installations",
    "github_accounts",
    "users",
]


@pytest.fixture()
def db_session(_SessionFactory, integration_engine) -> Generator[Session, None, None]:
    """
    Yield a real SQLAlchemy Session.

    After the test, all tables are truncated (with CASCADE) so that each
    test starts with a clean database.  We do NOT use savepoint/rollback
    because the task explicitly requires us to surface real commit behaviour.
    """
    assert str(integration_engine.url.database).endswith("_test"), "Safety check: not a test DB"
    session: Session = _SessionFactory()
    yield session
    session.close()

    # Truncate after the test so committed data doesn't leak
    with integration_engine.connect() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                + ", ".join(_TRUNCATABLE_TABLES)
                + " CASCADE"
            )
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Real Redis â€” flushed per test
# ---------------------------------------------------------------------------
@pytest.fixture()
async def redis_client() -> AsyncGenerator[aioredis.Redis, None]:
    client = aioredis.from_url(
        _TEST_REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    assert client.connection_pool.connection_kwargs.get("db", 0) == _TEST_REDIS_DB, "Safety check: not test Redis DB"
    yield client
    await client.flushdb()
    await client.aclose()


# ---------------------------------------------------------------------------
# Fake LLM Provider
# ---------------------------------------------------------------------------
class FakeLLMProvider:
    """
    A controllable LLM provider implementing the ``LLMProvider`` protocol.

    Configuration
    -------------
    chunks : list[str]
        Chunks yielded by ``stream()``.  ``generate()`` returns them joined.
    per_chunk_delay : float
        Seconds to sleep between yielding each chunk.
    total_latency : float
        Extra seconds of latency added *before* the first chunk.
    error_at : int | None
        If set, raise ``error_class`` after yielding this many chunks.
        0 means raise before the first chunk.
    error_class : type[Exception]
        The exception class to raise (default: ``TransientLLMError``).
    generate_error_class : type[Exception] | None
        If set, ``generate()`` raises this instead of returning.
    mid_generation_event : asyncio.Event | None
        If set, the provider will *set* this event after yielding the
        first chunk.  Test code can ``await event.wait()`` to know the
        stream is mid-flight.
    """

    def __init__(
        self,
        *,
        chunks: list[str] | None = None,
        per_chunk_delay: float = 0.0,
        total_latency: float = 0.0,
        error_at: int | None = None,
        error_class: type[Exception] | None = None,
        generate_error_class: type[Exception] | None = None,
        mid_generation_event: asyncio.Event | None = None,
        pause_event: asyncio.Event | None = None,
    ):
        from app.services.llm.exceptions import TransientLLMError

        self.chunks = chunks if chunks is not None else ["Hello", " World"]
        self.per_chunk_delay = per_chunk_delay
        self.total_latency = total_latency
        self.error_at = error_at
        self.error_class = error_class or TransientLLMError
        self.generate_error_class = generate_error_class
        self.mid_generation_event = mid_generation_event
        self.pause_event = pause_event
        self.call_count = 0
        self.stream_call_count = 0

    async def generate(
        self, prompt: str, system_instruction: str | None = None
    ) -> str:
        self.call_count += 1
        if self.generate_error_class is not None:
            raise self.generate_error_class("FakeLLMProvider generate error")
        if self.total_latency > 0:
            await asyncio.sleep(self.total_latency)
        return "".join(self.chunks)

    async def stream(
        self, prompt: str, system_instruction: str | None = None
    ):
        self.stream_call_count += 1
        if self.total_latency > 0:
            await asyncio.sleep(self.total_latency)

        for i, chunk in enumerate(self.chunks):
            if self.error_at is not None and i == self.error_at:
                raise self.error_class(
                    f"FakeLLMProvider error at chunk {i}"
                )

            if self.per_chunk_delay > 0:
                await asyncio.sleep(self.per_chunk_delay)

            yield chunk

            # Signal that we are mid-generation (after first chunk)
            if i == 0 and self.mid_generation_event is not None:
                self.mid_generation_event.set()

            # Pause after first chunk if requested
            if i == 0 and self.pause_event is not None:
                await self.pause_event.wait()


# ---------------------------------------------------------------------------
# Fake Embedding Provider
# ---------------------------------------------------------------------------
class FakeEmbeddingProvider:
    """
    A controllable embedding provider implementing ``EmbeddingProvider``.
    """

    def __init__(
        self,
        *,
        dimension: int = 768,
        latency: float = 0.0,
        error_class: type[Exception] | None = None,
    ):
        self.dimension = dimension
        self.latency = latency
        self.error_class = error_class
        self.call_count = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        if self.error_class is not None:
            raise self.error_class("FakeEmbeddingProvider error")
        import time

        if self.latency > 0:
            time.sleep(self.latency)
        # Return deterministic dummy vectors
        return [[0.1] * self.dimension for _ in texts]


# ---------------------------------------------------------------------------
# Fixtures for the fake providers
# ---------------------------------------------------------------------------
@pytest.fixture()
def fake_llm_provider():
    """Returns a default FakeLLMProvider.  Tests can replace it."""
    return FakeLLMProvider()


@pytest.fixture()
def fake_embedding_provider():
    return FakeEmbeddingProvider()


# ---------------------------------------------------------------------------
# FastAPI test app + httpx.AsyncClient
# ---------------------------------------------------------------------------
@pytest.fixture()
async def app_client(
    db_session: Session,
    redis_client: aioredis.Redis,
    fake_llm_provider: FakeLLMProvider,
    fake_embedding_provider: FakeEmbeddingProvider,
) -> AsyncGenerator[AsyncClient, None]:
    """
    An ``httpx.AsyncClient`` backed by the real FastAPI app with
    dependency overrides pointing at the real test DB / Redis and
    the fake LLM / embedding providers.
    """
    from app.main import app
    from app.api.deps import get_db, get_redis
    from app.services.llm.factory import create_llm_provider
    from app.services.embedding.factory import get_embedding_provider

    def override_get_db():
        from sqlalchemy.orm import sessionmaker
        session = sessionmaker(bind=db_session.get_bind())()
        try:
            yield session
        finally:
            session.close()

    # Override the Redis dependency
    async def override_get_redis():
        yield redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        yield client

    # Clean up overrides
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Data factory helpers
# ---------------------------------------------------------------------------
class IntegrationDataFactory:
    """
    Helpers to seed the database with minimal valid objects for
    integration tests.
    """

    def __init__(
        self,
        db: Session,
        redis: aioredis.Redis,
    ):
        self.db = db
        self.redis = redis

    def create_user(
        self,
        email: str | None = None,
        full_name: str = "Test User",
    ) -> "User":
        from app.models.user import User

        user = User(
            email=email or f"test-{uuid4().hex[:8]}@example.com",
            full_name=full_name,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    async def create_authenticated_session(self, user_id: UUID) -> str:
        """
        Create a session cookie in Redis exactly as the auth flow does.
        Returns the session_id string to be set as a cookie.
        """
        session_id = uuid4().hex
        await self.redis.set(
            f"session:{session_id}",
            str(user_id),
            ex=settings.SESSION_EXPIRE_SECONDS,
        )
        return session_id

    def create_repository(
        self,
        user_id: UUID,
        owner: str = "test-owner",
        name: str = "test-repo",
    ) -> "Repository":
        from app.models.repository import Repository, UserRepository

        repo = Repository(
            github_repo_id=f"gh-{uuid4().hex[:12]}",
            owner=owner,
            name=name,
            clone_url=f"https://github.com/{owner}/{name}.git",
            is_private=False,
        )
        self.db.add(repo)
        self.db.flush()

        user_repo = UserRepository(
            user_id=user_id,
            repository_id=repo.id,
        )
        self.db.add(user_repo)
        self.db.commit()
        self.db.refresh(repo)
        return repo

    def create_successful_version(
        self,
        repository_id: UUID,
        commit_sha: str | None = None,
        branch: str = "main",
    ) -> "RepositoryVersion":
        from app.models.repository import RepositoryVersion

        version = RepositoryVersion(
            repository_id=repository_id,
            commit_sha=commit_sha or uuid4().hex[:40],
            branch=branch,
            index_status="SUCCESS",
            indexed_at=datetime.now(timezone.utc),
        )
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version

    def create_file_with_chunks(
        self,
        version_id: UUID,
        file_path: str = "src/main.py",
        content: str = "def hello():\n    return 'world'",
        num_chunks: int = 1,
    ) -> tuple:
        """Creates a File and CodeChunks.  Returns (file, [chunks])."""
        from app.models.knowledge import File, CodeChunk

        f = File(
            repository_version_id=version_id,
            file_path=file_path,
            file_name=file_path.rsplit("/", 1)[-1],
            language="python",
            size_bytes=len(content),
            hash=uuid4().hex[:32],
        )
        self.db.add(f)
        self.db.flush()

        chunks = []
        lines = content.split("\n")
        chunk_size = max(1, len(lines) // num_chunks)
        for i in range(num_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(lines))
            chunk_content = "\n".join(lines[start:end])
            chunk = CodeChunk(
                file_id=f.id,
                content=chunk_content,
                start_line=start + 1,
                end_line=end,
                chunk_index=i,
            )
            self.db.add(chunk)
            chunks.append(chunk)

        self.db.commit()
        for c in chunks:
            self.db.refresh(c)
        self.db.refresh(f)
        return f, chunks

    def create_conversation(
        self,
        user_id: UUID,
        repository_id: UUID,
        version_id: UUID,
        title: str = "Test Conversation",
    ) -> "Conversation":
        from app.models.conversation import Conversation

        conv = Conversation(
            repository_id=repository_id,
            user_id=user_id,
            repository_version_id=version_id,
            title=title,
        )
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv


@pytest.fixture()
def data_factory(
    db_session: Session, redis_client: aioredis.Redis
) -> IntegrationDataFactory:
    return IntegrationDataFactory(db_session, redis_client)


# ---------------------------------------------------------------------------
# pg_connection_states helper
# ---------------------------------------------------------------------------
def pg_connection_states(engine) -> tuple[Counter, list[str]]:
    """
    Query ``pg_stat_activity`` for the test database and return a
    (Counter mapping state â†’ count, list of query texts for idle in transaction).

    Typical states: 'active', 'idle', 'idle in transaction',
    'idle in transaction (aborted)'.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT state, query "
                "FROM pg_stat_activity "
                "WHERE datname = :db AND pid != pg_backend_pid()"
            ),
            {"db": _TEST_DB_NAME},
        ).fetchall()

    states = Counter(row[0] for row in rows)
    idle_queries = [row[1] for row in rows if row[0] == "idle in transaction"]
    return states, idle_queries


# ---------------------------------------------------------------------------
# Real Uvicorn Server for streaming disconnects
# ---------------------------------------------------------------------------
import uvicorn
from contextlib import asynccontextmanager
import httpx

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]

@pytest.fixture(scope="session")
def real_uvicorn_server():
    from app.main import app
    port = get_free_port()
    config = uvicorn.Config(app=app, host="127.0.0.1", port=port, log_level="critical")
    server = uvicorn.Server(config=config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    start = time.time()
    while not getattr(server, "started", False):
        if time.time() - start > 10:
            raise RuntimeError("Uvicorn server failed to start")
        time.sleep(0.1)

    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)

@pytest.fixture()
def app_streaming_client(real_uvicorn_server):
    @asynccontextmanager
    async def _client():
        async with httpx.AsyncClient(base_url=real_uvicorn_server) as client:
            yield client
    return _client
