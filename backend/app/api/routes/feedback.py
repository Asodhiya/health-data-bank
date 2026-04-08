from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import USER_READ, USER_WRITE
from app.db.models import User
from app.db.session import get_db
from app.schemas.schemas import (
    SystemFeedbackCreate,
    SystemFeedbackItem,
    SystemFeedbackStatusUpdate,
)
from app.services.feedback_service import (
    list_my_feedback,
    list_system_feedback,
    submit_system_feedback,
    update_system_feedback_status,
)

router = APIRouter()


@router.post("", response_model=SystemFeedbackItem, status_code=201)
async def create_feedback(
    payload: SystemFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Submit feedback or report an issue to the platform team."""
    return await submit_system_feedback(payload, current_user.user_id, db)


@router.get("/me", response_model=list[SystemFeedbackItem])
async def get_my_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the authenticated user's feedback and issue submissions."""
    return await list_my_feedback(current_user.user_id, db)


@router.get("", response_model=list[SystemFeedbackItem], dependencies=[Depends(require_permissions(USER_READ))])
async def get_all_feedback(
    db: AsyncSession = Depends(get_db),
):
    """Admin inbox for all feedback and reported issues."""
    return await list_system_feedback(db)


@router.patch(
    "/{feedback_id}",
    response_model=SystemFeedbackItem,
    dependencies=[Depends(require_permissions(USER_WRITE))],
)
async def patch_feedback_status(
    feedback_id: UUID,
    payload: SystemFeedbackStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Admin triage for feedback and issue-center submissions."""
    return await update_system_feedback_status(feedback_id, payload, current_user.user_id, db)
