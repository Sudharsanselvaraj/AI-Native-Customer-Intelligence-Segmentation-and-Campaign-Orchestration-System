import redis.asyncio as aioredis
from app.core.config import settings
from typing import Optional
import json

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def cache_set(key: str, value: any, ttl: int = 300):
    r = await get_redis()
    await r.setex(key, ttl, json.dumps(value))


async def cache_get(key: str) -> Optional[any]:
    r = await get_redis()
    val = await r.get(key)
    if val:
        return json.loads(val)
    return None


async def cache_delete(key: str):
    r = await get_redis()
    await r.delete(key)


async def cache_delete_pattern(pattern: str):
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)
