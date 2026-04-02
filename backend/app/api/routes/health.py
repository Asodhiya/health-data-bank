"""
Health Check Routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def health_check():
    """API health check"""
    return {
        "status": "healthy",
        "service": "Health Data Bank API"
    }


@router.get("/db")
async def database_health(db: AsyncSession = Depends(get_db)):
    """Database connection health check — actually pings the DB."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "unhealthy", "database": "disconnected"}