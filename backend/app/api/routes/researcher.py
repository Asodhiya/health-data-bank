from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.db.queries.Queries import CaretakersQuery

from app.db.session import get_db
from app.db.models import User, ResearcherProfile
from app.core.dependency import require_permissions
from app.core.permissions import FORM_VIEW
from app.schemas.researcher_schema import ResearcherProfileUpdate, ResearcherProfileOut
from app.schemas.notification_schema import NotificationItem
from app.schemas.caretaker_response_schema import SubmissionDetailItem, SubmissionAnswerItem
from app.services.notification_service import (
    list_notifications_for_user,
    mark_notification_read_for_user,
)
from uuid import UUID

router = APIRouter()


@router.get("/profile", response_model=ResearcherProfileOut)
async def get_researcher_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Researcher profile not found")
    return profile


@router.patch("/profile", response_model=ResearcherProfileOut)
async def update_researcher_profile(
    payload: ResearcherProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = ResearcherProfile(user_id=current_user.user_id)
        db.add(profile)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            result = await db.execute(
                select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.user_id)
            )
            profile = result.scalar_one_or_none()
            if not profile:
                raise HTTPException(status_code=409, detail="Could not initialize researcher profile")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    if not profile.onboarding_completed:
        profile.onboarding_completed = True

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    rows = await list_notifications_for_user(db, current_user.user_id, role_target="researcher")
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
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
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


@router.get("/participants/{participant_id}/submissions/{submission_id}", response_model=SubmissionDetailItem)
async def get_submission_detail(
    participant_id: UUID,
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    row, answers = await CaretakersQuery(db).get_submission_detail(
        participant_id,
        submission_id,
        current_user.user_id,
    )
    return SubmissionDetailItem(
        submission_id=row.submission_id,
        participant_id=row.participant_id,
        form_id=row.form_id,
        form_name=row.form_name,
        submitted_at=row.submitted_at,
        answers=[
            SubmissionAnswerItem(
                field_id=a.field_id,
                field_label=a.field_label,
                value_text=a.value_text,
                value_number=float(a.value_number) if a.value_number is not None else None,
                value_date=str(a.value_date) if a.value_date else None,
                value_json=a.value_json,
            )
            for a in answers
        ],
    )
