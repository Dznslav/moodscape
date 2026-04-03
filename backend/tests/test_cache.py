import asyncio
from app.core.redis import redis_client


async def main():
    await redis_client.set('cold_prediction:1:2026-03-20', 'abc')
    keys = await redis_client.keys('cold_prediction:1:*')
    print(f'Found keys: {keys}')
    if keys:
        await redis_client.delete(*keys)
    print('Done!')

asyncio.run(main())
