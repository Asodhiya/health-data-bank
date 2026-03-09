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
from app.db.queries.Queries import ParticipantQuery, GoalTemplateQuery, get_participant_id
from app.schemas.schemas import HealthGoalUpdate
import uuid

router = APIRouter()



@router.get("/goal-templates")
async def browse_goal_templates(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("Goal:Displayall")),
):
    """Browse all active goal templates available to add to the dashboard."""
    return await GoalTemplateQuery(db).list_templates()


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


@router.post("/goals/add/{template_id}")
async def add_goal_from_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Goal:AddGoals")),
    target_value: float | None = None,
):
    """
    Add a researcher-defined goal template to the participant's dashboard.
    target_value overrides the template's default_target if provided.
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).add_goal_from_template(participant_id, template_id, target_value)


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
