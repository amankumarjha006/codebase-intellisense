import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from app.main import app, get_docs_urls
from app.core.config import settings


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_ready_endpoint_success(async_client, mocker):
    """Test /ready returns 200 when both Postgres and Redis are healthy."""
    # Mock postgres connection
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.__exit__.return_value = None
    mocker.patch("app.main.engine.connect", return_value=mock_conn)

    # Mock redis client ping
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    mocker.patch("app.main.get_redis_client", return_value=mock_redis)

    response = await async_client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["checks"]["postgres"] == "ok"
    assert data["checks"]["redis"] == "ok"


@pytest.mark.asyncio
async def test_ready_endpoint_postgres_failure(async_client, mocker):
    """Test /ready returns 503 when Postgres fails."""
    mocker.patch("app.main.engine.connect", side_effect=Exception("Database connection timed out"))

    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    mocker.patch("app.main.get_redis_client", return_value=mock_redis)

    response = await async_client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["checks"]["postgres"] == "failed"
    assert data["checks"]["redis"] == "ok"
    assert "postgres" in data["failed"]
    # Ensure no secrets or internal connection strings leaked
    assert "password" not in response.text.lower()
    assert "postgresql://" not in response.text.lower()


@pytest.mark.asyncio
async def test_ready_endpoint_redis_failure(async_client, mocker):
    """Test /ready returns 503 when Redis fails."""
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.__exit__.return_value = None
    mocker.patch("app.main.engine.connect", return_value=mock_conn)

    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = Exception("Redis connection refused")
    mocker.patch("app.main.get_redis_client", return_value=mock_redis)

    response = await async_client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["checks"]["postgres"] == "ok"
    assert data["checks"]["redis"] == "failed"
    assert "redis" in data["failed"]
    assert "redis://" not in response.text.lower()


@pytest.mark.asyncio
async def test_ready_endpoint_both_failed(async_client, mocker):
    """Test /ready returns 503 when both dependencies fail."""
    mocker.patch("app.main.engine.connect", side_effect=Exception("DB down"))

    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = Exception("Redis down")
    mocker.patch("app.main.get_redis_client", return_value=mock_redis)

    response = await async_client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["checks"]["postgres"] == "failed"
    assert data["checks"]["redis"] == "failed"
    assert set(data["failed"]) == {"postgres", "redis"}


def test_docs_urls_helper():
    """Verify get_docs_urls logic for different environments and flags."""
    # Dev / test environments
    openapi, docs, redoc = get_docs_urls("development", False)
    assert docs == "/docs"
    assert redoc == "/redoc"
    assert openapi == f"{settings.API_V1_STR}/openapi.json"

    openapi, docs, redoc = get_docs_urls("test", False)
    assert docs == "/docs"

    # Production without flag
    openapi, docs, redoc = get_docs_urls("production", False)
    assert openapi is None
    assert docs is None
    assert redoc is None

    # Staging without flag
    openapi, docs, redoc = get_docs_urls("staging", False)
    assert openapi is None
    assert docs is None
    assert redoc is None

    # Production with flag
    openapi, docs, redoc = get_docs_urls("production", True)
    assert docs == "/docs"
    assert redoc == "/redoc"
    assert openapi == f"{settings.API_V1_STR}/openapi.json"


@pytest.mark.asyncio
async def test_docs_disabled_in_production_returns_404():
    """Verify that a FastAPI app configured with production settings disables /docs, /redoc, /openapi."""
    openapi_url, docs_url, redoc_url = get_docs_urls("production", enable_api_docs=False)
    prod_app = FastAPI(
        title="Production App",
        openapi_url=openapi_url,
        docs_url=docs_url,
        redoc_url=redoc_url,
    )

    async with AsyncClient(
        transport=ASGITransport(app=prod_app),
        base_url="http://test"
    ) as client:
        res_docs = await client.get("/docs")
        assert res_docs.status_code == 404

        res_redoc = await client.get("/redoc")
        assert res_redoc.status_code == 404

        res_openapi = await client.get(f"{settings.API_V1_STR}/openapi.json")
        assert res_openapi.status_code == 404


@pytest.mark.asyncio
async def test_health_remains_liveness(async_client):
    """Verify /health remains a lightweight liveness probe."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
