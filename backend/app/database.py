import asyncpg
import os
from contextlib import asynccontextmanager
from app.config import get_settings

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30
        )
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

@asynccontextmanager
async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
