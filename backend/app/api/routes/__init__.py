"""
API Routes
"""
from fastapi import APIRouter

from app.api.routes import auth, health, survey, form_management , admin_only

router = APIRouter()

# Include route modules
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(health.router, prefix="/health", tags=["Health"])
router.include_router(form_management.router, prefix="/form_management", tags=["form_management"])
router.include_router(admin_only.router, prefix="/admin_only", tags=["AdminOnly"])
