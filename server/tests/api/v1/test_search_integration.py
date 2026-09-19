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

def create_version_file_chunk(db_session, repo_id, status, content, file_path="src/main.py", hours_ago=1):
    v = RepositoryVersion(
        repository_id=repo_id,
        commit_sha=f"sha_{uuid4()}"[:10],
        branch="main",
        index_status=status,
        indexed_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    )
    db_session.add(v)
    db_session.commit()
    
    f = File(
        repository_version_id=v.id,
        file_path=file_path,
        file_name=file_path.split("/")[-1],
        language="python",
        size_bytes=len(content),
        hash="hash_" + str(uuid4())[:8]
    )
    db_session.add(f)
    db_session.commit()
    
    c = CodeChunk(
        file_id=f.id,
        content=content,
        start_line=1,
        end_line=content.count("\n") + 1,
        chunk_index=0
    )
    db_session.add(c)
    db_session.commit()
    
    return v, f, c

@pytest.mark.asyncio
async def test_search_active_success_version(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "def old_func(): pass", hours_ago=2)
    v2, f2, c2 = create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "def awesome_new_func(): pass", hours_ago=1)
    
    # 1. Matching keyword
    req = {"query": "awesome"}
    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["repository_version_id"] == str(v2.id)
    assert len(data["results"]) == 1
    assert data["results"][0]["id"] == str(c2.id)
    assert data["results"][0]["snippet"] == "def awesome_new_func(): pass"
    assert data["results"][0]["score"] == 1.0

    # 2. No matches
    req2 = {"query": "missing"}
    res2 = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json=req2)
    assert res2.status_code == 200
    assert len(res2.json()["results"]) == 0

@pytest.mark.asyncio
async def test_search_multiple_matches_and_ordering(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v1 = RepositoryVersion(
        repository_id=repo_a.id, commit_sha="abc", branch="main", 
        index_status="SUCCESS", indexed_at=datetime.now(timezone.utc)
    )
    db_session.add(v1)
    db_session.commit()
    
    # Add files in non-alphabetical order
    f_z = File(repository_version_id=v1.id, file_path="z_file.py", file_name="z_file.py", language="python", size_bytes=10, hash="1")
    f_a = File(repository_version_id=v1.id, file_path="a_file.py", file_name="a_file.py", language="python", size_bytes=10, hash="2")
    db_session.add_all([f_z, f_a])
    db_session.commit()

    # Chunks in reverse index order
    c_z2 = CodeChunk(file_id=f_z.id, content="match z2", start_line=10, end_line=15, chunk_index=1)
    c_z1 = CodeChunk(file_id=f_z.id, content="match z1", start_line=1, end_line=5, chunk_index=0)
    c_a1 = CodeChunk(file_id=f_a.id, content="match a1", start_line=1, end_line=5, chunk_index=0)
    db_session.add_all([c_z2, c_z1, c_a1])
    db_session.commit()

    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "match"})
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 3
    # Deterministic order: File_path ASC, chunk_index ASC
    assert results[0]["snippet"] == "match a1"
    assert results[1]["snippet"] == "match z1"
    assert results[2]["snippet"] == "match z2"

@pytest.mark.asyncio
async def test_search_explicit_older_success_version(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v1, f1, c1 = create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "def old_func(): pass", hours_ago=2)
    v2, f2, c2 = create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "def awesome_new_func(): pass", hours_ago=1)
    
    req = {"query": "old", "repository_version_id": str(v1.id)}
    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json=req)
    assert res.status_code == 200
    assert len(res.json()["results"]) == 1
    assert res.json()["results"][0]["snippet"] == "def old_func(): pass"

@pytest.mark.asyncio
async def test_search_rejects_pending_or_failed_explicit_version(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v_pending, _, _ = create_version_file_chunk(db_session, repo_a.id, "PENDING", "some pending code", hours_ago=2)
    v_failed, _, _ = create_version_file_chunk(db_session, repo_a.id, "FAILED", "some failed code", hours_ago=1)
    
    # Reject PENDING
    res1 = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={
        "query": "some", "repository_version_id": str(v_pending.id)
    })
    assert res1.status_code == 400
    assert res1.json()["error"]["code"] == "VERSION_NOT_READY"

    # Reject FAILED
    res2 = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={
        "query": "some", "repository_version_id": str(v_failed.id)
    })
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "VERSION_NOT_READY"

