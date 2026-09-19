"""
Tests for the retrieval domain layer.

Tests the internal contracts (RetrievalRequest, RetrievalResult,
RetrievalService, KeywordRetrievalStrategy) independently of the HTTP API.
"""
import pytest
from uuid import uuid4, UUID
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock

from app.core.config import settings
from app.models.repository import Repository, RepositoryVersion, UserRepository
from app.models.user import User, GithubAccount
from app.models.knowledge import File, CodeChunk
from app.repositories.knowledge import KnowledgeRepository
from app.services.retrieval.models import RetrievalRequest, RetrievalResult
from app.services.retrieval.strategies import KeywordRetrievalStrategy, RetrievalStrategy
from app.services.retrieval.service import RetrievalService

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _create_user(db_session) -> User:
    user = User(id=uuid4(), email=f"test_{uuid4()}@example.com", full_name="Test User")
    account = GithubAccount(github_user_id="123", username="testuser", access_token_encrypted="tok")
    user.github_accounts = [account]
    db_session.add(user)
    db_session.commit()
    return user


def _create_repo(db_session, user: User) -> Repository:
    repo = Repository(
        owner="testowner",
        name=f"repo_{uuid4()}",
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/repo.git",
        is_private=False,
    )
    db_session.add(repo)
    db_session.flush()
    db_session.add(UserRepository(user_id=user.id, repository_id=repo.id))
    db_session.commit()
    return repo


def _create_version(db_session, repo_id: UUID, status: str = "SUCCESS", hours_ago: int = 1) -> RepositoryVersion:
    v = RepositoryVersion(
        repository_id=repo_id,
        commit_sha=f"sha_{uuid4()}"[:10],
        branch="main",
        index_status=status,
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
    )
    db_session.add(v)
    db_session.commit()
    return v


def _create_file(db_session, version_id: UUID, path: str = "src/main.py") -> File:
    f = File(
        repository_version_id=version_id,
        file_path=path,
        file_name=path.split("/")[-1],
        language="python",
        size_bytes=100,
        hash=f"hash_{uuid4()}"[:12],
    )
    db_session.add(f)
    db_session.commit()
    return f


def _create_chunk(db_session, file_id: UUID, content: str, chunk_index: int = 0, symbol_id: UUID | None = None) -> CodeChunk:
    c = CodeChunk(
        file_id=file_id,
        symbol_id=symbol_id,
        content=content,
        start_line=chunk_index * 10 + 1,
        end_line=(chunk_index + 1) * 10,
        chunk_index=chunk_index,
    )
    db_session.add(c)
    db_session.commit()
    return c


# ===========================================================================
# RetrievalRequest tests
# ===========================================================================

class TestRetrievalRequest:
    def test_preserves_version_id(self):
        vid = uuid4()
        req = RetrievalRequest(repository_version_id=vid, query="test", limit=10)
        assert req.repository_version_id == vid

    def test_preserves_query(self):
        req = RetrievalRequest(repository_version_id=uuid4(), query="hello world")
        assert req.query == "hello world"

    def test_default_limit(self):
        req = RetrievalRequest(repository_version_id=uuid4(), query="q")
        assert req.limit == 20

    def test_custom_limit(self):
        req = RetrievalRequest(repository_version_id=uuid4(), query="q", limit=5)
        assert req.limit == 5

    def test_is_frozen(self):
        req = RetrievalRequest(repository_version_id=uuid4(), query="q")
        with pytest.raises(AttributeError):
            req.query = "modified"


# ===========================================================================
# RetrievalResult tests
# ===========================================================================

