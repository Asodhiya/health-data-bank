"""
Participant-only routes.

All endpoints here are restricted to users with the participant role.
The participant_id is resolved directly from the authenticated user's
pre-loaded profile — no extra DB lookup required.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.db.queries.Queries import ParticipantQuery
from app.schemas.schemas import HealthGoalPayload, HealthGoalUpdate
import uuid

router = APIRouter()


def get_participant_id(current_user: User) -> uuid.UUID:
    """
    Extract participant_id from the authenticated user's loaded profile.

    Raises 403 if the user does not have a participant profile.
    """
    if not current_user.participant_profile:
        raise HTTPException(status_code=403, detail="Not a participant")
    return current_user.participant_profile.participant_id


@router.get("/goals")
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:Displayall")),
):
    """
    Return all health goals belonging to the authenticated participant.

    Requires permission: Goal:Displayall
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).get_goals(participant_id)


@router.post("/goals")
async def create_goal(
    payload: HealthGoalPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:AddGoals")),
):
    """
    Create a new health goal for the authenticated participant.

    Requires permission: Goal:Displayall
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).set_goal(participant_id, payload)


@router.get("/goals/{goal_id}")
async def get_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:Displayall")),
):
    """
    Retrieve a single health goal by ID.

    Returns 404 if the goal does not exist or does not belong to the participant.
    """
    participant_id = get_participant_id(current_user)
    goal = await ParticipantQuery(db).get_goal(goal_id, participant_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: uuid.UUID,
    payload: HealthGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:Edit")),
):
    """
    Partially update a health goal.

    Only the fields provided in the request body are updated;
    omitted fields remain unchanged.
    Returns 404 if the goal does not exist or does not belong to the participant.
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).update_goal(goal_id, participant_id, payload)


@router.delete("/goals/{goal_id}")
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:Delete")),
):
    """
    Delete a health goal by ID.

    Returns 404 if the goal does not exist or does not belong to the participant.
    """
    participant_id = get_participant_id(current_user)
    await ParticipantQuery(db).delete_goal(goal_id, participant_id)
    return {"detail": "Goal deleted"}
