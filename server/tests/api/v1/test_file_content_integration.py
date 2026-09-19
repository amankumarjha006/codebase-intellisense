import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.models.user import User, GithubAccount
from app.models.repository import Repository, RepositoryVersion, UserRepository
from app.models.knowledge import File, CodeChunk
from app.api.deps import get_db, get_redis

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

@pytest.fixture
def mock_redis(mocker):
    mock_redis_client = AsyncMock()
    app.dependency_overrides[get_redis] = lambda: mock_redis_client
    yield mock_redis_client
    app.dependency_overrides.pop(get_redis, None)

@pytest_asyncio.fixture
async def async_client_integration(db_session, mock_redis):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.pop(get_db, None)

def setup_db_for_integration(db_session, mock_redis):
    user_id = uuid4()
    mock_redis.get.return_value = str(user_id)
    
    user = User(id=user_id, email=f"test_{uuid4()}@example.com", full_name="Test User")
    account = GithubAccount(github_user_id="123", username="testuser", access_token_encrypted="encrypted_tok")
    user.github_accounts = [account]
    db_session.add(user)
    db_session.commit()
    
    repo_a = Repository(
        owner="testowner",
        name=f"testrepoA_{uuid4()}",
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/testrepoA.git",
        is_private=False
    )
    
    repo_b = Repository(
        owner="testowner",
        name=f"testrepoB_{uuid4()}",
        github_repo_id=str(uuid4())[:20],
        clone_url="https://github.com/testowner/testrepoB.git",
        is_private=False
    )
    
    db_session.add_all([repo_a, repo_b])
    db_session.flush()

    user_repo_a = UserRepository(user_id=user.id, repository_id=repo_a.id)
    user_repo_b = UserRepository(user_id=user.id, repository_id=repo_b.id)
    db_session.add_all([user_repo_a, user_repo_b])
    db_session.commit()
    
    return user, repo_a, repo_b

@pytest.mark.asyncio
async def test_file_content_version_isolation(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Version V1: SUCCESS, older
    v1 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="abc1234", 
        branch="main", 
        index_status="SUCCESS",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    db_session.add(v1)
    db_session.commit()

    f1 = File(
        repository_version_id=v1.id,
        file_path="src/old.py",
        file_name="old.py",
        language="python",
        size_bytes=100,
        hash="hash1"
    )
    db_session.add(f1)
    db_session.commit()

    # Version V2: SUCCESS, newer
    v2 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="def5678", 
        branch="main", 
        index_status="SUCCESS",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    db_session.add(v2)
    db_session.commit()

    f2 = File(
        repository_version_id=v2.id,
        file_path="src/new.py",
        file_name="new.py",
        language="python",
        size_bytes=100,
        hash="hash2"
    )
    db_session.add(f2)
    db_session.commit()
    
    db_session.add(CodeChunk(file_id=f2.id, content="new content", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    # Active version should be V2
    # Verify GET F2 -> 200
    res_f2 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f2.id}")
    assert res_f2.status_code == 200
    assert res_f2.json()["content"] == "new content"

    # Verify GET F1 -> 404 (inaccessible because active version is V2)
    res_f1 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f1.id}")
    assert res_f1.status_code == 404
    assert res_f1.json()["error"]["code"] == "FILE_NOT_FOUND"

@pytest.mark.asyncio
async def test_file_content_pending_version_rejection(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Version V1: SUCCESS
    v1 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="v1sha", 
        branch="main", 
        index_status="SUCCESS",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    db_session.add(v1)
    db_session.commit()

    f1 = File(
        repository_version_id=v1.id,
        file_path="src/v1.py",
        file_name="v1.py",
        language="python",
        size_bytes=100,
        hash="hash1"
    )
    db_session.add(f1)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f1.id, content="v1 content", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    # Version V2: PENDING (newer)
    v2 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="v2sha", 
        branch="main", 
        index_status="PENDING",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    db_session.add(v2)
    db_session.commit()

    f2 = File(
        repository_version_id=v2.id,
        file_path="src/v2.py",
        file_name="v2.py",
        language="python",
        size_bytes=100,
        hash="hash2"
    )
    db_session.add(f2)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f2.id, content="v2 content", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    # V1 is active. F1 is accessible.
    res_f1 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f1.id}")
    assert res_f1.status_code == 200

    # F2 is inaccessible
    res_f2 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f2.id}")
    assert res_f2.status_code == 404
    assert res_f2.json()["error"]["code"] == "FILE_NOT_FOUND"

@pytest.mark.asyncio
async def test_file_content_failed_version_rejection(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Version V1: SUCCESS
    v1 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="v1sha", 
        branch="main", 
        index_status="SUCCESS",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    db_session.add(v1)
    db_session.commit()

    f1 = File(
        repository_version_id=v1.id,
        file_path="src/v1.py",
        file_name="v1.py",
        language="python",
        size_bytes=100,
        hash="hash1"
    )
    db_session.add(f1)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f1.id, content="v1 content", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    # Version V2: FAILED (newer)
    v2 = RepositoryVersion(
        repository_id=repo_a.id, 
        commit_sha="v2sha", 
        branch="main", 
        index_status="FAILED",
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    db_session.add(v2)
    db_session.commit()

    f2 = File(
        repository_version_id=v2.id,
        file_path="src/v2.py",
        file_name="v2.py",
        language="python",
        size_bytes=100,
        hash="hash2"
    )
    db_session.add(f2)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f2.id, content="v2 content", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    # V1 is active. F1 is accessible.
    res_f1 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f1.id}")
    assert res_f1.status_code == 200

    # F2 is inaccessible
    res_f2 = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f2.id}")
    assert res_f2.status_code == 404
    assert res_f2.json()["error"]["code"] == "FILE_NOT_FOUND"

