import redis.asyncio as redis
from app.core.config import settings

# Global redis client
_redis_client = None

async def get_redis_client() -> redis.Redis:
    """
    Get or create a reusable Redis client instance.
    This creates an async connection pool.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client

async def close_redis_client():
    """Close the redis client connection pool."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
