from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Literal
from uuid import UUID
from datetime import date

from app.db.session import get_db
from app.db.models import User
from app.core.dependency import require_permissions
from app.core.permissions import (
    GROUP_READ, GROUP_WRITE, GROUP_DELETE,
    CARETAKER_READ,
)
from app.schemas.caretaker_response_schema import (
    GroupItem, GroupUpdateRequest,
    GroupMemberAddRequest, GroupMemberItem,
    GroupDataElementItem,
    ParticipantListItem, ParticipantDetail, ParticipantActivityCounts,
    FeedbackCreate, FeedbackItem,
    ReportGenerateRequest, ReportResponse, ReportListItem,
    SubmissionListItem, SubmissionDetailItem, SubmissionAnswerItem,
    NotificationItem,
    CaretakerProfileUpdate, CaretakerProfileOut,
)
from app.db.queries.Queries import CaretakersQuery
from app.db.models import CaretakerProfile
from sqlalchemy import select

router = APIRouter()


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=CaretakerProfileOut)
async def get_caretaker_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    result = await db.execute(
        select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CaretakerProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.patch("/profile", response_model=CaretakerProfileOut)
async def update_caretaker_profile(
    payload: CaretakerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    result = await db.execute(
        select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CaretakerProfile(user_id=current_user.user_id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    if not profile.onboarding_completed:
        profile.onboarding_completed = True

    await db.commit()
    await db.refresh(profile)
    return profile


# ── Groups ────────────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[GroupItem])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    groups = await CaretakersQuery(db).get_groups(current_user.user_id)
    return [
        GroupItem(
            group_id=g.group_id,
            name=g.name,
            description=g.description,
            caretaker_id=g.caretaker_id,
        )
        for g in groups
    ]


@router.get("/groups/{group_id}", response_model=GroupItem)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    group = await CaretakersQuery(db).get_group(group_id, current_user.user_id)
    return GroupItem(
        group_id=group.group_id,
        name=group.name,
        description=group.description,
        caretaker_id=group.caretaker_id,
    )



# @router.patch("/groups/{group_id}", response_model=GroupItem)
# async def update_group(
#     group_id: UUID,
#     body: GroupUpdateRequest,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(require_permissions(GROUP_WRITE)),
# ):
#     pass


# @router.delete("/groups/{group_id}", status_code=204)
# async def delete_group(
#     group_id: UUID,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(require_permissions(GROUP_DELETE)),
# ):
#     pass


@router.get("/groups/{group_id}/members", response_model=list[GroupMemberItem])
async def list_group_members(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    rows = await CaretakersQuery(db).get_group_participants(group_id, current_user.user_id)
    return [
        GroupMemberItem(
            participant_id=participant.participant_id,
            name=f"{first_name or ''} {last_name or ''}".strip(),
            joined_at=joined_at,
        )
        for participant, first_name, last_name, joined_at in rows
    ]


@router.get("/groups/{group_id}/elements", response_model=list[GroupDataElementItem])
async def list_group_elements(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    rows = await CaretakersQuery(db).get_group_elements(group_id)
    return [
        GroupDataElementItem(
            element_id=row.element_id,
            code=row.code,
            label=row.label,
            unit=row.unit,
            datatype=row.datatype,
        )
        for row in rows
    ]


# @router.delete("/groups/{group_id}/members/{participant_id}", status_code=204)
# async def remove_group_member(
#     group_id: UUID,
#     participant_id: UUID,
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(require_permissions(GROUP_WRITE)),
# ):
#     pass



# ── Participants ──────────────────────────────────────────────────────────────

@router.get("/participants", response_model=list[ParticipantListItem])
async def list_participants(
    group_id: Optional[UUID] = Query(default=None),
    status: Optional[Literal["highly_active", "moderately_active", "low_active", "inactive"]] = Query(default=None),
    gender: Optional[str] = Query(default=None),
    age_min: Optional[int] = Query(default=None),
    age_max: Optional[int] = Query(default=None),
    has_alerts: Optional[bool] = Query(default=None),
    survey_progress: Optional[Literal["not_started", "in_progress", "completed"]] = Query(default=None),
    submission_date_from: Optional[date] = Query(default=None),
    submission_date_to: Optional[date] = Query(default=None),
    sort_by: Optional[Literal["name", "age", "status", "gender", "surveys", "last_active", "enrolled", "submission_date"]] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await CaretakersQuery(db).get_participants(
        user_id=current_user.user_id,
        group_id=group_id,
        status=status,
        gender=gender,
        age_min=age_min,
        age_max=age_max,
        has_alerts=has_alerts,
        survey_progress=survey_progress,
        sort_by=sort_by,
        submission_date_from=submission_date_from,
        submission_date_to=submission_date_to,
    )
    return [
        ParticipantListItem(
            participant_id=row.participant_id,
            name=f"{row.first_name or ''} {row.last_name or ''}".strip(),
            gender=row.gender,
            age=row.age,
            status=row.status,
            group_id=row.group_id,
            survey_progress=row.survey_progress,
            goal_progress="not_started",
            last_login_at=row.last_login_at,
            last_submission_at=row.last_submission_at,
        )
        for row in rows
    ]


@router.get("/participants/activity-counts", response_model=ParticipantActivityCounts)
async def get_participant_activity_counts(
    group_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    counts = await CaretakersQuery(db).get_participant_activity_counts(current_user.user_id, group_id)
    return ParticipantActivityCounts(**counts)


@router.get("/participants/{participant_id}", response_model=ParticipantDetail)
async def get_participant(
    participant_id: UUID,
    group_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    participant, first_name, last_name, _ = await CaretakersQuery(db).get_group_participant(group_id, participant_id)
    return ParticipantDetail(
        participant_id=participant.participant_id,
        name=f"{first_name or ''} {last_name or ''}".strip(),
        status="active",
        groups=[],
    )


@router.get("/participants/{participant_id}/submissions", response_model=list[SubmissionListItem])
async def list_participant_submissions(
    participant_id: UUID,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await CaretakersQuery(db).get_participant_submissions(participant_id, date_from, date_to)
    return [
        SubmissionListItem(
            submission_id=row.submission_id,
            participant_id=row.participant_id,
            form_id=row.form_id,
            form_name=row.form_name,
            submitted_at=row.submitted_at,
        )
        for row in rows
    ]


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.post("/participants/{participant_id}/submissions/{submission_id}/feedback", response_model=FeedbackItem, status_code=201)
async def create_feedback(
    participant_id: UUID,
    submission_id: UUID,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    feedback = await CaretakersQuery(db).create_feedback(
        caretaker_user_id=current_user.user_id,
        participant_id=participant_id,
        message=body.message,
        submission_id=submission_id,
    )
    return FeedbackItem(
        feedback_id=feedback.feedback_id,
        caretaker_id=feedback.caretaker_id,
        participant_id=feedback.participant_id,
        submission_id=feedback.submission_id,
        message=feedback.message,
        created_at=feedback.created_at,
    )


@router.get("/participants/{participant_id}/feedback", response_model=list[FeedbackItem])
async def list_feedback(
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
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


# ── Reports ───────────────────────────────────────────────────────────────────

@router.post("/reports/group/generate", response_model=ReportResponse, status_code=201)
async def generate_group_report(
    group_id: UUID = Query(...),
    body: ReportGenerateRequest = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    report = await CaretakersQuery(db).generate_group_report(
        group_id=group_id,
        requested_by=current_user.user_id,
        element_ids=body.element_ids or None,
        date_from=body.date_from,
        date_to=body.date_to,
    )
    return ReportResponse(
        report_id=report.report_id,
        scope="group",
        created_at=report.created_at,
        payload=report.parameters.get("payload", {}),
    )


@router.post("/reports/comparison", response_model=ReportResponse, status_code=201)
async def generate_comparison_report(
    participant_id: UUID = Query(...),
    compare_with: Literal["participant", "group", "all"] = Query(...),
    compare_participant_id: Optional[UUID] = Query(default=None),
    group_id: Optional[UUID] = Query(default=None),
    body: ReportGenerateRequest = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    if compare_with == "participant" and not compare_participant_id:
        raise HTTPException(status_code=422, detail="compare_participant_id is required when compare_with is 'participant'")
    if compare_with == "group" and not group_id:
        raise HTTPException(status_code=422, detail="group_id is required when compare_with is 'group'")

    report = await CaretakersQuery(db).generate_comparison_report(
        participant_id=participant_id,
        requested_by=current_user.user_id,
        compare_with=compare_with,
        compare_participant_id=compare_participant_id,
        group_id=group_id,
        element_ids=body.element_ids or None,
        date_from=body.date_from,
        date_to=body.date_to,
    )
    return ReportResponse(
        report_id=report.report_id,
        scope="comparison",
        created_at=report.created_at,
        payload=report.parameters.get("payload", {}),
    )


@router.get("/reports", response_model=list[ReportListItem])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    reports = await CaretakersQuery(db).list_reports(current_user.user_id)
    return [
        ReportListItem(
            report_id=r.report_id,
            scope=r.report_type or "unknown",
            created_at=r.created_at,
        )
        for r in reports
    ]


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    report = await CaretakersQuery(db).get_report(report_id, current_user.user_id)
    return ReportResponse(
        report_id=report.report_id,
        scope=report.report_type,
        created_at=report.created_at,
        payload=report.parameters.get("payload", {}) if report.parameters else {},
    )


# ── Submission Detail ──────────────────────────────────────────────────────────

@router.get("/participants/{participant_id}/submissions/{submission_id}", response_model=SubmissionDetailItem)
async def get_submission_detail(
    participant_id: UUID,
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions(CARETAKER_READ)),
):
    row, answers = await CaretakersQuery(db).get_submission_detail(participant_id, submission_id)
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


# ── Participant Goals (read-only) ──────────────────────────────────────────────

@router.get("/participants/{participant_id}/goals")
async def get_participant_goals(
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_participant_goals(participant_id)


# ── Health Trends ──────────────────────────────────────────────────────────────

@router.get("/participants/{participant_id}/health-trends")
async def get_health_trends(
    participant_id: UUID,
    element_ids: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_health_trends(
        participant_id, element_ids, date_from, date_to
    )


# ── Notifications ──────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await CaretakersQuery(db).list_notifications(current_user.user_id)
    return [
        NotificationItem(
            notification_id=n.notification_id,
            title=n.title,
            message=n.message,
            created_at=n.created_at,
            is_read=(n.status == "read"),
        )
        for n in rows
    ]


@router.patch("/notifications/{notification_id}", response_model=NotificationItem)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    n = await CaretakersQuery(db).mark_notification_read(notification_id, current_user.user_id)
    return NotificationItem(
        notification_id=n.notification_id,
        title=n.title,
        message=n.message,
        created_at=n.created_at,
        is_read=(n.status == "read"),
    )