class TestRetrievalResult:
    def test_full_provenance(self):
        chunk_id = uuid4()
        version_id = uuid4()
        file_id = uuid4()
        symbol_id = uuid4()

        r = RetrievalResult(
            code_chunk_id=chunk_id,
            repository_version_id=version_id,
            file_id=file_id,
            symbol_id=symbol_id,
            file_path="src/auth.py",
            content="def login(): pass",
            start_line=1,
            end_line=10,
            score=0.95,
            source="keyword",
        )
        assert r.code_chunk_id == chunk_id
        assert r.repository_version_id == version_id
        assert r.file_id == file_id
        assert r.symbol_id == symbol_id
        assert r.file_path == "src/auth.py"
        assert r.content == "def login(): pass"
        assert r.start_line == 1
        assert r.end_line == 10
        assert r.score == 0.95
        assert r.source == "keyword"

    def test_symbol_id_none(self):
        r = RetrievalResult(
            code_chunk_id=uuid4(),
            repository_version_id=uuid4(),
            file_id=uuid4(),
            symbol_id=None,
            file_path="test.py",
            content="x",
            start_line=1,
            end_line=1,
            score=1.0,
            source="keyword",
        )
        assert r.symbol_id is None

    def test_is_frozen(self):
        r = RetrievalResult(
            code_chunk_id=uuid4(),
            repository_version_id=uuid4(),
            file_id=uuid4(),
            symbol_id=None,
            file_path="t.py",
            content="c",
            start_line=1,
            end_line=1,
            score=1.0,
            source="keyword",
        )
        with pytest.raises(AttributeError):
            r.score = 0.5


# ===========================================================================
# RetrievalService tests (with mock strategy)
# ===========================================================================

class TestRetrievalService:
    def test_delegates_to_strategy(self):
        mock_strategy = MagicMock(spec=RetrievalStrategy)
        expected = [
            RetrievalResult(
                code_chunk_id=uuid4(),
                repository_version_id=uuid4(),
                file_id=uuid4(),
                symbol_id=None,
                file_path="a.py",
                content="match",
                start_line=1,
                end_line=5,
                score=1.0,
                source="keyword",
            )
        ]
        mock_strategy.retrieve.return_value = expected

        service = RetrievalService(mock_strategy)
        req = RetrievalRequest(repository_version_id=uuid4(), query="match", limit=10)
        results = service.search(req)

        mock_strategy.retrieve.assert_called_once_with(req)
        assert results == expected

    def test_preserves_ordering(self):
        mock_strategy = MagicMock(spec=RetrievalStrategy)
        items = [
            RetrievalResult(
                code_chunk_id=uuid4(), repository_version_id=uuid4(), file_id=uuid4(),
                symbol_id=None, file_path=f"{i}.py", content=f"c{i}",
                start_line=1, end_line=1, score=1.0, source="keyword",
            )
            for i in range(5)
        ]
        mock_strategy.retrieve.return_value = items

        service = RetrievalService(mock_strategy)
        results = service.search(RetrievalRequest(repository_version_id=uuid4(), query="c"))

        assert [r.file_path for r in results] == ["0.py", "1.py", "2.py", "3.py", "4.py"]

    def test_empty_results(self):
        mock_strategy = MagicMock(spec=RetrievalStrategy)
        mock_strategy.retrieve.return_value = []

        service = RetrievalService(mock_strategy)
        results = service.search(RetrievalRequest(repository_version_id=uuid4(), query="nope"))
        assert results == []


# ===========================================================================
# KeywordRetrievalStrategy integration tests (real DB)
# ===========================================================================

