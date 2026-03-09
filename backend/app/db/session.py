from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.db import engine
from sqlalchemy.ext.asyncio import async_sessionmaker

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db
        await db.commit()
