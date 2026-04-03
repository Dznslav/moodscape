import logging

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def safe_get(key: str):
    try:
        return await redis_client.get(key)
    except (redis.ConnectionError, redis.RedisError) as e:
        logger.warning("Redis GET failed for key %s: %s", key, e)
        return None


async def safe_set(key: str, value, **kwargs):
    try:
        return await redis_client.set(key, value, **kwargs)
    except (redis.ConnectionError, redis.RedisError) as e:
        logger.warning("Redis SET failed for key %s: %s", key, e)
        return None


async def safe_delete(*keys: str) -> int:
    try:
        return await redis_client.delete(*keys)
    except (redis.ConnectionError, redis.RedisError) as e:
        logger.warning("Redis DELETE failed: %s", e)
        return 0


async def delete_by_pattern(pattern: str, *, batch_size: int = 100) -> int:
    try:
        keys_to_delete = []
        deleted = 0

        async for key in redis_client.scan_iter(match=pattern, count=batch_size):
            keys_to_delete.append(key)

            if len(keys_to_delete) >= batch_size:
                deleted += await redis_client.delete(*keys_to_delete)
                keys_to_delete.clear()

        if keys_to_delete:
            deleted += await redis_client.delete(*keys_to_delete)

        return deleted
    except (redis.ConnectionError, redis.RedisError) as e:
        logger.warning("Redis delete_by_pattern failed for %s: %s", pattern, e)
        return 0
