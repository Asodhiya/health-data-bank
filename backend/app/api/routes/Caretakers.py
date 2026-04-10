from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Literal
from uuid import UUID
from datetime import date

from app.db.session import get_db
from app.db.models import User, SignupInvite, Role, Group
from app.core.dependency import require_permissions
from app.core.permissions import (
    GROUP_READ,
    CARETAKER_READ,
    CARETAKER_WRITE,
    SEND_INVITE,
)
from app.schemas.caretaker_response_schema import (
    GroupItem,
    GroupMemberAddRequest, GroupMemberItem,
    GroupDataElementItem,
    ParticipantDataElementItem,
    ParticipantListItem, ParticipantDetail, ParticipantActivityCounts,
    PaginatedParticipants,
    FeedbackCreate, FeedbackItem,
    NoteCreateRequest, NoteItem, NoteUpdateRequest,
    ReportGenerateRequest, ReportResponse, ReportListItem,
    SubmissionListItem, SubmissionDetailItem, SubmissionAnswerItem,
    GroupDeployedFormItem,
    CaretakerProfileUpdate, CaretakerProfileOut,
)
from app.schemas.survey_schema import SurveyDetailOut
from app.schemas.notification_schema import NotificationItem
from app.db.queries.Queries import CaretakersQuery
from app.db.models import CaretakerProfile, ParticipantProfile, CaretakerNote
from sqlalchemy import select, update, delete
from app.services.form_management_service import get_form_by_id
from app.services.notification_service import (
    list_notifications_for_user,
    mark_notification_read_for_user,
    create_notification,
)
from app.schemas.admin_schema import InviteListItem
from datetime import datetime, timezone

router = APIRouter()