@pytest.mark.asyncio
async def test_file_content_cross_repository_rejection(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Repo A Version V_A
    v_a = RepositoryVersion(repository_id=repo_a.id, commit_sha="va", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc))
    db_session.add(v_a)
    db_session.commit()
    f_a = File(repository_version_id=v_a.id, file_path="A.py", file_name="A.py", language="python", size_bytes=100, hash="ha")
    db_session.add(f_a)
    db_session.commit()

    # Repo B Version V_B
    v_b = RepositoryVersion(repository_id=repo_b.id, commit_sha="vb", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc))
    db_session.add(v_b)
    db_session.commit()
    f_b = File(repository_version_id=v_b.id, file_path="B.py", file_name="B.py", language="python", size_bytes=100, hash="hb")
    db_session.add(f_b)
    db_session.commit()

    # Request F_B via Repo A
    res = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f_b.id}")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "FILE_NOT_FOUND"

@pytest.mark.asyncio
async def test_file_content_reconstruction_order(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v = RepositoryVersion(repository_id=repo_a.id, commit_sha="v1", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc))
    db_session.add(v)
    db_session.commit()

    f = File(repository_version_id=v.id, file_path="multi.py", file_name="multi.py", language="python", size_bytes=100, hash="h")
    db_session.add(f)
    db_session.commit()

    # Insert out of order but with correct chunk_index
    c2 = CodeChunk(file_id=f.id, content="third part", start_line=3, end_line=3, chunk_index=2)
    c0 = CodeChunk(file_id=f.id, content="first part\n", start_line=1, end_line=1, chunk_index=0)
    c1 = CodeChunk(file_id=f.id, content="second part\n", start_line=2, end_line=2, chunk_index=1)
    
    db_session.add_all([c2, c0, c1])
    db_session.commit()

    res = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f.id}")
    assert res.status_code == 200
    assert res.json()["content"] == "first part\nsecond part\nthird part"

@pytest.mark.asyncio
async def test_file_content_cross_version_chunk_isolation(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v1 = RepositoryVersion(repository_id=repo_a.id, commit_sha="v1", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc) - timedelta(hours=2))
    db_session.add(v1)
    db_session.commit()
    f1 = File(repository_version_id=v1.id, file_path="main.py", file_name="main.py", language="python", size_bytes=100, hash="h1")
    db_session.add(f1)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f1.id, content="OLD_CONTENT", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    v2 = RepositoryVersion(repository_id=repo_a.id, commit_sha="v2", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc) - timedelta(hours=1))
    db_session.add(v2)
    db_session.commit()
    f2 = File(repository_version_id=v2.id, file_path="main.py", file_name="main.py", language="python", size_bytes=100, hash="h2")
    db_session.add(f2)
    db_session.commit()
    db_session.add(CodeChunk(file_id=f2.id, content="NEW_CONTENT", start_line=1, end_line=1, chunk_index=0))
    db_session.commit()

    res = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f2.id}")
    assert res.status_code == 200
    assert res.json()["content"] == "NEW_CONTENT"
    assert "OLD_CONTENT" not in res.json()["content"]

@pytest.mark.asyncio
async def test_file_content_empty_file(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v = RepositoryVersion(repository_id=repo_a.id, commit_sha="v1", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc))
    db_session.add(v)
    db_session.commit()

    f = File(repository_version_id=v.id, file_path="empty.py", file_name="empty.py", language="python", size_bytes=0, hash="emptyhash")
    db_session.add(f)
    db_session.commit()
    # Intentionally insert NO chunks

    res = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f.id}")
    assert res.status_code == 200
    assert res.json()["content"] == ""

@pytest.mark.asyncio
async def test_file_content_unicode_reconstruction(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v = RepositoryVersion(repository_id=repo_a.id, commit_sha="v1", branch="main", index_status="SUCCESS", indexed_at=datetime.now(timezone.utc))
    db_session.add(v)
    db_session.commit()

    f = File(repository_version_id=v.id, file_path="unicode.py", file_name="unicode.py", language="python", size_bytes=100, hash="uhash")
    db_session.add(f)
    db_session.commit()

    unicode_content = 'def greet():\n    message = "こんにちは 🚀"\n    return message'
    db_session.add(CodeChunk(file_id=f.id, content=unicode_content, start_line=1, end_line=3, chunk_index=0))
    db_session.commit()

    res = await async_client_integration.get(f"{settings.API_V1_STR}/repositories/{repo_a.id}/files/{f.id}")
    assert res.status_code == 200
    assert res.json()["content"] == unicode_content
