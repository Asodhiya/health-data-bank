"""
Database Connection Pool
"""
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

from app.core.config import settings

# Global connection pool (initialized on app startup)
pool: AsyncConnectionPool | None = None


async def init_pool():
    """Create the async connection pool. Call once at app startup."""
    global pool
    pool = AsyncConnectionPool(
        conninfo=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        kwargs={"row_factory": dict_row},
    )
    await pool.open()


async def close_pool():
    """Close the connection pool. Call on app shutdown."""
    global pool
    if pool:
        await pool.close()
        pool = None


@asynccontextmanager
async def get_db():
    """
    Yield a database connection from the pool.

    Usage:
        async with get_db() as conn:
            result = await conn.execute("SELECT ...")
    """
    async with pool.connection() as conn:
        yield conn
