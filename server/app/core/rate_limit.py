import logging
import time
from typing import Optional
import redis.asyncio as redis
from fastapi import Request, Depends, Response
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.deps import get_current_user, get_redis
from app.models.user import User

logger = logging.getLogger(__name__)

class RateLimitException(Exception):
    def __init__(self, message: str, limit: int, remaining: int, reset: int):
        self.message = message
        self.limit = limit
        self.remaining = remaining
        self.reset = reset

class RateLimitInfrastructureException(Exception):
    def __init__(self, message: str):
        self.message = message

# Atomic increment + expire using Lua script to avoid race conditions.
# Returns {current_count, ttl}
RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call("INCR", key)
if current == 1 then
    redis.call("EXPIRE", key, window)
end
local ttl = redis.call("TTL", key)
return {current, ttl}
"""

class RateLimiter:
    def __init__(self, category: str, limit: int, window: int):
        self.category = category
        self.limit = limit
        self.window = window

    async def __call__(
        self,
        request: Request,
        response: Response,
        redis_client: redis.Redis = Depends(get_redis),
        user: Optional[User] = Depends(get_current_user)
    ):
        if not settings.RATE_LIMIT_ENABLED:
            return
            
        # Determine identity
        if user:
            identity = str(user.id)
        else:
            identity = request.client.host if request.client else "unknown"
            
        key = f"rate_limit:{self.category}:user:{identity}"
        
        try:
            # Execute Lua script for atomicity
            result = await redis_client.eval(
                RATE_LIMIT_SCRIPT, 1, key, self.limit, self.window
            )
            current_count = int(result[0])
            ttl = int(result[1])
        except Exception as e:
            # If Redis fails, log and fail closed (503 Service Unavailable)
            logger.error("rate_limit_infrastructure_error", extra={
                "error": str(e),
                "category": self.category,
                "identity": identity
            })
            raise RateLimitInfrastructureException(message="Service temporarily unavailable due to infrastructure failure") from e
            
        remaining = max(0, self.limit - current_count)
        
        # Add safe rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + ttl))

        if current_count > self.limit:
            logger.warning("rate_limit_rejected", extra={
                "category": self.category,
                "configured_limit": self.limit,
                "remaining_requests": 0,
                "reset_time": ttl,
                "identity_type": "user" if user else "ip",
                "path": request.url.path
            })
            raise RateLimitException(
                message=f"Rate limit exceeded for {self.category}",
                limit=self.limit,
                remaining=0,
                reset=ttl
            )
            
        logger.debug("rate_limit_allowed", extra={
            "category": self.category,
            "configured_limit": self.limit,
            "remaining_requests": remaining,
            "reset_time": ttl,
            "identity_type": "user" if user else "ip",
            "path": request.url.path
        })

general_rate_limiter = RateLimiter(
    category="general",
    limit=settings.RATE_LIMIT_GENERAL_REQUESTS,
    window=settings.RATE_LIMIT_GENERAL_WINDOW_SECONDS
)

rag_rate_limiter = RateLimiter(
    category="rag",
    limit=settings.RATE_LIMIT_RAG_REQUESTS,
    window=settings.RATE_LIMIT_RAG_WINDOW_SECONDS
)

stream_rate_limiter = RateLimiter(
    category="stream",
    limit=settings.RATE_LIMIT_STREAM_REQUESTS,
    window=settings.RATE_LIMIT_STREAM_WINDOW_SECONDS
)
