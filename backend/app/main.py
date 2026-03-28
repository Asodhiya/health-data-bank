"""
Health Data Bank - FastAPI Backend
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router as api_router
from app.db.session import get_db
from app.seeds.onboarding_seed import seed_onboarding_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    async for db in get_db():
        await seed_onboarding_data(db)
        break
    yield


# Initialize FastAPI app
app = FastAPI(
    lifespan=lifespan,
    title=settings.APP_NAME,
    description="API for Health Data Bank - A secure health data management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Health Data Bank API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy"}
