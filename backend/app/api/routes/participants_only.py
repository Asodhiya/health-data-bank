"""
Participant-only routes.

All endpoints here are restricted to users with the participant role.
The participant_id is resolved directly from the authenticated user's
pre-loaded profile — no extra DB lookup required.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, GroupMember, Group, CaretakerProfile, ParticipantProfile
from sqlalchemy import select
from app.db.session import get_db
from app.core.dependency import require_permissions, check_current_user
from app.core.permissions import GOAL_VIEW_ALL, GOAL_ADD, GOAL_EDIT, GOAL_DELETE
from app.db.queries.Queries import ParticipantQuery, GoalTemplateQuery, CaretakersQuery, get_participant_id
from app.schemas.schemas import HealthGoalUpdate, GoalProgressLog, GoalFromTemplateCreate
from app.schemas.notification_schema import NotificationItem
from app.schemas.caretaker_response_schema import FeedbackItem
from app.schemas.filter_data_schema import ParticipantProfileUpdate
from app.services.notification_service import (
    list_notifications_for_user,
    mark_notification_read_for_user,
    create_notification,
)
import uuid

router = APIRouter()


@router.get("/profile")
async def get_participant_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the authenticated participant's profile fields."""
    profile = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == current_user.user_id)
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Participant profile not found")

    return {
        "dob": str(profile.dob) if profile.dob else None,
        "gender": profile.gender,
        "pronouns": profile.pronouns,
        "primary_language": profile.primary_language,
        "country_of_origin": profile.country_of_origin,
        "occupation_status": profile.occupation_status,
        "living_arrangement": profile.living_arrangement,
        "highest_education_level": profile.highest_education_level,
        "dependents": profile.dependents,
        "marital_status": profile.marital_status,
        "address": current_user.Address,
        "program_enrolled_at": str(profile.program_enrolled_at) if profile.program_enrolled_at else None,
    }


@router.patch("/profile")
async def update_participant_profile(
    payload: ParticipantProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Update the authenticated participant's profile fields."""
    profile = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == current_user.user_id)
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Participant profile not found")

    update_data = payload.model_dump(exclude_none=True)

    if "dob" in update_data and isinstance(update_data["dob"], str) and update_data["dob"]:
        update_data["dob"] = date.fromisoformat(update_data["dob"])

    address = update_data.pop("address", None)
    if address is not None:
        current_user.Address = address

    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    await db.refresh(current_user)

    return {
        "dob": str(profile.dob) if profile.dob else None,
        "gender": profile.gender,
        "pronouns": profile.pronouns,
        "primary_language": profile.primary_language,
        "country_of_origin": profile.country_of_origin,
        "occupation_status": profile.occupation_status,
        "living_arrangement": profile.living_arrangement,
        "highest_education_level": profile.highest_education_level,
        "dependents": profile.dependents,
        "marital_status": profile.marital_status,
        "address": current_user.Address,
        "program_enrolled_at": str(profile.program_enrolled_at) if profile.program_enrolled_at else None,
    }


@router.get("/goal-templates")
async def browse_goal_templates(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """Browse all active goal templates available to add to the dashboard."""
    return await GoalTemplateQuery(db).list_templates()


@router.get("/goals")
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """
    Return all health goals belonging to the authenticated participant.

    Requires permission: goal:displayAll
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).get_goals(participant_id)


@router.post("/goals/add/{template_id}")
async def add_goal_from_template(
    template_id: uuid.UUID,
    payload: GoalFromTemplateCreate | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_ADD)),
):
    """
    Add a researcher-defined goal template to the participant's dashboard.
    target_value overrides the template's default_target if provided.
    window is selected by the participant and defaults to daily.
    """
    participant_id = get_participant_id(current_user)
    payload = payload or GoalFromTemplateCreate()
    return await ParticipantQuery(db).add_goal_from_template(
        participant_id,
        template_id,
        payload.target_value,
        payload.window,
    )


@router.get("/goals/{goal_id}")
async def get_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
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


@router.get("/goals/{goal_id}/progress")
async def get_goal_progress(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """
    Return all logged progress entries for a health goal.

    Entries are HealthDataPoints with source_type='goal', ordered oldest-first.
    Returns 404 if the goal does not exist or does not belong to the participant.
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).get_goal_progress(goal_id, participant_id)


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: uuid.UUID,
    payload: HealthGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_EDIT)),
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
    current_user: User = Depends(require_permissions(GOAL_DELETE)),
):
    """
    Delete a health goal by ID.

    Returns 404 if the goal does not exist or does not belong to the participant.
    """
    participant_id = get_participant_id(current_user)
    await ParticipantQuery(db).delete_goal(goal_id, participant_id)
    return {"detail": "Goal deleted"}


