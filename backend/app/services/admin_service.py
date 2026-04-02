# ── Admin service functions made by Job (SPRINT 6) ──────────────────────────

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, insert, text, delete as sa_delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy import TIMESTAMP, Date
from uuid import UUID
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
import uuid as uuid_module
import hashlib
import json
import os

from app.db.models import (
    AdminProfile, AuditLog, Backup, CaretakerFeedback, CaretakerProfile,
    DataElement, Device, FieldElementMap, FieldOption, FormDeployment,
    FormField, FormSubmission, GoalTemplate, Group, GroupMember,
    HealthDataPoint, HealthGoal, MFAChallenge, MFAMethod, Notification,
    ParticipantConsent, ConsentFormTemplate, BackgroundInfoTemplate,
    ParticipantProfile, Permission, Report, ReportFile,
    Reminder, ResearcherProfile, RestoreEvent, Role, RolePermission, Session,
    SignupInvite, SubmissionAnswer, SurveyForm, User, UserRole,
)
from app.schemas.admin_schema import (
    AssignCaretakerRequest,
    AssignCaretakerResponse,
    RestoreResponse,
    UnassignCaretakerResponse,
    CaretakerItem,
    DeleteGroupResponse,
    AdminUserUpdate,
    UserListItem,
    InviteListItem,
    BackupListItem,
    UserReactivateRequest,
)
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem, GroupUpdateRequest
from app.db.queries.Queries import CaretakersQuery, ParticipantQuery
from typing import List
from app.core.security import generate_reset_token, hash_reset_token, reset_token_expiry
from app.services.email_sender import send_reset_email

# ── Backup helpers ─────────────────────────────────────────────────────────────

# Insert order for restore — each table comes after all its FK dependencies
TABLE_ORDER = [
    ("roles",               Role),
    ("permissions",         Permission),
    ("users",               User),
    ("user_roles",          UserRole),
    ("role_permissions",    RolePermission),
    ("devices",             Device),
    ("sessions",            Session),
    ("mfa_methods",         MFAMethod),
    ("mfa_challenges",      MFAChallenge),
    ("consent_form_template", ConsentFormTemplate),
    ("background_info_template", BackgroundInfoTemplate),
    ("participant_profile", ParticipantProfile),
    ("participant_consent", ParticipantConsent),
    ("caretaker_profile",   CaretakerProfile),
    ("researcher_profile",  ResearcherProfile),
    ("admin_profile",       AdminProfile),
    ("groups",              Group),
    ("signup_invites",      SignupInvite),
    ("data_elements",       DataElement),
    ("survey_forms",        SurveyForm),
    ("form_fields",         FormField),
    ("field_options",       FieldOption),
    ("group_members",       GroupMember),
    ("field_element_map",   FieldElementMap),
    ("form_deployments",    FormDeployment),
    ("form_submissions",    FormSubmission),
    ("submission_answers",  SubmissionAnswer),
    ("goal_templates",      GoalTemplate),
    ("health_goals",        HealthGoal),
    ("caretaker_feedback",  CaretakerFeedback),
    ("health_data_points",  HealthDataPoint),
    ("reports",             Report),
    ("report_files",        ReportFile),
    ("notifications",       Notification),
    ("reminders",           Reminder),
    ("audit_log",           AuditLog),
    ("backups",             Backup),
    ("restore_events",      RestoreEvent),
]


