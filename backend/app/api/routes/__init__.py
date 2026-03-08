"""
API Routes
"""
from fastapi import APIRouter

from app.api.routes import auth, health, form_management, admin_only, user, participant_survey, participants_only

router = APIRouter()

# Include route modules
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(health.router, prefix="/health", tags=["Health"])
router.include_router(form_management.router, prefix="/form_management", tags=["form_management"])
router.include_router(admin_only.router, prefix="/admin_only", tags=["AdminOnly"])
router.include_router(user.router, prefix="/user", tags=["User"])
router.include_router(participant_survey.router, prefix="/participant/surveys", tags=["Participant Surveys"])
router.include_router(participants_only.router, prefix="/participant", tags=["Participant"])
