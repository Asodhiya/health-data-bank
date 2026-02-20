"""
Health Data Bank - FastAPI Backend
Main entry point used by docker-compose (uvicorn app.core.main:app)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

app = FastAPI(
    title="Health Data Bank",
    description="API for Health Data Bank - A secure health data management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration — must match the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routes under /api/v1 (matches frontend API_BASE)
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Health Data Bank API",
        "status": "running",
        "docs": "/docs",
    }
