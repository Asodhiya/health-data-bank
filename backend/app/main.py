"""
Health Data Bank - FastAPI Backend
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_pool, close_pool
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: open DB pool. Shutdown: close it."""
    await init_pool()
    yield
    await close_pool()


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API for Health Data Bank - A secure health data management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow frontend with credentials (cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "Health Data Bank API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