@router.get("/goals/{goal_id}/logs")
async def get_goal_logs(
    goal_id: uuid.UUID,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """
    Return raw log entries for a goal over the last N days (default 7).

    Also returns daily_totals — a dict of date → summed value — for
    rendering a bar chart. Entries are ordered oldest-first.
    """
    participant_id = get_participant_id(current_user)
    return await ParticipantQuery(db).get_goal_logs(goal_id, participant_id, days=days)


@router.post("/goals/{goal_id}/log")
async def log_goal_progress(
    goal_id: uuid.UUID,
    payload: GoalProgressLog,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_EDIT)),
):
    """
    Log a progress entry against a health goal.

    Creates/updates a HealthDataPoint with source_type='goal' for the goal's element.
    Use this to record actual progress, e.g. completed reps or journal text for today.
    observed_at defaults to now if not provided.
    """
    participant_id = get_participant_id(current_user)
    data_point = await ParticipantQuery(db).log_progress(goal_id, participant_id, payload)

    progress = await ParticipantQuery(db).get_goal_progress(goal_id, participant_id)
    if progress.get("completed"):
        caretaker_user_id = await db.scalar(
            select(CaretakerProfile.user_id)
            .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
            .join(
                GroupMember,
                (GroupMember.group_id == Group.group_id)
                & (GroupMember.participant_id == participant_id)
                & (GroupMember.left_at.is_(None)),
            )
            .limit(1)
        )
        if caretaker_user_id:
            await create_notification(
                db=db,
                user_id=caretaker_user_id,
                notification_type="goal",
                title="Participant completed a goal",
                message="A participant in your group completed a goal target.",
                link="/caretaker/participants",
                role_target="caretaker",
                source_type="goal_completion",
                source_id=goal_id,
            )

    return data_point


@router.get("/my-care-team")
async def get_my_care_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """Return the group(s) and caretaker(s) the authenticated participant belongs to."""
    participant_id = get_participant_id(current_user)

    rows = await db.execute(
        select(
            Group.group_id,
            Group.name.label("group_name"),
            Group.description.label("group_description"),
            User.first_name.label("caretaker_first_name"),
            User.last_name.label("caretaker_last_name"),
            User.email.label("caretaker_email"),
            CaretakerProfile.title.label("caretaker_title"),
            CaretakerProfile.specialty.label("caretaker_specialty"),
        )
        .select_from(GroupMember)
        .join(Group, Group.group_id == GroupMember.group_id)
        .outerjoin(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
        .outerjoin(User, User.user_id == CaretakerProfile.user_id)
        .where(GroupMember.participant_id == participant_id)
        .where(GroupMember.left_at.is_(None))
    )

    results = rows.all()
    if not results:
        return {"groups": []}

    return {
        "groups": [
            {
                "group_id": str(row.group_id),
                "group_name": row.group_name,
                "group_description": row.group_description,
                "caretaker": {
                    "name": f"{row.caretaker_first_name or ''} {row.caretaker_last_name or ''}".strip() or None,
                    "email": row.caretaker_email,
                    "title": row.caretaker_title,
                    "specialty": row.caretaker_specialty,
                } if row.caretaker_email else None,
            }
            for row in results
        ]
    }


@router.get("/feedback", response_model=list[FeedbackItem])
async def list_my_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    """Return caretaker feedback for the authenticated participant only."""
    participant_id = get_participant_id(current_user)
    rows = await CaretakersQuery(db).list_feedback(participant_id)
    return [
        FeedbackItem(
            feedback_id=row.feedback_id,
            caretaker_id=row.caretaker_id,
            participant_id=row.participant_id,
            submission_id=row.submission_id,
            message=row.message,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    rows = await list_notifications_for_user(db, current_user.user_id, role_target="participant")
    return [
        NotificationItem(
            notification_id=n.notification_id,
            type=n.type,
            title=n.title,
            message=n.message,
            link=n.link,
            role_target=n.role_target,
            created_at=n.created_at,
            is_read=(n.status == "read"),
        )
        for n in rows
    ]


@router.patch("/notifications/{notification_id}", response_model=NotificationItem)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_VIEW_ALL)),
):
    n = await mark_notification_read_for_user(db, notification_id, current_user.user_id)
    return NotificationItem(
        notification_id=n.notification_id,
        type=n.type,
        title=n.title,
        message=n.message,
        link=n.link,
        role_target=n.role_target,
        created_at=n.created_at,
        is_read=(n.status == "read"),
    )