class TestKeywordRetrievalStrategyIntegration:
    def test_basic_match(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        c = _create_chunk(db_session, f.id, "def awesome(): pass")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        req = RetrievalRequest(repository_version_id=v.id, query="awesome")
        results = strategy.retrieve(req)

        assert len(results) == 1
        r = results[0]
        assert r.code_chunk_id == c.id
        assert r.repository_version_id == v.id
        assert r.file_id == f.id
        assert r.file_path == "src/main.py"
        assert r.content == "def awesome(): pass"
        assert r.score == 1.0
        assert r.source == "keyword"

    def test_no_match(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        _create_chunk(db_session, f.id, "def hello(): pass")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="missing"))
        assert results == []

    def test_case_insensitive(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        _create_chunk(db_session, f.id, "UPPERCASE_FUNCTION")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="uppercase_function"))
        assert len(results) == 1

    def test_literal_percent(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        _create_chunk(db_session, f.id, "rate = 100%done")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="100%d"))
        assert len(results) == 1

    def test_literal_underscore(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        _create_chunk(db_session, f.id, "my_var = 42")
        _create_chunk(db_session, f.id, "myXvar = 99", chunk_index=1)

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        # literal _ should only match the first chunk
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="my_var"))
        assert len(results) == 1
        assert results[0].content == "my_var = 42"

    def test_deterministic_ordering(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)

        f_z = _create_file(db_session, v.id, "z.py")
        f_a = _create_file(db_session, v.id, "a.py")
        _create_chunk(db_session, f_z.id, "match z1", chunk_index=0)
        _create_chunk(db_session, f_z.id, "match z2", chunk_index=1)
        _create_chunk(db_session, f_a.id, "match a1", chunk_index=0)

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="match"))

        assert len(results) == 3
        assert [r.content for r in results] == ["match a1", "match z1", "match z2"]

    def test_limit(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)
        for i in range(10):
            _create_chunk(db_session, f.id, f"common {i}", chunk_index=i)

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="common", limit=3))
        assert len(results) == 3

    def test_version_isolation(self, db_session):
        user = _create_user(db_session)
        repo = _create_repo(db_session, user)

        v_a = _create_version(db_session, repo.id, hours_ago=2)
        f_a = _create_file(db_session, v_a.id, "src/a.py")
        _create_chunk(db_session, f_a.id, "version_a_secret")

        v_b = _create_version(db_session, repo.id, hours_ago=1)
        f_b = _create_file(db_session, v_b.id, "src/b.py")
        _create_chunk(db_session, f_b.id, "version_b_secret")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))

        results_a = strategy.retrieve(RetrievalRequest(repository_version_id=v_a.id, query="secret"))
        assert len(results_a) == 1
        assert results_a[0].content == "version_a_secret"

        results_b = strategy.retrieve(RetrievalRequest(repository_version_id=v_b.id, query="secret"))
        assert len(results_b) == 1
        assert results_b[0].content == "version_b_secret"

    def test_cross_repository_isolation(self, db_session):
        user = _create_user(db_session)
        repo_1 = _create_repo(db_session, user)
        repo_2 = _create_repo(db_session, user)

        v1 = _create_version(db_session, repo_1.id)
        f1 = _create_file(db_session, v1.id)
        _create_chunk(db_session, f1.id, "shared_keyword")

        v2 = _create_version(db_session, repo_2.id)
        f2 = _create_file(db_session, v2.id)
        _create_chunk(db_session, f2.id, "shared_keyword")

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))

        results_1 = strategy.retrieve(RetrievalRequest(repository_version_id=v1.id, query="shared_keyword"))
        assert len(results_1) == 1
        assert results_1[0].file_id == f1.id

        results_2 = strategy.retrieve(RetrievalRequest(repository_version_id=v2.id, query="shared_keyword"))
        assert len(results_2) == 1
        assert results_2[0].file_id == f2.id

    def test_symbol_id_preserved(self, db_session):
        """Verify that symbol_id from the CodeChunk is carried into the RetrievalResult."""
        from app.models.knowledge import Symbol

        user = _create_user(db_session)
        repo = _create_repo(db_session, user)
        v = _create_version(db_session, repo.id)
        f = _create_file(db_session, v.id)

        sym = Symbol(
            file_id=f.id,
            name="my_func",
            qualified_name="src.main.my_func",
            symbol_type="function",
            start_line=1,
            end_line=5,
        )
        db_session.add(sym)
        db_session.commit()

        _create_chunk(db_session, f.id, "def my_func(): pass", symbol_id=sym.id)

        strategy = KeywordRetrievalStrategy(KnowledgeRepository(db_session))
        results = strategy.retrieve(RetrievalRequest(repository_version_id=v.id, query="my_func"))
        assert len(results) == 1
        assert results[0].symbol_id == sym.id
