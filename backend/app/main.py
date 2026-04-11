"""
Health Data Bank - FastAPI Backend
"""
from contextlib import asynccontextmanager
import logging
from uuid import UUID
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.dependency import set_rls_context
from app.core.security import decode_access_token
from app.api.routes import router as api_router
from app.db.models import Role, UserRole
from app.db.session import AsyncSessionLocal
from app.db.session import get_db
from app.services.admin_service import get_maintenance_settings
from app.services.session_service import get_active_session
from app.seeds.onboarding_seed import seed_onboarding_data
from app.seeds.rbac_seed import seed_rbac
from app.seeds.data_element_seed import seed_profile_data_elements
from app.services.notification_scheduler import (
    start_notification_scheduler,
    stop_notification_scheduler,
)

logger = logging.getLogger(__name__)

_MAINTENANCE_BYPASS_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/health/",
    "/api/v1/health/db",
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
}


async def _request_has_admin_session(request) -> bool:
    token = request.cookies.get("token")
    if not token:
        return False

    payload = decode_access_token(token)
    if not payload:
        return False

    user_id = payload.get("sub")
    session_id = payload.get("session_id")
    if not user_id or not session_id:
        return False

    try:
        session_uuid = UUID(str(session_id))
    except (TypeError, ValueError):
        return False

    async with AsyncSessionLocal() as db:
        session = await get_active_session(session_uuid, db)
        if not session or str(session.user_id) != str(user_id):
            return False

        role_name = await db.scalar(
            select(Role.role_name)
            .join(UserRole, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == session.user_id)
            .limit(1)
        )
        return str(role_name or "").strip().lower() == "admin"


async def _maintenance_response():
    async with AsyncSessionLocal() as db:
        settings_payload = await get_maintenance_settings(db)
    return JSONResponse(
        status_code=503,
        content={
            "detail": settings_payload.message,
            "code": "maintenance_mode",
            "maintenance": {
                "enabled": settings_payload.enabled,
                "message": settings_payload.message,
            },
        },
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async for db in get_db():
            try:
                await set_rls_context(db, role="admin")
                await seed_rbac(db)
                await seed_onboarding_data(db)
                await seed_profile_data_elements(db)
            except Exception as exc:
                logger.warning("Startup onboarding seed skipped: %s", exc)
            break
    except Exception as exc:
        logger.warning("Startup DB initialization skipped: %s", exc)

    try:
        await start_notification_scheduler()
    except Exception as exc:
        logger.warning("Notification scheduler startup skipped: %s", exc)

    yield
    stop_notification_scheduler()


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
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)


@app.middleware("http")
async def enforce_maintenance_mode(request, call_next):
    path = request.url.path
    if path in _MAINTENANCE_BYPASS_PATHS or path.startswith("/api/v1/health"):
        return await call_next(request)

    async with AsyncSessionLocal() as db:
        maintenance = await get_maintenance_settings(db)

    if not maintenance.enabled:
        return await call_next(request)

    if await _request_has_admin_session(request):
        return await call_next(request)

    return await _maintenance_response()

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
