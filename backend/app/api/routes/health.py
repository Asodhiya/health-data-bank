"""
Health Check Routes
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health_check():
    """API health check"""
    return {
        "status": "healthy",
        "service": "Health Data Bank API"
    }


@router.get("/db")
async def database_health():
    """Database connection health check"""
    # TODO: Add actual database ping
    return {
        "status": "healthy",
        "database": "connected"
    }