async def _get_caretaker_id_or_404(db: AsyncSession, user_id: UUID) -> UUID:
    caretaker_id = await db.scalar(
        select(CaretakerProfile.caretaker_id).where(CaretakerProfile.user_id == user_id)
    )
    if not caretaker_id:
        raise HTTPException(status_code=404, detail="Caretaker profile not found")
    return caretaker_id


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=CaretakerProfileOut)
async def get_caretaker_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    # B20: previously this handler created and committed a new profile row as
    # a side effect if one didn't exist. That violated REST idempotency, opened
    # a race between concurrent GETs, and muddied the semantics of "who has a
    # profile?" Profile creation now happens exclusively via PATCH /profile
    # (the onboarding page is the sole caller that does this on first completion).
    result = await db.execute(
        select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Caretaker profile not found")
    return profile


@router.patch("/profile", response_model=CaretakerProfileOut)
async def update_caretaker_profile(
    payload: CaretakerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    result = await db.execute(
        select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = CaretakerProfile(user_id=current_user.user_id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


# ── Groups ────────────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[GroupItem])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    rows = await CaretakersQuery(db).get_groups(current_user.user_id)
    return [
        GroupItem(
            group_id=g.group_id,
            name=g.name,
            description=g.description,
            caretaker_id=g.caretaker_id,
            member_count=int(member_count or 0),
        )
        for g, member_count in rows
    ]


@router.get("/groups/{group_id}", response_model=GroupItem)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_READ)),
):
    row = await CaretakersQuery(db).get_group(group_id, current_user.user_id)
    group, member_count = row
    return GroupItem(
        group_id=group.group_id,
        name=group.name,
        description=group.description,
        caretaker_id=group.caretaker_id,
        member_count=int(member_count or 0),
    )



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
    rows = await CaretakersQuery(db).get_group_elements(group_id, current_user.user_id)
    return [
        GroupDataElementItem(
            element_id=row.element_id,
            code=row.code,
            label=row.label,
            unit=row.unit,
            datatype=row.datatype,
            description=row.description,
            # form_names comes back as None when there are no matches; coerce
            # to [] so the response shape is consistent. The query also
            # filters out None entries from the array_agg in case any join
            # produced a NULL row.
            form_names=[n for n in (row.form_names or []) if n],
            data_point_count=int(row.data_point_count or 0),
        )
        for row in rows
    ]


@router.get("/forms", response_model=list[GroupDeployedFormItem])
async def list_group_forms(
    group_id: Optional[UUID] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await CaretakersQuery(db).get_group_forms(
        caretaker_user_id=current_user.user_id,
        group_id=group_id,
        limit=limit,
        offset=offset,
    )
    items = []
    for row in rows:
        participant_count = int(row.participant_count or 0)
        submitted_count = int(row.submitted_count or 0)
        completion_rate = 0.0
        if participant_count > 0:
            completion_rate = round((submitted_count / participant_count) * 100, 1)
        items.append(
            GroupDeployedFormItem(
                deployment_id=row.deployment_id,
                form_id=row.form_id,
                group_id=row.group_id,
                group_name=row.group_name,
                form_title=row.form_title,
                form_description=row.form_description,
                form_status=row.form_status,
                deployed_at=row.deployed_at,
                revoked_at=row.revoked_at,
                is_active=row.revoked_at is None,
                participant_count=participant_count,
                submitted_count=submitted_count,
                completion_rate=completion_rate,
            )
        )
    return items


@router.get("/forms/{form_id}", response_model=SurveyDetailOut)
async def get_group_form_detail(
    form_id: UUID,
    group_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    allowed_group_ids = await CaretakersQuery(db).get_caretaker_form_group_ids(
        form_id=form_id,
        caretaker_user_id=current_user.user_id,
        group_id=group_id,
    )
    if not allowed_group_ids:
        raise HTTPException(status_code=404, detail="Form not found in your assigned groups")

    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Do not leak deployments outside this caretaker's assigned groups.
    form.deployed_group_ids = [gid for gid in (form.deployed_group_ids or []) if gid in allowed_group_ids]
    return form


# ── Participants ──────────────────────────────────────────────────────────────

@router.get("/participants", response_model=PaginatedParticipants)
async def list_participants(
    group_id: Optional[UUID] = Query(default=None),
    q: Optional[str] = Query(default=None),
    status: Optional[Literal["active", "highly_active", "moderately_active", "low_active", "inactive"]] = Query(default=None),
    gender: Optional[str] = Query(default=None),
    age_min: Optional[int] = Query(default=None),
    age_max: Optional[int] = Query(default=None),
    has_alerts: Optional[bool] = Query(default=None),
    survey_progress: Optional[Literal["not_started", "in_progress", "completed", "below_50", "above_50"]] = Query(default=None),
    goal_progress: Optional[Literal["not_started", "in_progress", "completed", "no_goals"]] = Query(default=None),
    submission_date_from: Optional[date] = Query(default=None),
    submission_date_to: Optional[date] = Query(default=None),
    sort_by: Optional[Literal["name", "age", "status", "gender", "surveys", "goals", "last_active", "enrolled", "submission_date"]] = Query(default=None),
    sort_dir: Literal["asc", "desc"] = Query(default="asc"),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows, total_count = await CaretakersQuery(db).get_participants(
        user_id=current_user.user_id,
        group_id=group_id,
        q=q,
        status=status,
        gender=gender,
        age_min=age_min,
        age_max=age_max,
        has_alerts=has_alerts,
        survey_progress=survey_progress,
        goal_progress=goal_progress,
        sort_by=sort_by,
        sort_dir=sort_dir,
        submission_date_from=submission_date_from,
        submission_date_to=submission_date_to,
        limit=limit,
        offset=offset,
    )
    items = [
        ParticipantListItem(
            participant_id=row.participant_id,
            name=f"{row.first_name or ''} {row.last_name or ''}".strip(),
            email=row.email,
            phone=row.phone,
            dob=row.dob,
            gender=row.gender,
            age=row.age,
            status=row.status,
            group_id=row.group_id,
            enrolled_at=row.enrolled_at,
            survey_progress=row.survey_progress,
            goal_progress=row.goal_progress,
            survey_submitted_count=row.survey_submitted_count,
            survey_deployed_count=row.survey_deployed_count,
            goals_completed_count=row.goals_completed_count,
            goals_total_count=row.goals_total_count,
            last_login_at=row.last_login_at,
            last_submission_at=row.last_submission_at,
        )
        for row in rows
    ]
    return PaginatedParticipants(items=items, total_count=total_count)


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
    q = CaretakersQuery(db)
    participant, first_name, last_name, user_status, _ = await q.get_group_participant(group_id, participant_id, current_user.user_id)
    groups = await q.get_participant_group_memberships(
        participant_id,
        current_user.user_id,
    )
    return ParticipantDetail(
        participant_id=participant.participant_id,
        name=f"{first_name or ''} {last_name or ''}".strip(),
        status="active" if user_status else "inactive",
        groups=groups,
    )


@router.get("/participants/{participant_id}/submissions", response_model=list[SubmissionListItem])
async def list_participant_submissions(
    participant_id: UUID,
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await CaretakersQuery(db).get_participant_submissions(participant_id, date_from, date_to, caretaker_user_id=current_user.user_id)
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
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    feedback = await CaretakersQuery(db).create_feedback(
        caretaker_user_id=current_user.user_id,
        participant_id=participant_id,
        message=body.message,
        submission_id=submission_id,
    )

    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.participant_id == participant_id)
    )
    if participant:
        await create_notification(
            db=db,
            user_id=participant.user_id,
            notification_type="flag",
            title="New caretaker feedback",
            message="Your caretaker left feedback on a recent submission.",
            link="/participant/feedback",
            role_target="participant",
            source_type="feedback",
            source_id=feedback.feedback_id,
        )

    return FeedbackItem(
        feedback_id=feedback.feedback_id,
        caretaker_id=feedback.caretaker_id,
        participant_id=feedback.participant_id,
        submission_id=feedback.submission_id,
        message=feedback.message,
        created_at=feedback.created_at,
    )


@router.post("/participants/{participant_id}/feedback", response_model=FeedbackItem, status_code=201)
async def create_general_feedback(
    participant_id: UUID,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    feedback = await CaretakersQuery(db).create_feedback(
        caretaker_user_id=current_user.user_id,
        participant_id=participant_id,
        message=body.message,
        submission_id=None,
    )

    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.participant_id == participant_id)
    )
    if participant:
        await create_notification(
            db=db,
            user_id=participant.user_id,
            notification_type="flag",
            title="New caretaker feedback",
            message="Your caretaker sent you feedback.",
            link="/participant/feedback",
            role_target="participant",
            source_type="feedback",
            source_id=feedback.feedback_id,
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
    rows = await CaretakersQuery(db).list_feedback(participant_id, caretaker_user_id=current_user.user_id)
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


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.get("/participants/{participant_id}/notes", response_model=list[NoteItem])
async def list_notes(
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    # B1: ownership guard before reading. Without this, the route's existing
    # caretaker_id filter would silently return [] for unauthorized lookups,
    # which is information leakage rather than an explicit denial.
    await CaretakersQuery(db)._assert_participant_in_owned_group(participant_id, current_user.user_id)
    caretaker_id = await _get_caretaker_id_or_404(db, current_user.user_id)
    rows = (
        await db.execute(
            select(CaretakerNote)
            .where(
                CaretakerNote.participant_id == participant_id,
                CaretakerNote.caretaker_id == caretaker_id,
            )
            .order_by(CaretakerNote.created_at.desc())
        )
    ).scalars().all()
    return [
        NoteItem(
            note_id=row.note_id,
            participant_id=row.participant_id,
            text=row.text,
            tag=row.tag,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/participants/{participant_id}/notes", response_model=NoteItem, status_code=201)
async def create_note(
    participant_id: UUID,
    body: NoteCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    # B1: ownership guard before writing. This subsumes the previous
    # "participant_exists" check — a participant in a group I own definitely
    # exists, and one I don't own should look the same as one that doesn't
    # exist (same 404 wording, no enumeration).
    await CaretakersQuery(db)._assert_participant_in_owned_group(participant_id, current_user.user_id)
    caretaker_id = await _get_caretaker_id_or_404(db, current_user.user_id)

    note = CaretakerNote(
        caretaker_id=caretaker_id,
        participant_id=participant_id,
        text=body.text.strip(),
        tag=body.tag,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteItem(
        note_id=note.note_id,
        participant_id=note.participant_id,
        text=note.text,
        tag=note.tag,
        created_at=note.created_at,
    )


@router.patch("/notes/{note_id}", response_model=NoteItem)
async def update_note(
    note_id: UUID,
    body: NoteUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    caretaker_id = await _get_caretaker_id_or_404(db, current_user.user_id)
    note = await db.scalar(
        select(CaretakerNote).where(
            CaretakerNote.note_id == note_id,
            CaretakerNote.caretaker_id == caretaker_id,
        )
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    data = body.model_dump(exclude_none=True)
    if "text" in data:
        data["text"] = data["text"].strip()
        if not data["text"]:
            raise HTTPException(status_code=422, detail="Note text cannot be empty")
    if data:
        data["updated_at"] = datetime.now(timezone.utc)
        await db.execute(
            update(CaretakerNote)
            .where(CaretakerNote.note_id == note_id)
            .values(**data)
        )
        await db.commit()
        note = await db.scalar(select(CaretakerNote).where(CaretakerNote.note_id == note_id))

    return NoteItem(
        note_id=note.note_id,
        participant_id=note.participant_id,
        text=note.text,
        tag=note.tag,
        created_at=note.created_at,
    )


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
):
    caretaker_id = await _get_caretaker_id_or_404(db, current_user.user_id)
    result = await db.execute(
        delete(CaretakerNote).where(
            CaretakerNote.note_id == note_id,
            CaretakerNote.caretaker_id == caretaker_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.commit()


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
        participant_status=body.participant_status,
        gender=body.gender,
        age_min=body.age_min,
        age_max=body.age_max,
    )
    all_params = report.parameters or {}
    config = {k: v for k, v in all_params.items() if k != "payload"}
    return ReportResponse(
        report_id=report.report_id,
        scope="group",
        created_at=report.created_at,
        payload=all_params.get("payload", {}),
        parameters=config,
    )


@router.post("/reports/comparison", response_model=ReportResponse, status_code=201)
async def generate_comparison_report(
    participant_id: UUID = Query(...),
    compare_with: Literal["participant", "group", "all"] = Query(...),
    compare_participant_id: Optional[UUID] = Query(default=None),
    group_id: Optional[UUID] = Query(default=None),
    body: ReportGenerateRequest = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
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
    all_params = report.parameters or {}
    config = {k: v for k, v in all_params.items() if k != "payload"}
    return ReportResponse(
        report_id=report.report_id,
        scope="comparison",
        created_at=report.created_at,
        payload=all_params.get("payload", {}),
        parameters=config,
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
            group_id=r.group_id,
            group_name=r.group_name,
            participant_id=r.participant_id,
            created_at=r.created_at,
            date_from=r.date_from,
            date_to=r.date_to,
            participant_status=r.participant_status,
            compare_with=r.compare_with,
            element_count=r.element_count,
            element_labels=r.element_labels,
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
    all_params = report.parameters or {}
    # payload holds the computed results; parameters holds the config
    config = {k: v for k, v in all_params.items() if k != "payload"}
    return ReportResponse(
        report_id=report.report_id,
        scope=report.report_type,
        created_at=report.created_at,
        payload=all_params.get("payload", {}),
        parameters=config,
    )


# ── Submission Detail ──────────────────────────────────────────────────────────

@router.get("/participants/{participant_id}/submissions/{submission_id}", response_model=SubmissionDetailItem)
async def get_submission_detail(
    participant_id: UUID,
    submission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    row, answers = await CaretakersQuery(db).get_submission_detail(participant_id, submission_id, current_user.user_id)
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
                element_label=getattr(a, "element_label", None),
                element_unit=getattr(a, "element_unit", None),
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
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_participant_goals(participant_id, current_user.user_id)


# ── Health Trends ──────────────────────────────────────────────────────────────

@router.get("/participants/{participant_id}/health-trends")
async def get_health_trends(
    participant_id: UUID,
    element_ids: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_health_trends(
        participant_id, element_ids, date_from, date_to, user_id=current_user.user_id
    )


# ── Participant Data Elements (Reports v2) ─────────────────────────────────────

@router.get(
    "/participants/{participant_id}/data-elements",
    response_model=list[ParticipantDataElementItem],
)
async def list_participant_data_elements(
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    """Reports v2: returns data elements relevant to this participant.

    Backs the metric pickers in the Comparison and Trends tabs of the Reports
    page so caretakers only see metrics that will actually return data for
    the selected participant. Includes both currently-deployed elements and
    elements with historical data points.
    """
    rows = await CaretakersQuery(db).get_participant_data_elements(
        participant_id, current_user.user_id
    )
    return [
        ParticipantDataElementItem(
            element_id=row.element_id,
            code=row.code,
            label=row.label,
            unit=row.unit,
            datatype=row.datatype,
            description=row.description,
            form_names=[n for n in (row.form_names or []) if n],
            data_point_count=int(row.data_point_count or 0),
            is_currently_deployed=bool(row.is_currently_deployed),
        )
        for row in rows
    ]


# ── Notifications ──────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    rows = await list_notifications_for_user(db, current_user.user_id, role_target="caretaker")
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
    current_user: User = Depends(require_permissions(CARETAKER_WRITE)),
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


# ── Invite Management (caretaker-scoped) ─────────────────────────────────────

@router.get("/invites", response_model=list[InviteListItem])
async def list_my_invites(
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(SEND_INVITE)),
):
    now = datetime.now(timezone.utc)
    stmt = (
        select(
            SignupInvite.invite_id,
            SignupInvite.email,
            SignupInvite.group_id,
            SignupInvite.invited_by,
            SignupInvite.created_at,
            SignupInvite.expires_at,
            SignupInvite.used,
            Role.role_name,
            Group.name.label("group_name"),
        )
        .outerjoin(Role, Role.role_id == SignupInvite.role_id)
        .outerjoin(Group, Group.group_id == SignupInvite.group_id)
        .where(SignupInvite.invited_by == current_user.user_id)
        .order_by(SignupInvite.created_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit).offset(max(0, offset))

    rows = (await db.execute(stmt)).all()
    return [
        InviteListItem(
            invite_id=row.invite_id,
            email=row.email,
            role=row.role_name,
            group_id=row.group_id,
            group_name=row.group_name,
            invited_by=row.invited_by,
            created_at=row.created_at,
            expires_at=row.expires_at,
            used=row.used,
            status="accepted" if row.used else ("expired" if row.expires_at < now else "pending"),
        )
        for row in rows
    ]


@router.get("/participants-summary")
async def get_participant_summary(
    group_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_participant_summary(
        user_id=current_user.user_id,
        group_id=group_id,
    )


@router.get("/forms-summary")
async def get_forms_summary(
    group_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(CARETAKER_READ)),
):
    return await CaretakersQuery(db).get_group_forms_summary(
        caretaker_user_id=current_user.user_id,
        group_id=group_id,
    )


@router.delete("/invites/{invite_id}")
async def revoke_my_invite(
    invite_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(SEND_INVITE)),
):
    now = datetime.now(timezone.utc)
    invite = await db.scalar(
        select(SignupInvite).where(
            SignupInvite.invite_id == invite_id,
            SignupInvite.invited_by == current_user.user_id,
        )
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < now:
        raise HTTPException(status_code=400, detail="Invite has already expired")

    await db.delete(invite)
    await db.commit()
    return {"detail": "Invite revoked successfully"}