def _serialize_value(val):
    if isinstance(val, uuid_module.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def _serialize_row(obj, model_class) -> dict:
    return {
        col.name: _serialize_value(getattr(obj, col.name))
        for col in model_class.__table__.columns
    }


def _deserialize_row(row: dict, model_class) -> dict:
    result = {}
    for col in model_class.__table__.columns:
        val = row.get(col.name)
        if val is None:
            result[col.name] = None
            continue
        if isinstance(col.type, PG_UUID):
            result[col.name] = uuid_module.UUID(val) if isinstance(val, str) else val
        elif isinstance(col.type, TIMESTAMP):
            result[col.name] = datetime.fromisoformat(val) if isinstance(val, str) else val
        elif isinstance(col.type, Date):
            result[col.name] = date.fromisoformat(val) if isinstance(val, str) else val
        else:
            result[col.name] = val
    return result


async def list_groups(db: AsyncSession) -> List[GroupItem]:
    """Return all groups with their assigned caretaker_id."""
    result = await db.execute(select(Group))
    groups = result.scalars().all()
    return [
        GroupItem(
            group_id=g.group_id,
            name=g.name,
            description=g.description,
            caretaker_id=g.caretaker_id,
        )
        for g in groups
    ]


async def list_caretakers(db: AsyncSession) -> List[CaretakerItem]:
    """Return all users who have a caretaker profile."""
    result = await db.execute(
        select(CaretakerProfile, User.first_name, User.last_name, User.email)
        .join(User, User.user_id == CaretakerProfile.user_id)
    )
    rows = result.all()
    return [
        CaretakerItem(
            caretaker_id=profile.caretaker_id,
            user_id=profile.user_id,
            name=f"{first_name or ''} {last_name or ''}".strip() or "Unknown",
            email=email,
            title=profile.title,
            organization=profile.organization,
        )
        for profile, first_name, last_name, email in rows
    ]


async def assign_caretaker_to_group(
    payload: AssignCaretakerRequest,
    db: AsyncSession,
) -> AssignCaretakerResponse:
    """Assign a caretaker to a group. Raises error if Group already has a caretaker."""

    caretaker = await db.scalar(
        select(CaretakerProfile).where(CaretakerProfile.user_id == payload.user_id)
    )
    if not caretaker:
        raise HTTPException(status_code=404, detail="No caretaker profile found for this user")

    group = await db.scalar(
        select(Group).where(Group.group_id == payload.group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.caretaker_id is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Group '{group.name}' already has a caretaker assigned. Unassign them first.",
        )

    group.caretaker_id = caretaker.caretaker_id
    await db.commit()
    await db.refresh(group)

    return AssignCaretakerResponse(
        group_id=group.group_id,
        caretaker_id=caretaker.caretaker_id,
        message=f"Caretaker successfully assigned to group '{group.name}'",
    )


async def create_group(
    payload: GroupCreateRequest,
    created_by: UUID,
    db: AsyncSession,
) -> GroupItem:
    """Create a new group. Raises 409 if a group with the same name already exists."""

    existing = await db.scalar(
        select(Group).where(func.lower(Group.name) == payload.name.lower())
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A group named '{payload.name}' already exists.",
        )

    new_group = Group(
        name=payload.name,
        description=payload.description,
        created_by=created_by,
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)

    return GroupItem(
        group_id=new_group.group_id,
        name=new_group.name,
        description=new_group.description,
    )


async def delete_group(
    group_id: UUID,
    db: AsyncSession,
) -> DeleteGroupResponse:
    """Delete a group. Members lose their group assignment (cascade). Returns list of ungrouped participants."""

    group = await db.scalar(
        select(Group).where(Group.group_id == group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group_name = group.name

    members_result = await db.execute(
        select(GroupMember.participant_id)
        .where(GroupMember.group_id == group_id)
        .where(GroupMember.left_at == None)
    )
    ungrouped = [str(row[0]) for row in members_result.all()]

    try:
        # Some DBs have form_deployments.group_id as NOT NULL.
        # Deleting deployments is the correct behavior for a deleted group:
        # the group no longer has active deployments, while participant submissions remain preserved.
        await db.execute(
            sa_delete(FormDeployment).where(FormDeployment.group_id == group_id)
        )
        await db.execute(
            update(FormSubmission).where(FormSubmission.group_id == group_id).values(group_id=None)
        )
        await db.execute(
            update(Report).where(Report.group_id == group_id).values(group_id=None)
        )

        await db.delete(group)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Group cannot be deleted because it is still referenced by related records.",
        )

    return DeleteGroupResponse(
        group_id=group_id,
        message=f"Group '{group_name}' has been deleted.",
        ungrouped_participants=ungrouped,
    )


async def update_group(group_id: UUID, payload: GroupUpdateRequest, db: AsyncSession) -> GroupItem:
    """Rename or update the description of a group."""
    group = await db.scalar(select(Group).where(Group.group_id == group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if payload.name is not None:
        group.name = payload.name
    if payload.description is not None:
        group.description = payload.description
    await db.commit()
    await db.refresh(group)
    return GroupItem(
        group_id=group.group_id,
        name=group.name,
        description=group.description,
        caretaker_id=group.caretaker_id,
    )


async def move_participant_group(user_id: UUID, new_group_id: UUID, db: AsyncSession) -> dict:
    """Move a participant to a new group — closes current membership and opens a new one."""
    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    group = await db.scalar(select(Group).where(Group.group_id == new_group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Close current active membership
    await db.execute(
        update(GroupMember)
        .where(GroupMember.participant_id == participant.participant_id)
        .where(GroupMember.left_at == None)
        .values(left_at=datetime.now(timezone.utc))
    )

    # Open new membership
    db.add(GroupMember(group_id=new_group_id, participant_id=participant.participant_id))
    await db.commit()

    return {"detail": f"Participant moved to '{group.name}'"}


async def unassign_caretaker_from_group(
    group_id: UUID,
    db: AsyncSession,
) -> UnassignCaretakerResponse:
    """Remove the caretaker from a group."""

    group = await db.scalar(
        select(Group).where(Group.group_id == group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.caretaker_id is None:
        raise HTTPException(status_code=400, detail="Group has no caretaker assigned")

    group.caretaker_id = None
    await db.commit()

    return UnassignCaretakerResponse(
        group_id=group_id,
        message=f"Caretaker removed from group '{group.name}'",
    )


async def backup_database(created_by: UUID, db: AsyncSession) -> tuple[str, str]:
    """Export all tables to a JSON string and record the snapshot (with checksum) in the backups table.
    Returns (json_content, snapshot_name).
    """

    snapshot_name = f"backup_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S')}"
    tables = {}
    row_counts = {}

    for table_name, model_class in TABLE_ORDER:
        result = await db.execute(select(model_class))
        rows = result.scalars().all()
        serialized = [_serialize_row(row, model_class) for row in rows]
        tables[table_name] = serialized
        row_counts[table_name] = len(serialized)

    data = {
        "snapshot_name": snapshot_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "table_row_counts": row_counts,
        "tables": tables,
    }

    content = json.dumps(data, indent=2, default=str)
    checksum = hashlib.sha256(content.encode()).hexdigest()

    record = Backup(created_by=created_by, storage_path=snapshot_name, checksum=checksum)
    db.add(record)
    await db.commit()

    return content, snapshot_name


async def restore_database(
    raw_content: bytes,
    db: AsyncSession,
    restored_by: UUID | None = None,
) -> RestoreResponse:
    """Verify checksum, wipe all tables, and restore from a backup JSON file."""

    # Normalize line endings before hashing — prevents mismatch if file was
    # opened and saved on Windows (which converts \n to \r\n)
    normalized_content = raw_content.replace(b"\r\n", b"\n")
    uploaded_checksum = hashlib.sha256(normalized_content).hexdigest()
    backup_data = json.loads(raw_content)
    snapshot_name = backup_data.get("snapshot_name", "unknown")

    # Checksum verification — reject if record exists and checksum doesn't match.
    # Also reject if no record found (prevents restoring files with no known origin).
    stored_backup = await db.scalar(
        select(Backup).where(Backup.storage_path == snapshot_name)
    )
    if not stored_backup:
        raise HTTPException(
            status_code=404,
            detail=f"No backup record found for snapshot '{snapshot_name}'. Cannot verify file integrity.",
        )
    if stored_backup.checksum != uploaded_checksum:
        raise HTTPException(
            status_code=400,
            detail="Checksum mismatch — the backup file may be corrupted or tampered with.",
        )

    # Everything below runs in a single transaction.
    # If any insert fails, the truncate is also rolled back — DB stays intact.
    managed_tables = ", ".join(name for name, _ in TABLE_ORDER)
    await db.execute(text(f"TRUNCATE TABLE {managed_tables} RESTART IDENTITY CASCADE"))

    # Re-insert in dependency order
    for table_name, model_class in TABLE_ORDER:
        rows = backup_data.get("tables", {}).get(table_name, [])
        if not rows:
            continue

        # form_fields has a self-referencing parent_id — insert parents first
        if table_name == "form_fields":
            rows = sorted(rows, key=lambda r: (r.get("parent_id") is not None))

        deserialized = [_deserialize_row(row, model_class) for row in rows]
        await db.execute(insert(model_class).values(deserialized))

    # restored_by is set to None — the restoring admin may not exist in the backup
    restore_record = RestoreEvent(
        restored_by=restored_by,
        notes=f"Restored from snapshot: {snapshot_name}",
    )
    db.add(restore_record)
    await db.commit()

    return RestoreResponse(
        restored_from=snapshot_name,
        tables_restored=len(TABLE_ORDER),
        message=f"Database successfully restored from '{snapshot_name}'.",
    )


# ── User Management ────────────────────────────────────────────────────────────

async def list_users(db: AsyncSession) -> list[UserListItem]:
    """Return all users with their role, group, and caretaker info."""
    CaretakerUser = aliased(User)
    self_deactivated_logs = (
        await db.execute(
            select(AuditLog.entity_id, AuditLog.details, AuditLog.created_at)
            .where(AuditLog.action == "USER_SELF_DEACTIVATED")
            .where(AuditLog.entity_type == "user")
            .order_by(AuditLog.created_at.desc())
        )
    ).all()
    deactivation_map: dict[UUID, dict] = {}
    for entity_id, details, created_at in self_deactivated_logs:
        if entity_id and entity_id not in deactivation_map:
            deactivation_map[entity_id] = {
                "details": details or {},
                "created_at": created_at,
            }

    result = await db.execute(
        select(
            User.user_id,
            User.first_name,
            User.last_name,
            User.email,
            User.phone,
            User.status,
            User.locked_until,
            User.created_at,
            Role.role_name,
            Group.group_id,
            Group.name.label("group_name"),
            CaretakerProfile.caretaker_id,
            func.concat(CaretakerUser.first_name, " ", CaretakerUser.last_name).label("caretaker_name"),
            ParticipantProfile.dob,
            ParticipantProfile.gender,
        )
        .outerjoin(UserRole, UserRole.user_id == User.user_id)
        .outerjoin(Role, Role.role_id == UserRole.role_id)
        .outerjoin(ParticipantProfile, ParticipantProfile.user_id == User.user_id)
        .outerjoin(GroupMember, (GroupMember.participant_id == ParticipantProfile.participant_id) & (GroupMember.left_at == None))
        .outerjoin(Group, Group.group_id == GroupMember.group_id)
        .outerjoin(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
        .outerjoin(CaretakerUser, CaretakerUser.user_id == CaretakerProfile.user_id)
        .order_by(User.created_at.desc())
    )

    rows = result.all()
    return [
        UserListItem(
            id=row.user_id,
            first_name=row.first_name,
            last_name=row.last_name,
            email=row.email,
            phone=row.phone,
            role=row.role_name,
            status=row.status,
            locked_until=row.locked_until,
            joined_at=row.created_at,
            group_id=row.group_id,
            group=row.group_name,
            caretaker_id=row.caretaker_id,
            caretaker=row.caretaker_name.strip() if row.caretaker_name else None,
            dob=row.dob,
            gender=row.gender,
            anonymized_from=(deactivation_map.get(row.user_id, {}).get("details", {}) or {}).get("original_email"),
            self_deactivated_at=deactivation_map.get(row.user_id, {}).get("created_at"),
        )
        for row in rows
    ]


async def get_onboarding_stats(db: AsyncSession) -> dict:
    """Return participant onboarding funnel counts."""
    total_participants = (
        await db.execute(select(func.count()).select_from(ParticipantProfile))
    ).scalar_one()

    status_rows = (
        await db.execute(
            select(ParticipantProfile.onboarding_status, func.count())
            .group_by(ParticipantProfile.onboarding_status)
        )
    ).all()
    status_map = {
        (status or "PENDING").upper(): count
        for status, count in status_rows
    }

    intake_form_id = await db.scalar(
        select(SurveyForm.form_id).where(SurveyForm.title == "Intake Form")
    )
    intake_submitted = 0
    if intake_form_id:
        intake_submitted = (
            await db.execute(
                select(func.count(func.distinct(FormSubmission.participant_id)))
                .where(FormSubmission.form_id == intake_form_id)
                .where(FormSubmission.submitted_at.is_not(None))
                .where(FormSubmission.participant_id.is_not(None))
            )
        ).scalar_one()

    return {
        "total_participants": int(total_participants or 0),
        "pending": int(status_map.get("PENDING", 0)),
        "background_read": int(status_map.get("BACKGROUND_READ", 0)),
        "consent_given": int(status_map.get("CONSENT_GIVEN", 0)),
        "intake_submitted": int(intake_submitted or 0),
        "complete": int(status_map.get("COMPLETED", 0) + status_map.get("COMPLETE", 0)),
    }


async def get_survey_completion_stats(db: AsyncSession) -> dict:
    """Return daily participant survey fill-rate and recent fill frequency metrics."""
    now_utc = datetime.now(timezone.utc)
    day_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    seven_days_ago = day_start - timedelta(days=6)

    deployments = (
        await db.execute(
            select(
                FormDeployment.form_id,
                FormDeployment.group_id,
                Group.name.label("group_name"),
            )
            .join(Group, Group.group_id == FormDeployment.group_id, isouter=True)
            .where(FormDeployment.group_id.is_not(None))
            .where(FormDeployment.revoked_at.is_(None))
        )
    ).all()

    active_members = (
        await db.execute(
            select(GroupMember.group_id, GroupMember.participant_id)
            .where(GroupMember.left_at.is_(None))
        )
    ).all()
    participants_by_group = {}
    for row in active_members:
        gid = row.group_id
        if gid not in participants_by_group:
            participants_by_group[gid] = set()
        participants_by_group[gid].add(row.participant_id)

    submitted_today_rows = (
        await db.execute(
            select(
                FormSubmission.group_id,
                FormSubmission.form_id,
                FormSubmission.participant_id,
            )
            .where(FormSubmission.group_id.is_not(None))
            .where(FormSubmission.participant_id.is_not(None))
            .where(FormSubmission.submitted_at.is_not(None))
            .where(FormSubmission.submitted_at >= day_start)
            .where(FormSubmission.submitted_at < day_end)
            .distinct()
        )
    ).all()
    submitted_today_keyset = {
        (row.group_id, row.form_id, row.participant_id) for row in submitted_today_rows
    }

    submitted_7d_rows = (
        await db.execute(
            select(
                FormSubmission.group_id,
                FormSubmission.form_id,
                FormSubmission.participant_id,
            )
            .where(FormSubmission.group_id.is_not(None))
            .where(FormSubmission.participant_id.is_not(None))
            .where(FormSubmission.submitted_at.is_not(None))
            .where(FormSubmission.submitted_at >= seven_days_ago)
            .where(FormSubmission.submitted_at < day_end)
        )
    ).all()

    group_stats = {}
    overall_expected_today = 0
    overall_completed_today = 0

    for dep in deployments:
        gid = dep.group_id
        group_id = str(gid)
        group_name = dep.group_name or "Unknown Group"
        participants = participants_by_group.get(gid, set())

        if group_id not in group_stats:
            group_stats[group_id] = {
                "group_id": group_id,
                "group_name": group_name,
                "active_deployments": 0,
                "active_participants": len(participants),
                "expected_today": 0,
                "completed_today": 0,
                "submissions_last_7d": 0,
            }

        group_stats[group_id]["active_deployments"] += 1
        expected_for_deployment = len(participants)
        group_stats[group_id]["expected_today"] += expected_for_deployment
        overall_expected_today += expected_for_deployment

        completed_for_deployment = 0
        for pid in participants:
            if (gid, dep.form_id, pid) in submitted_today_keyset:
                completed_for_deployment += 1
        group_stats[group_id]["completed_today"] += completed_for_deployment
        overall_completed_today += completed_for_deployment

    for row in submitted_7d_rows:
        gid = row.group_id
        group_id = str(gid)
        if group_id in group_stats:
            group_stats[group_id]["submissions_last_7d"] += 1

    per_group = []
    for item in group_stats.values():
        expected_today = item["expected_today"]
        completed_today = item["completed_today"]
        daily_rate = (completed_today / expected_today * 100.0) if expected_today else 0.0
        avg_daily_submissions_7d = item["submissions_last_7d"] / 7.0
        per_group.append(
            {
                **item,
                "daily_completion_rate": round(daily_rate, 1),
                "avg_daily_submissions_7d": round(avg_daily_submissions_7d, 1),
            }
        )

    per_group.sort(key=lambda x: x["group_name"].lower())
    overall_daily_rate = (overall_completed_today / overall_expected_today * 100.0) if overall_expected_today else 0.0
    overall_submissions_7d = sum(g["submissions_last_7d"] for g in per_group)
    overall_avg_daily_submissions_7d = overall_submissions_7d / 7.0

    return {
        "overall": {
            "expected_today": overall_expected_today,
            "completed_today": overall_completed_today,
            "daily_completion_rate": round(overall_daily_rate, 1),
            "submissions_last_7d": overall_submissions_7d,
            "avg_daily_submissions_7d": round(overall_avg_daily_submissions_7d, 1),
        },
        "per_group": per_group,
    }


async def update_user(user_id: UUID, payload: AdminUserUpdate, db: AsyncSession) -> User:
    """Update a user's basic info. Validates email uniqueness if changed."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        existing = await db.scalar(select(User).where(User.email == payload.email))
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


async def update_user_status(user_id: UUID, status: str, actor_id: UUID, db: AsyncSession) -> User:
    """Set a user's active/inactive status and log the action."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = status.lower() == "active"
    user.status = new_status
    await db.commit()

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="USER_STATUS_CHANGED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"new_status": status, "email": user.email},
    )

    return user


async def reactivate_user_access(user_id: UUID, payload: UserReactivateRequest, actor_id: UUID, db: AsyncSession) -> dict:
    """
    Reactivate a user and send a password-reset link so they can access the account again.
    For anonymized users, admin must provide a real email in payload.email.
    """
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    candidate_email = (payload.email or "").strip().lower() if payload.email else None
    current_email = (user.email or "").strip().lower()
    is_anonymized_email = current_email.startswith("deleted_")

    if is_anonymized_email and not candidate_email:
        raise HTTPException(
            status_code=400,
            detail="An anonymized account requires a real email to reactivate.",
        )

    if candidate_email and candidate_email != current_email:
        existing = await db.scalar(select(User).where(User.email == candidate_email))
        if existing and existing.user_id != user.user_id:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = candidate_email

    user.status = True
    raw_token = generate_reset_token()
    user.reset_token_hash = hash_reset_token(raw_token)
    user.reset_token_expires_at = reset_token_expiry(15)
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={raw_token}"
    send_reset_email(user.email, reset_link)

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="USER_REACTIVATED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"email": user.email},
    )

    return {
        "detail": "User reactivated. Password reset email sent.",
        "email": user.email,
    }


async def delete_user(user_id: UUID, mode: str, actor_id: UUID, db: AsyncSession) -> dict:
    """Delete or anonymize a user. mode='anonymize' or mode='delete'."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status is not False:
        raise HTTPException(status_code=400, detail="User must be deactivated before deletion.")

    from app.services.audit_service import write_audit_log

    if mode == "anonymize":
        user.first_name = "Deleted"
        user.last_name = f"User #{str(user_id)[:8]}"
        user.email = f"deleted_{user_id}@deleted.local"
        user.phone = None
        user.Address = None
        user.status = False
        await db.commit()
        await write_audit_log(
            db,
            action="USER_ANONYMIZED",
            actor_user_id=actor_id,
            entity_type="user",
            entity_id=user_id,
            details={"mode": "anonymize"},
        )
        return {"detail": "User anonymized successfully"}

    elif mode in ("delete", "permanent"):
        await db.delete(user)
        await db.commit()
        await write_audit_log(
            db,
            action="USER_DELETED",
            actor_user_id=actor_id,
            entity_type="user",
            entity_id=user_id,
            details={"mode": "delete"},
        )
        return {"detail": "User deleted successfully"}

    else:
        raise HTTPException(status_code=400, detail="mode must be 'anonymize' or 'delete'")


# ── Invite Management ──────────────────────────────────────────────────────────

async def list_invites(db: AsyncSession) -> list[InviteListItem]:
    """Return all invites with role, group, and derived status."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
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
        .order_by(SignupInvite.created_at.desc())
    )

    rows = result.all()
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


async def revoke_invite(invite_id: UUID, db: AsyncSession) -> dict:
    """Revoke a pending invite. Rejects if already used or expired."""
    now = datetime.now(timezone.utc)

    invite = await db.scalar(select(SignupInvite).where(SignupInvite.invite_id == invite_id))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < now:
        raise HTTPException(status_code=400, detail="Invite has already expired")

    await db.delete(invite)
    await db.commit()
    return {"detail": "Invite revoked successfully"}


# ── Backup History ─────────────────────────────────────────────────────────────

async def list_backups(db: AsyncSession) -> list[BackupListItem]:
    """Return all backup records ordered by newest first."""
    result = await db.execute(
        select(Backup).order_by(Backup.created_at.desc())
    )
    backups = result.scalars().all()
    return [
        BackupListItem(
            backup_id=b.backup_id,
            storage_path=b.storage_path,
            created_at=b.created_at,
            checksum=b.checksum,
            created_by=b.created_by,
        )
        for b in backups
    ]


async def delete_backup(backup_id: UUID, db: AsyncSession) -> dict:
    """Delete a backup record. Returns 404 if not found."""
    backup = await db.scalar(select(Backup).where(Backup.backup_id == backup_id))
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    await db.delete(backup)
    await db.commit()
    return {"detail": "Backup deleted successfully"}


# ── Participant Data (for admin drawer) ────────────────────────────────────────

async def get_user_submissions(user_id: UUID, db: AsyncSession) -> list:
    """Return form submissions for a participant, looked up by user_id."""
    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    rows = await CaretakersQuery(db).get_participant_submissions(participant.participant_id)
    return [
        {
            "id": str(row.submission_id),
            "form_name": row.form_name,
            "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
            "status": "submitted",
            "answers": [],
        }
        for row in rows
    ]


async def get_user_goals(user_id: UUID, db: AsyncSession) -> list:
    """Return health goals for a participant, looked up by user_id."""
    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    goals = await ParticipantQuery(db).get_goals(participant.participant_id)

    result = []
    for g in goals:
        element = g.get("element")
        unit = element.unit if element else None
        target_value = g.get("target_value")
        target_str = (
            f"{target_value} {unit}" if target_value is not None and unit
            else str(target_value) if target_value is not None
            else "—"
        )

        # Recent log entries (last 10)
        log_rows = (await db.execute(
            select(HealthDataPoint.observed_at, HealthDataPoint.value_number, HealthDataPoint.value_text)
            .where(HealthDataPoint.participant_id == participant.participant_id)
            .where(HealthDataPoint.element_id == g.get("element_id"))
            .where(HealthDataPoint.source_type == "goal")
            .order_by(HealthDataPoint.observed_at.desc())
            .limit(10)
        )).all()

        result.append({
            "id": str(g["goal_id"]),
            "name": g.get("name"),
            "status": g.get("status", "active"),
            "target_value": float(target_value) if target_value is not None else 0,
            "current": g.get("current_value"),
            "target": target_str,
            "unit": unit,
            "is_completed": bool(g.get("is_completed", False)),
            "completion_context": g.get("completion_context", {}),
            "goal_mode": g.get("goal_mode"),
            "progress_mode": g.get("progress_mode"),
            "direction": g.get("direction"),
            "window": g.get("window"),
            "logs": [
                {
                    "date": str(r.observed_at)[:10] if r.observed_at else None,
                    "value": (
                        float(r.value_number)
                        if r.value_number is not None
                        else r.value_text
                    ),
                }
                for r in log_rows
            ],
        })

    return result


