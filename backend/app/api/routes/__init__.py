"""
API Routes
"""
from fastapi import APIRouter

from app.api.routes import (
    auth,
    health,
    form_management,
    admin_only,
    user,
    participant_survey,
    participants_only,
    researcher_query_data,
    stats,
    data_elements,
    goal_templates,
    Caretakers,
)

router = APIRouter()

# Include route modules
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(health.router, prefix="/health", tags=["Health"])
router.include_router(form_management.router, prefix="/form_management", tags=["Form Management"])
router.include_router(admin_only.router, prefix="/admin_only", tags=["Admin Only"])
router.include_router(user.router, prefix="/user", tags=["User"])
router.include_router(participant_survey.router, prefix="/participant/surveys", tags=["Participant Surveys"])
router.include_router(participants_only.router, prefix="/participant", tags=["Participant"])
router.include_router(researcher_query_data.router, prefix="/researcher/query", tags=["Researcher Query"])
router.include_router(stats.router, prefix="/stats", tags=["Stats"])
router.include_router(data_elements.router, prefix="/data-elements", tags=["Data Elements"])
router.include_router(goal_templates.router, prefix="/goal-templates", tags=["Goal Templates"])
router.include_router(Caretakers.router, prefix="/caretaker", tags=["Caretaker"])