@pytest.mark.asyncio
async def test_search_active_ignores_pending_and_failed(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    # Older SUCCESS
    v_success, _, _ = create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "reliable code", hours_ago=3)
    # Newer PENDING and FAILED
    create_version_file_chunk(db_session, repo_a.id, "PENDING", "new code", hours_ago=2)
    create_version_file_chunk(db_session, repo_a.id, "FAILED", "broken code", hours_ago=1)
    
    # Search should hit the older SUCCESS version
    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "reliable"})
    assert res.status_code == 200
    assert len(res.json()["results"]) == 1
    assert res.json()["repository_version_id"] == str(v_success.id)

@pytest.mark.asyncio
async def test_search_rejects_cross_repository_version(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v_b, _, _ = create_version_file_chunk(db_session, repo_b.id, "SUCCESS", "repo b code", hours_ago=1)
    
    # Access repo A, but pass repo B's version ID
    req = {"query": "repo b", "repository_version_id": str(v_b.id)}
    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json=req)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "VERSION_NOT_FOUND"

@pytest.mark.asyncio
async def test_search_cross_version_chunk_isolation(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "secret_key=123", hours_ago=2)
    create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "secret_key=REMOVED", hours_ago=1)
    
    # Active version should only find the newer chunk
    res = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "secret_key"})
    assert res.status_code == 200
    assert len(res.json()["results"]) == 1
    assert res.json()["results"][0]["snippet"] == "secret_key=REMOVED"

@pytest.mark.asyncio
async def test_search_literal_wildcards_and_case(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v1, f1, c1 = create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "find_me%now\nFind_Me_Too\nSELECT * FROM auth", hours_ago=1)
    
    # Test case-insensitive
    res_case = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "find_me%NOW"})
    assert res_case.status_code == 200
    assert len(res_case.json()["results"]) == 1
    
    # Test literal '%'
    res_percent = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "%n"})
    assert res_percent.status_code == 200
    assert len(res_percent.json()["results"]) == 1

    # Test literal '_'
    res_underscore = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "_m"})
    assert res_underscore.status_code == 200
    assert len(res_underscore.json()["results"]) == 1

@pytest.mark.asyncio
async def test_search_empty_and_whitespace_query(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")
    create_version_file_chunk(db_session, repo_a.id, "SUCCESS", "some code", hours_ago=1)

    res_empty = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": ""})
    assert res_empty.status_code == 422
    
    res_white = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "  "})
    assert res_white.status_code == 422
    
    # Normal query works
    res_normal = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "some"})
    assert res_normal.status_code == 200

@pytest.mark.asyncio
async def test_search_limit_enforcement(async_client_integration, db_session, mock_redis):
    user, repo_a, repo_b = setup_db_for_integration(db_session, mock_redis)
    async_client_integration.cookies.set(settings.SESSION_COOKIE_NAME, "valid_session")

    v1 = RepositoryVersion(
        repository_id=repo_a.id, commit_sha="abc", branch="main", 
        index_status="SUCCESS", indexed_at=datetime.now(timezone.utc)
    )
    db_session.add(v1)
    db_session.commit()
    
    f1 = File(repository_version_id=v1.id, file_path="main.py", file_name="main.py", language="python", size_bytes=100, hash="1")
    db_session.add(f1)
    db_session.commit()

    # Create 30 chunks
    for i in range(30):
        c = CodeChunk(file_id=f1.id, content=f"common_word {i}", start_line=1, end_line=1, chunk_index=i)
        db_session.add(c)
    db_session.commit()

    # Default limit should be 20
    res_default = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "common_word"})
    assert res_default.status_code == 200
    assert len(res_default.json()["results"]) == 20

    # Custom limit within bounds
    res_custom = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "common_word", "limit": 5})
    assert res_custom.status_code == 200
    assert len(res_custom.json()["results"]) == 5

    # Exceeding maximum limit returns 422 (Pydantic validation limit: le=50)
    res_too_big = await async_client_integration.post(f"{settings.API_V1_STR}/repositories/{repo_a.id}/search", json={"query": "common_word", "limit": 100})
    assert res_too_big.status_code == 422
