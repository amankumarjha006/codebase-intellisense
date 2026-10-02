import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import Request, Response
import time

from app.core.rate_limit import RateLimiter, RateLimitException, RateLimitInfrastructureException
from app.models.user import User

@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    # By default, mock eval to return [1, 60] (first request, 60s TTL)
    mock.eval.return_value = [1, 60]
    return mock

@pytest.fixture
def mock_request():
    req = MagicMock(spec=Request)
    req.url.path = "/api/v1/test"
    req.client.host = "127.0.0.1"
    return req

@pytest.fixture
def mock_response():
    resp = MagicMock(spec=Response)
    resp.headers = {}
    return resp

@pytest.fixture
def user():
    u = MagicMock(spec=User)
    u.id = "user-123"
    return u

@pytest.mark.asyncio
async def test_rate_limiter_allows_request(mock_redis, mock_request, mock_response, user):
    limiter = RateLimiter("test", limit=5, window=60)
    
    # Should not raise
    await limiter(request=mock_request, response=mock_response, redis_client=mock_redis, user=user)
    
    assert mock_response.headers["X-RateLimit-Limit"] == "5"
    assert mock_response.headers["X-RateLimit-Remaining"] == "4"
    assert "X-RateLimit-Reset" in mock_response.headers
    
    # Check that eval was called with correct arguments
    mock_redis.eval.assert_called_once()
    args = mock_redis.eval.call_args[0]
    assert args[2] == "rate_limit:test:user:user-123"
    assert args[3] == 5
    assert args[4] == 60

@pytest.mark.asyncio
async def test_rate_limiter_blocks_exceeded_request(mock_redis, mock_request, mock_response, user):
    limiter = RateLimiter("test", limit=5, window=60)
    
    # Mock redis to return count=6 (exceeded)
    mock_redis.eval.return_value = [6, 30]
    
    with pytest.raises(RateLimitException) as exc_info:
        await limiter(request=mock_request, response=mock_response, redis_client=mock_redis, user=user)
        
    assert exc_info.value.limit == 5
    assert exc_info.value.remaining == 0
    assert exc_info.value.reset == 30
    
    # Headers should still be populated
    assert mock_response.headers["X-RateLimit-Remaining"] == "0"

@pytest.mark.asyncio
async def test_rate_limiter_unauthenticated_fallback(mock_redis, mock_request, mock_response):
    limiter = RateLimiter("test", limit=5, window=60)
    
    await limiter(request=mock_request, response=mock_response, redis_client=mock_redis, user=None)
    
    # Should use IP
    args = mock_redis.eval.call_args[0]
    assert args[2] == "rate_limit:test:user:127.0.0.1"

@pytest.mark.asyncio
async def test_rate_limiter_infrastructure_failure(mock_redis, mock_request, mock_response, user):
    limiter = RateLimiter("test", limit=5, window=60)
    
    mock_redis.eval.side_effect = Exception("Redis is down")
    
    with pytest.raises(RateLimitInfrastructureException) as exc_info:
        await limiter(request=mock_request, response=mock_response, redis_client=mock_redis, user=user)
        
    assert "infrastructure failure" in exc_info.value.message
