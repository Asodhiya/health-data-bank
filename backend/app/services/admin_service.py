# ── Admin service functions made by Job (SPRINT 6) ──────────────────────────

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, insert, text, delete as sa_delete, or_
from sqlalchemy.exc import IntegrityError, ProgrammingError
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
import time
from zoneinfo import ZoneInfo

from app.db.models import (
    AdminProfile, AuditLog, Backup, BackupScheduleSettings, CaretakerFeedback, CaretakerProfile,
    DataElement, Device, FieldElementMap, FieldOption, FormDeployment,
    FormField, FormSubmission, GoalTemplate, Group, GroupMember,
    HealthDataPoint, HealthGoal, MFAChallenge, MFAMethod, Notification,
    SystemFeedback, SystemMaintenanceSettings,
    ParticipantConsent, ConsentFormTemplate, BackgroundInfoTemplate,
    ParticipantProfile, Permission, Report, ReportFile,
    Reminder, ResearcherProfile, RestoreEvent, Role, RolePermission, Session,
    SignupInvite, SubmissionAnswer, SurveyForm, User, UserRole,
)
from app.schemas.admin_schema import (
    AssignCaretakerRequest,
    AssignCaretakerResponse,
    BackupScheduleSettingsOut,
    BackupScheduleSettingsPayload,
    BackupPreviewResponse,
    RestoreResponse,
    UnassignCaretakerResponse,
    CaretakerItem,
    DeleteGroupResponse,
    AdminUserUpdate,
    MaintenanceSettingsOut,
    MaintenanceSettingsPayload,
    UserListItem,
    UserListPage,
    InviteListItem,
    BackupListItem,
    UserReactivateRequest,
)
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem, GroupUpdateRequest
from app.db.queries.Queries import CaretakersQuery, ParticipantQuery
from typing import List
from app.core.config import settings
from app.core.security import generate_reset_token, hash_reset_token, reset_token_expiry
from app.core.security import PasswordHash
from app.services.email_sender import send_reset_email, send_email_update_notification
from app.services.notification_service import create_notification

# ── Small in-memory caches for hot admin list endpoints ──────────────────────

_CACHE_TTL_SECONDS = 10
_groups_cache: dict[str, object] = {"payload": None, "captured_at": 0.0}
_caretakers_cache: dict[str, object] = {"payload": None, "captured_at": 0.0}
_maintenance_cache: dict[str, object] = {"payload": None, "captured_at": 0.0}


def _cache_valid(captured_at: float) -> bool:
    return (time.monotonic() - captured_at) < _CACHE_TTL_SECONDS


def _invalidate_groups_cache() -> None:
    _groups_cache["payload"] = None
    _groups_cache["captured_at"] = 0.0


def _invalidate_caretakers_cache() -> None:
    _caretakers_cache["payload"] = None
    _caretakers_cache["captured_at"] = 0.0


def _invalidate_maintenance_cache() -> None:
    _maintenance_cache["payload"] = None
    _maintenance_cache["captured_at"] = 0.0


def _single_role_link_subquery():
    """
    Pick one role row per user without relying on MIN(UUID), which PostgreSQL
    does not support. Ordering by role_id preserves the same deterministic
    winner used by migration 0023 when legacy duplicates exist.
    """
    return (
        select(
            UserRole.user_id.label("user_id"),
            UserRole.role_id.label("role_id"),
        )
        .distinct(UserRole.user_id)
        .order_by(UserRole.user_id, UserRole.role_id)
        .subquery()
    )


def _normalize_user_sort(
    sort_field: str | None,
    sort_dir: str | None,
) -> tuple[str, str]:
    allowed_fields = {"name", "email", "status", "role", "joined", "group"}
    field = (sort_field or "joined").strip().lower()
    direction = (sort_dir or "desc").strip().lower()
    if field not in allowed_fields:
        field = "joined"
    if direction not in {"asc", "desc"}:
        direction = "desc"
    return field, direction


def _apply_user_ordering(stmt, *, sort_field: str, sort_dir: str):
    # Only join tables required by the active sort field — avoids 4-table join
    # for common sorts like name/email/status/joined which need no extra tables.
    needs_role = sort_field == "role"
    needs_group = sort_field == "group"

    if needs_role or needs_group:
        role_link_sq = _single_role_link_subquery()
        stmt = stmt.outerjoin(role_link_sq, role_link_sq.c.user_id == User.user_id)
        stmt = stmt.outerjoin(Role, Role.role_id == role_link_sq.c.role_id)

    if needs_group:
        stmt = (
            stmt
            .outerjoin(ParticipantProfile, ParticipantProfile.user_id == User.user_id)
            .outerjoin(
                GroupMember,
                (GroupMember.participant_id == ParticipantProfile.participant_id)
                & (GroupMember.left_at.is_(None)),
            )
            .outerjoin(Group, Group.group_id == GroupMember.group_id)
        )

    base_sort = {
        "name":   (func.lower(func.coalesce(User.first_name, "")), func.lower(func.coalesce(User.last_name, ""))),
        "email":  (func.lower(func.coalesce(User.email, "")),),
        "status": (User.status,),
        "role":   (func.lower(func.coalesce(Role.role_name, "")),),
        "joined": (User.created_at,),
        "group":  (func.lower(func.coalesce(Group.name, "")),),
    }[sort_field]

    ordered_columns = [col.asc() if sort_dir == "asc" else col.desc() for col in base_sort]
    tie_breakers = [User.created_at.desc(), User.user_id.asc()]
    return stmt.order_by(*ordered_columns, *tie_breakers)


async def _get_caretaker_profile_if_assignable(db: AsyncSession, user_id: UUID) -> CaretakerProfile | None:
    role_link_sq = _single_role_link_subquery()
    return await db.scalar(
        select(CaretakerProfile)
        .join(User, User.user_id == CaretakerProfile.user_id)
        .join(role_link_sq, role_link_sq.c.user_id == User.user_id)
        .join(Role, Role.role_id == role_link_sq.c.role_id)
        .where(CaretakerProfile.user_id == user_id)
        .where(User.status.is_(True))
        .where(func.lower(Role.role_name) == "caretaker")
    )


async def _unassign_groups_for_caretaker_user(db: AsyncSession, user_id: UUID) -> int:
    caretaker_id = await db.scalar(
        select(CaretakerProfile.caretaker_id).where(CaretakerProfile.user_id == user_id)
    )
    if not caretaker_id:
        return 0

    result = await db.execute(
        update(Group)
        .where(Group.caretaker_id == caretaker_id)
        .values(caretaker_id=None)
    )
    return result.rowcount or 0


async def _deactivate_participant_group_memberships(db: AsyncSession, user_id: UUID) -> int:
    participant_id = await db.scalar(
        select(ParticipantProfile.participant_id).where(ParticipantProfile.user_id == user_id)
    )
    if not participant_id:
        return 0

    memberships = (
        await db.execute(
            select(GroupMember)
            .where(GroupMember.participant_id == participant_id)
            .where(GroupMember.left_at.is_(None))
        )
    ).scalars().all()
    if not memberships:
        return 0

    # Fetch participant name and affected caretakers before closing memberships
    participant_user = await db.scalar(select(User).where(User.user_id == user_id))
    participant_name = f"{participant_user.first_name or ''} {participant_user.last_name or ''}".strip() if participant_user else "A participant"

    group_ids = [m.group_id for m in memberships]
    caretaker_rows = (await db.execute(
        select(CaretakerProfile.user_id, Group.group_id, Group.name)
        .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
        .where(Group.group_id.in_(group_ids))
    )).all()

    now = datetime.now(timezone.utc)
    for membership in memberships:
        membership.left_at = now

    # Notify each affected caretaker
    for ct_user_id, group_id, group_name in caretaker_rows:
        if ct_user_id:
            await create_notification(
                db=db,
                user_id=ct_user_id,
                notification_type="flag",
                title="Participant removed from your group",
                message=f"{participant_name}'s account was deactivated and removed from group '{group_name}'.",
                link="/caretaker/participants",
                role_target="caretaker",
                source_type="group_membership_changed",
                source_id=group_id,
            )

    return len(memberships)


def _role_scoped_profile_fields(row) -> dict:
    role_name = ((getattr(row, "role_name", None) or "")).strip().lower()
    if role_name == "caretaker":
        return {
            "title": getattr(row, "title", None),
            "credentials": getattr(row, "credentials", None),
            "organization": getattr(row, "organization", None),
            "department": getattr(row, "department", None),
            "specialty": getattr(row, "specialty", None),
            "bio": getattr(row, "bio", None),
            "working_hours_start": getattr(row, "working_hours_start", None),
            "working_hours_end": getattr(row, "working_hours_end", None),
            "contact_preference": getattr(row, "contact_preference", None),
            "available_days": getattr(row, "available_days", None),
            "role_title": None,
        }
    if role_name == "researcher":
        return {
            "title": getattr(row, "researcher_title", None),
            "credentials": getattr(row, "researcher_credentials", None),
            "organization": getattr(row, "researcher_organization", None),
            "department": getattr(row, "researcher_department", None),
            "specialty": getattr(row, "researcher_specialty", None),
            "bio": getattr(row, "researcher_bio", None),
            "working_hours_start": None,
            "working_hours_end": None,
            "contact_preference": None,
            "available_days": None,
            "role_title": None,
        }
    if role_name == "admin":
        return {
            "title": getattr(row, "admin_title", None),
            "credentials": None,
            "organization": getattr(row, "admin_organization", None),
            "department": getattr(row, "admin_department", None),
            "specialty": None,
            "bio": getattr(row, "admin_bio", None),
            "working_hours_start": None,
            "working_hours_end": None,
            "contact_preference": getattr(row, "admin_contact_preference", None),
            "available_days": None,
            "role_title": getattr(row, "role_title", None),
        }
    return {
        "title": None,
        "credentials": None,
        "organization": None,
        "department": None,
        "specialty": None,
        "bio": None,
        "working_hours_start": None,
        "working_hours_end": None,
        "contact_preference": None,
        "available_days": None,
        "role_title": None,
    }


def _normalize_user_search(search: str | None) -> str | None:
    normalized = (search or "").strip()
    return normalized or None


def _apply_user_search(statement, search: str | None):
    normalized = _normalize_user_search(search)
    if not normalized:
        return statement

    like = f"%{normalized}%"
    full_name = func.concat(
        func.coalesce(User.first_name, ""),
        " ",
        func.coalesce(User.last_name, ""),
    )
    return statement.where(
        or_(
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            User.email.ilike(like),
            full_name.ilike(like),
        )
    )


def _visible_group_member_user_clause():
    return ~User.email.ilike("deleted_%@deleted.local")


def _default_maintenance_settings() -> MaintenanceSettingsOut:
    return MaintenanceSettingsOut(
        enabled=False,
        message="The system is currently undergoing scheduled maintenance. Please check back shortly.",
        updated_at=None,
        updated_by=None,
    )


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
    ("system_feedback",     SystemFeedback),
    ("reminders",           Reminder),
    ("audit_log",           AuditLog),
    ("backup_schedule_settings", BackupScheduleSettings),
    ("backups",             Backup),
    ("restore_events",      RestoreEvent),
]

SANITIZED_USER_FIELDS = {
    "password_hash",
    "reset_token_hash",
    "reset_token_expires_at",
    "failed_login_attempts",
    "locked_until",
}

_WEEKDAY_TO_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _default_backup_schedule() -> BackupScheduleSettingsOut:
    return BackupScheduleSettingsOut(
        enabled=settings.SCHEDULED_BACKUPS_ENABLED,
        frequency="daily",
        time=f"{settings.SCHEDULED_BACKUP_HOUR_UTC:02d}:{settings.SCHEDULED_BACKUP_MINUTE_UTC:02d}",
        day_of_week="sunday",
        day_of_month=None,
        timezone="UTC",
        scope="full",
        retention_count=5,
        notify_on_success=True,
        notify_on_failure=True,
        next_run_at=None,
    )


def _schedule_time_parts(time_local: str) -> tuple[int, int]:
    hour, minute = time_local.split(":")
    return int(hour), int(minute)


def _compute_next_backup_run(
    *,
    enabled: bool,
    frequency: str,
    time_local: str,
    day_of_week: str | None,
    day_of_month: int | None,
    timezone_name: str,
    anchor_at_utc: datetime | None = None,
    reference_utc: datetime | None = None,
) -> datetime | None:
    if not enabled:
        return None

    reference_utc = reference_utc or datetime.now(timezone.utc)
    tz = ZoneInfo(timezone_name)
    reference_local = reference_utc.astimezone(tz)
    hour, minute = _schedule_time_parts(time_local)

    if frequency == "daily":
        candidate = reference_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= reference_local:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)

    if frequency == "monthly":
        target_day = day_of_month or 1
        candidate = reference_local.replace(
            day=target_day,
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )
        if candidate <= reference_local:
            year = candidate.year + (1 if candidate.month == 12 else 0)
            month = 1 if candidate.month == 12 else candidate.month + 1
            candidate = candidate.replace(year=year, month=month, day=target_day)
        return candidate.astimezone(timezone.utc)

    if frequency == "biweekly" and anchor_at_utc is not None:
        candidate = anchor_at_utc
        while candidate <= reference_utc:
            candidate += timedelta(weeks=2)
        return candidate

    target_weekday = _WEEKDAY_TO_INDEX[day_of_week or "sunday"]
    days_ahead = (target_weekday - reference_local.weekday()) % 7
    candidate = (reference_local + timedelta(days=days_ahead)).replace(
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0,
    )
    if candidate <= reference_local:
        candidate += timedelta(days=7)
    return candidate.astimezone(timezone.utc)


def _schedule_to_schema(schedule: BackupScheduleSettings | None) -> BackupScheduleSettingsOut:
    if not schedule:
        return _default_backup_schedule()

    return BackupScheduleSettingsOut(
        schedule_id=schedule.schedule_id,
        enabled=schedule.enabled,
        frequency=schedule.frequency,
        time=schedule.time_local,
        day_of_week=schedule.day_of_week,
        day_of_month=schedule.day_of_month,
        timezone=schedule.timezone,
        scope=schedule.scope,
        retention_count=schedule.retention_count,
        notify_on_success=schedule.notify_on_success,
        notify_on_failure=schedule.notify_on_failure,
        next_run_at=_compute_next_backup_run(
            enabled=schedule.enabled,
            frequency=schedule.frequency,
            time_local=schedule.time_local,
            day_of_week=schedule.day_of_week,
            day_of_month=schedule.day_of_month,
            timezone_name=schedule.timezone,
            anchor_at_utc=schedule.anchor_at_utc,
        ),
        updated_at=schedule.updated_at,
        updated_by=schedule.updated_by,
    )


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
    result = {}
    for col in model_class.__table__.columns:
        if model_class is User and col.name in SANITIZED_USER_FIELDS:
            continue
        result[col.name] = _serialize_value(getattr(obj, col.name))
    return result


def _deserialize_row(row: dict, model_class) -> dict:
    result = {}
    for col in model_class.__table__.columns:
        val = row.get(col.name)
        if model_class is User and col.name in SANITIZED_USER_FIELDS:
            if col.name == "password_hash":
                result[col.name] = None
            elif col.name == "failed_login_attempts":
                result[col.name] = 0
            else:
                result[col.name] = None
            continue
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
    cached_payload = _groups_cache.get("payload")
    captured_at = float(_groups_cache.get("captured_at") or 0.0)
    if cached_payload is not None and _cache_valid(captured_at):
        return cached_payload  # type: ignore[return-value]

    member_count_sq = (
        select(
            GroupMember.group_id.label("group_id"),
            func.count(GroupMember.participant_id).label("member_count"),
        )
        .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
        .join(User, User.user_id == ParticipantProfile.user_id)
        .where(GroupMember.left_at.is_(None))
        .where(_visible_group_member_user_clause())
        .group_by(GroupMember.group_id)
        .subquery()
    )

    result = await db.execute(
        select(Group, member_count_sq.c.member_count)
        .outerjoin(member_count_sq, member_count_sq.c.group_id == Group.group_id)
    )
    rows = result.all()
    payload = [
        GroupItem(
            group_id=group.group_id,
            name=group.name,
            description=group.description,
            caretaker_id=group.caretaker_id,
            member_count=int(member_count or 0),
        )
        for group, member_count in rows
    ]
    _groups_cache["payload"] = payload
    _groups_cache["captured_at"] = time.monotonic()
    return payload


async def list_group_members_for_admin(
    group_id: UUID,
    db: AsyncSession,
):
    group = await db.scalar(select(Group).where(Group.group_id == group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(
            ParticipantProfile.user_id,
            User.first_name,
            User.last_name,
            User.email,
            GroupMember.joined_at,
            User.status,
        )
        .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
        .join(User, User.user_id == ParticipantProfile.user_id)
        .where(GroupMember.group_id == group_id)
        .where(GroupMember.left_at.is_(None))
        .where(_visible_group_member_user_clause())
        .order_by(User.first_name.asc(), User.last_name.asc(), User.email.asc())
    )

    return [
        {
            "participant_id": user_id,
            "name": f"{first_name or ''} {last_name or ''}".strip() or email or "Unknown",
            "joined_at": joined_at,
            "status": "active" if status else "inactive",
        }
        for user_id, first_name, last_name, email, joined_at, status in result.all()
    ]


async def get_group_goals(group_id: UUID, db: AsyncSession) -> dict:
    """Return health goal summaries for all active members of a group.

    Returns a dict keyed by user_id (str) → list of {id, name, status, is_completed}.
    The user_id key matches the 'participant_id' field in list_group_members_for_admin.
    One JOIN query replaces N per-participant API requests from the frontend.
    """
    result = await db.execute(
        select(
            ParticipantProfile.user_id,
            HealthGoal.goal_id,
            HealthGoal.status,
            GoalTemplate.name.label("template_name"),
        )
        .join(ParticipantProfile, ParticipantProfile.participant_id == HealthGoal.participant_id)
        .join(User, User.user_id == ParticipantProfile.user_id)
        .outerjoin(GoalTemplate, GoalTemplate.template_id == HealthGoal.template_id)
        .join(GroupMember, GroupMember.participant_id == HealthGoal.participant_id)
        .where(GroupMember.group_id == group_id)
        .where(GroupMember.left_at.is_(None))
        .where(_visible_group_member_user_clause())
    )

    goals_by_user: dict = {}
    for user_id, goal_id, status, template_name in result.all():
        key = str(user_id)
        if key not in goals_by_user:
            goals_by_user[key] = []
        status_str = status or "active"
        goals_by_user[key].append({
            "id": str(goal_id),
            "name": template_name or "Goal",
            "status": status_str,
            "is_completed": status_str == "completed",
        })

    return goals_by_user


async def list_caretakers(db: AsyncSession) -> List[CaretakerItem]:
    """Return active users whose current role is caretaker."""
    cached_payload = _caretakers_cache.get("payload")
    captured_at = float(_caretakers_cache.get("captured_at") or 0.0)
    if cached_payload is not None and _cache_valid(captured_at):
        return cached_payload  # type: ignore[return-value]

    role_link_sq = _single_role_link_subquery()
    result = await db.execute(
        select(CaretakerProfile, User.first_name, User.last_name, User.email)
        .join(User, User.user_id == CaretakerProfile.user_id)
        .join(role_link_sq, role_link_sq.c.user_id == User.user_id)
        .join(Role, Role.role_id == role_link_sq.c.role_id)
        .where(User.status.is_(True))
        .where(func.lower(Role.role_name) == "caretaker")
    )
    rows = result.all()
    payload = [
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
    _caretakers_cache["payload"] = payload
    _caretakers_cache["captured_at"] = time.monotonic()
    return payload


async def assign_caretaker_to_group(
    payload: AssignCaretakerRequest,
    db: AsyncSession,
) -> AssignCaretakerResponse:
    """Assign a caretaker to a group. Raises error if Group already has a caretaker."""

    caretaker = await _get_caretaker_profile_if_assignable(db, payload.user_id)
    if not caretaker:
        raise HTTPException(
            status_code=404,
            detail="This user is not an active caretaker and cannot be assigned to a group",
        )

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
    await create_notification(
        db=db,
        user_id=caretaker.user_id,
        notification_type="summary",
        title="New group assignment",
        message=f"You have been assigned to group '{group.name}'.",
        link="/caretaker",
        role_target="caretaker",
        source_type="group_assignment",
        source_id=group.group_id,
    )
    await db.commit()
    await db.refresh(group)
    _invalidate_groups_cache()
    _invalidate_caretakers_cache()

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
    _invalidate_groups_cache()

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

        # Clean up any unsubmitted drafts for this group before orphaning the completed ones
        unsubmitted_sq = (
            select(FormSubmission.submission_id)
            .where(FormSubmission.group_id == group_id)
            .where(FormSubmission.submitted_at.is_(None))
        )
        await db.execute(
            sa_delete(SubmissionAnswer)
            .where(SubmissionAnswer.submission_id.in_(unsubmitted_sq))
        )
        await db.execute(
            sa_delete(FormSubmission)
            .where(FormSubmission.group_id == group_id)
            .where(FormSubmission.submitted_at.is_(None))
        )

        await db.execute(
            update(FormSubmission).where(FormSubmission.group_id == group_id).values(group_id=None)
        )
        await db.execute(
            update(Report).where(Report.group_id == group_id).values(group_id=None)
        )

        await db.delete(group)
        await db.commit()
        _invalidate_groups_cache()
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
    _invalidate_groups_cache()
    return GroupItem(
        group_id=group.group_id,
        name=group.name,
        description=group.description,
        caretaker_id=group.caretaker_id,
    )


async def move_participant_group(user_id: UUID, new_group_id: UUID | None, db: AsyncSession) -> dict:
    """Move a participant to a new group, or unassign from all groups if new_group_id is None."""
    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    now = datetime.now(timezone.utc)
    current_membership = await db.scalar(
        select(GroupMember)
        .where(GroupMember.participant_id == participant.participant_id)
        .where(GroupMember.left_at == None)
    )
    previous_group_id = current_membership.group_id if current_membership else None

    if new_group_id is not None and current_membership and current_membership.group_id == new_group_id:
        group = await db.scalar(select(Group).where(Group.group_id == new_group_id))
        group_name = group.name if group else "selected group"
        return {"detail": f"Participant is already in '{group_name}'"}

    # Look up old group's caretaker BEFORE closing the membership
    old_caretaker_user_id = None
    old_group_name = None
    if previous_group_id:
        old_group = await db.scalar(select(Group).where(Group.group_id == previous_group_id))
        if old_group:
            old_group_name = old_group.name
            if old_group.caretaker_id:
                old_caretaker_user_id = await db.scalar(
                    select(CaretakerProfile.user_id).where(CaretakerProfile.caretaker_id == old_group.caretaker_id)
                )

    # Fetch participant name for notification message
    participant_user = await db.scalar(select(User).where(User.user_id == user_id))
    if participant_user and not participant_user.status:
        raise HTTPException(status_code=400, detail="Cannot assign an inactive participant to a group.")
    participant_name = f"{participant_user.first_name or ''} {participant_user.last_name or ''}".strip() if participant_user else "A participant"

    # Close current active membership
    await db.execute(
        update(GroupMember)
        .where(GroupMember.participant_id == participant.participant_id)
        .where(GroupMember.left_at == None)
        .values(left_at=now)
    )

    if previous_group_id:
        # Clean up any unsubmitted survey drafts tied to the old group
        unsubmitted_sq = (
            select(FormSubmission.submission_id)
            .where(FormSubmission.participant_id == participant.participant_id)
            .where(FormSubmission.group_id == previous_group_id)
            .where(FormSubmission.submitted_at.is_(None))
        )
        await db.execute(
            sa_delete(SubmissionAnswer)
            .where(SubmissionAnswer.submission_id.in_(unsubmitted_sq))
        )
        await db.execute(
            sa_delete(FormSubmission)
            .where(FormSubmission.participant_id == participant.participant_id)
            .where(FormSubmission.group_id == previous_group_id)
            .where(FormSubmission.submitted_at.is_(None))
        )

    # Notify old caretaker that participant left their group
    if old_caretaker_user_id:
        await create_notification(
            db=db,
            user_id=old_caretaker_user_id,
            notification_type="flag",
            title="Participant removed from your group",
            message=f"{participant_name} has been removed from group '{old_group_name}'.",
            link="/caretaker/participants",
            role_target="caretaker",
            source_type="group_membership_changed",
            source_id=previous_group_id,
        )

    if new_group_id is None:
        if participant.user_id and previous_group_id:
            await create_notification(
                db=db,
                user_id=participant.user_id,
                notification_type="summary",
                title="Group assignment updated",
                message="You are no longer assigned to a group.",
                link="/participant",
                role_target="participant",
                source_type="group_membership_changed",
                source_id=previous_group_id,
            )
        await db.commit()
        return {"detail": "Participant removed from group"}

    group = await db.scalar(select(Group).where(Group.group_id == new_group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing_membership = await db.scalar(
        select(GroupMember)
        .where(GroupMember.group_id == new_group_id)
        .where(GroupMember.participant_id == participant.participant_id)
    )

    if existing_membership:
        existing_membership.left_at = None
        existing_membership.joined_at = now
    else:
        db.add(GroupMember(group_id=new_group_id, participant_id=participant.participant_id))

    if participant.user_id:
        await create_notification(
            db=db,
            user_id=participant.user_id,
            notification_type="summary",
            title="Group assignment updated",
            message=f"You have been assigned to group '{group.name}'.",
            link="/participant",
            role_target="participant",
            source_type="group_membership_changed",
            source_id=new_group_id,
        )

    if group.caretaker_id:
        new_caretaker_user_id = await db.scalar(
            select(CaretakerProfile.user_id).where(CaretakerProfile.caretaker_id == group.caretaker_id)
        )
        if new_caretaker_user_id:
            await create_notification(
                db=db,
                user_id=new_caretaker_user_id,
                notification_type="summary",
                title="Participant assigned to your group",
                message=f"A participant was assigned to group '{group.name}'.",
                link="/caretaker/participants",
                role_target="caretaker",
                source_type="group_membership_changed",
                source_id=new_group_id,
            )
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

    old_caretaker_user_id = await db.scalar(
        select(CaretakerProfile.user_id).where(CaretakerProfile.caretaker_id == group.caretaker_id)
    )
    group.caretaker_id = None
    if old_caretaker_user_id:
        await create_notification(
            db=db,
            user_id=old_caretaker_user_id,
            notification_type="summary",
            title="Group unassigned",
            message=f"You were unassigned from group '{group.name}'.",
            link="/caretaker",
            role_target="caretaker",
            source_type="group_assignment",
            source_id=group_id,
        )
    await db.commit()
    _invalidate_groups_cache()
    _invalidate_caretakers_cache()

    return UnassignCaretakerResponse(
        group_id=group_id,
        message=f"Caretaker removed from group '{group.name}'",
    )


async def backup_database(
    created_by: UUID | None,
    db: AsyncSession,
    source: str = "manual",
) -> tuple[str, str]:
    """Export all tables to a JSON string and record the snapshot (with checksum) in the backups table.

    Serialises one table at a time so only one table's rows are in memory
    simultaneously, then joins the chunks once for checksum + DB storage.
    Returns (json_content, snapshot_name).
    """

    snapshot_name = f"backup_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S')}"
    row_counts: dict[str, int] = {}
    hasher = hashlib.sha256()
    chunks: list[bytes] = []

    def _push(s: str) -> None:
        b = s.encode()
        hasher.update(b)
        chunks.append(b)

    _push('{"snapshot_name":')
    _push(json.dumps(snapshot_name))
    _push(',"created_at":')
    _push(json.dumps(datetime.now(timezone.utc).isoformat()))
    _push(',"auth_fields_sanitized":true,"tables":{')

    for idx, (table_name, model_class) in enumerate(TABLE_ORDER):
        result = await db.execute(select(model_class))
        rows = result.scalars().all()
        serialized = [_serialize_row(row, model_class) for row in rows]
        row_counts[table_name] = len(serialized)
        if idx:
            _push(",")
        _push(json.dumps(table_name) + ":" + json.dumps(serialized, default=str))
        del serialized, rows

    _push('},"table_row_counts":')
    _push(json.dumps(row_counts))
    _push("}")

    content = b"".join(chunks).decode()
    del chunks
    checksum = hasher.hexdigest()

    record = Backup(
        created_by=created_by,
        storage_path=snapshot_name,
        checksum=checksum,
        snapshot_content=content,
        source=source,
    )
    db.add(record)
    await db.commit()

    return content, snapshot_name


async def _build_backup_preview(
    backup_data: dict,
    db: AsyncSession,
    *,
    uploaded_checksum: str | None = None,
    backup_record: Backup | None = None,
) -> BackupPreviewResponse:
    if not isinstance(backup_data, dict):
        raise HTTPException(status_code=400, detail="Backup file must contain a JSON object.")
    if not isinstance(backup_data.get("tables"), dict):
        raise HTTPException(status_code=400, detail="Backup file is missing a valid 'tables' object.")

    snapshot_name = backup_data.get("snapshot_name", "unknown")
    if not isinstance(snapshot_name, str) or not snapshot_name.strip():
        raise HTTPException(status_code=400, detail="Backup file is missing a valid snapshot name.")

    table_row_counts = backup_data.get("table_row_counts")
    if not isinstance(table_row_counts, dict):
        table_row_counts = {
            table_name: len(rows) if isinstance(rows, list) else 0
            for table_name, rows in backup_data["tables"].items()
        }

    if backup_record is None:
        backup_record = await db.scalar(
            select(Backup).where(Backup.storage_path == snapshot_name)
        )

    checksum_verified = False
    can_inline_restore = False
    matched_backup_id = None
    checksum = uploaded_checksum or (backup_record.checksum if backup_record else None)

    if backup_record is not None:
        matched_backup_id = backup_record.backup_id
        can_inline_restore = bool(backup_record.snapshot_content)
        if uploaded_checksum is not None:
            checksum_verified = backup_record.checksum == uploaded_checksum
        else:
            checksum_verified = True
            checksum = backup_record.checksum

    return BackupPreviewResponse(
        snapshot_name=snapshot_name,
        created_at=datetime.fromisoformat(backup_data["created_at"]) if isinstance(backup_data.get("created_at"), str) else None,
        table_count=len(table_row_counts),
        total_rows=sum(int(v or 0) for v in table_row_counts.values()),
        table_row_counts=table_row_counts,
        auth_fields_sanitized=bool(backup_data.get("auth_fields_sanitized")),
        checksum=checksum,
        checksum_verified=checksum_verified,
        matched_backup_id=matched_backup_id,
        can_inline_restore=can_inline_restore,
    )


async def _restore_backup_payload(
    backup_data: dict,
    uploaded_checksum: str,
    db: AsyncSession,
    restored_by: UUID | None = None,
) -> RestoreResponse:
    if not isinstance(backup_data, dict):
        raise HTTPException(status_code=400, detail="Backup file must contain a JSON object.")
    if not isinstance(backup_data.get("tables"), dict):
        raise HTTPException(status_code=400, detail="Backup file is missing a valid 'tables' object.")

    snapshot_name = backup_data.get("snapshot_name", "unknown")
    if not isinstance(snapshot_name, str) or not snapshot_name.strip():
        raise HTTPException(status_code=400, detail="Backup file is missing a valid snapshot name.")

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

    managed_tables = ", ".join(name for name, _ in TABLE_ORDER)
    await db.execute(text(f"TRUNCATE TABLE {managed_tables} RESTART IDENTITY CASCADE"))

    for table_name, model_class in TABLE_ORDER:
        rows = backup_data.get("tables", {}).get(table_name, [])
        if not rows:
            continue

        if table_name == "form_fields":
            rows = sorted(rows, key=lambda r: (r.get("parent_id") is not None))

        deserialized = [_deserialize_row(row, model_class) for row in rows]
        if model_class is User:
            for user_row in deserialized:
                user_row["password_hash"] = PasswordHash.from_password(
                    os.urandom(32).hex()
                ).to_str()
                user_row["reset_token_hash"] = None
                user_row["reset_token_expires_at"] = None
                user_row["failed_login_attempts"] = 0
                user_row["locked_until"] = None
        await db.execute(insert(model_class).values(deserialized))

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


async def restore_database(
    raw_content: bytes,
    db: AsyncSession,
    restored_by: UUID | None = None,
) -> RestoreResponse:
    """Verify checksum, wipe all tables, and restore from a backup JSON file."""

    # Normalize line endings before hashing — prevents mismatch if file was
    # opened and saved on Windows (which converts \n to \r\n)
    if not raw_content or not raw_content.strip():
        raise HTTPException(status_code=400, detail="Backup file is empty.")

    normalized_content = raw_content.replace(b"\r\n", b"\n")
    uploaded_checksum = hashlib.sha256(normalized_content).hexdigest()
    try:
        backup_data = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Backup file must be valid JSON.") from exc
    return await _restore_backup_payload(
        backup_data=backup_data,
        uploaded_checksum=uploaded_checksum,
        db=db,
        restored_by=restored_by,
    )


async def preview_restore_file(
    raw_content: bytes,
    db: AsyncSession,
) -> BackupPreviewResponse:
    if not raw_content or not raw_content.strip():
        raise HTTPException(status_code=400, detail="Backup file is empty.")

    normalized_content = raw_content.replace(b"\r\n", b"\n")
    uploaded_checksum = hashlib.sha256(normalized_content).hexdigest()
    try:
        backup_data = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Backup file must be valid JSON.") from exc

    return await _build_backup_preview(
        backup_data=backup_data,
        uploaded_checksum=uploaded_checksum,
        db=db,
    )


async def restore_backup_by_id(
    backup_id: UUID,
    db: AsyncSession,
    restored_by: UUID | None = None,
) -> RestoreResponse:
    backup = await db.scalar(select(Backup).where(Backup.backup_id == backup_id))
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    if not backup.snapshot_content:
        raise HTTPException(
            status_code=400,
            detail="This older backup predates one-click restore support. Use the Restore from Backup upload panel with its downloaded JSON file instead.",
        )

    uploaded_checksum = hashlib.sha256(backup.snapshot_content.encode()).hexdigest()
    try:
        backup_data = json.loads(backup.snapshot_content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Stored backup snapshot is invalid.") from exc

    return await _restore_backup_payload(
        backup_data=backup_data,
        uploaded_checksum=uploaded_checksum,
        db=db,
        restored_by=restored_by,
    )


async def preview_backup_by_id(
    backup_id: UUID,
    db: AsyncSession,
) -> BackupPreviewResponse:
    backup = await db.scalar(select(Backup).where(Backup.backup_id == backup_id))
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    if not backup.snapshot_content:
        raise HTTPException(
            status_code=400,
            detail="This older backup does not contain embedded snapshot data for one-click preview.",
        )

    try:
        backup_data = json.loads(backup.snapshot_content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Stored backup snapshot is invalid.") from exc

    return await _build_backup_preview(
        backup_data=backup_data,
        uploaded_checksum=backup.checksum,
        backup_record=backup,
        db=db,
    )


# ── User Management ────────────────────────────────────────────────────────────

async def list_users(
    db: AsyncSession,
    limit: int | None = None,
    offset: int = 0,
) -> list[UserListItem]:
    """Return users with role/group/caretaker info. Supports pagination."""
    CaretakerUser = aliased(User)
    UserCaretakerProfile = aliased(CaretakerProfile)
    user_ids_stmt = select(User.user_id).order_by(User.created_at.desc())
    if limit is not None:
        user_ids_stmt = user_ids_stmt.limit(limit).offset(offset)
    user_ids = [row[0] for row in (await db.execute(user_ids_stmt)).all()]
    if not user_ids:
        return []

    role_link_sq = _single_role_link_subquery()

    self_deactivated_logs_query = (
        await db.execute(
            select(AuditLog.entity_id, AuditLog.details, AuditLog.created_at)
            .where(AuditLog.action == "USER_SELF_DEACTIVATED")
            .where(AuditLog.entity_type == "user")
            .where(AuditLog.entity_id.in_(user_ids))
            .order_by(AuditLog.created_at.desc())
        )
    )
    self_deactivated_logs = self_deactivated_logs_query.all()
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
                User.Address.label("address"),
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
                ParticipantProfile.pronouns,
                ParticipantProfile.primary_language,
                ParticipantProfile.country_of_origin,
                ParticipantProfile.occupation_status,
                ParticipantProfile.living_arrangement,
                ParticipantProfile.highest_education_level,
                ParticipantProfile.dependents,
                ParticipantProfile.marital_status,
                ParticipantProfile.onboarding_status,
                ParticipantProfile.program_enrolled_at,
            )
        .outerjoin(role_link_sq, role_link_sq.c.user_id == User.user_id)
        .outerjoin(Role, Role.role_id == role_link_sq.c.role_id)
        .outerjoin(ParticipantProfile, ParticipantProfile.user_id == User.user_id)
        .outerjoin(GroupMember, (GroupMember.participant_id == ParticipantProfile.participant_id) & (GroupMember.left_at == None))
        .outerjoin(Group, Group.group_id == GroupMember.group_id)
        .outerjoin(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
        .outerjoin(CaretakerUser, CaretakerUser.user_id == CaretakerProfile.user_id)
        .where(User.user_id.in_(user_ids))
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
            address=row.address,
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
            pronouns=row.pronouns,
            primary_language=row.primary_language,
            country_of_origin=row.country_of_origin,
            occupation_status=row.occupation_status,
            living_arrangement=row.living_arrangement,
            highest_education_level=row.highest_education_level,
            dependents=row.dependents,
            marital_status=row.marital_status,
            onboarding_status=row.onboarding_status,
            program_enrolled_at=row.program_enrolled_at,
            anonymized_from=(deactivation_map.get(row.user_id, {}).get("details", {}) or {}).get("original_email"),
            self_deactivated_at=deactivation_map.get(row.user_id, {}).get("created_at"),
        )
        for row in rows
    ]


async def _list_users_table_page(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    search: str | None = None,
    sort_field: str = "joined",
    sort_dir: str = "desc",
    role: str | None = None,
    exclude_group_id: int | None = None,
    active_only: bool = False,
) -> list[UserListItem]:
    """Admin users page query, including lightweight profile details for side panel drawers."""
    CaretakerUser = aliased(User)
    AssignedCaretakerProfile = aliased(CaretakerProfile)
    UserCaretakerProfile = aliased(CaretakerProfile)

    base_stmt = select(User.user_id)
    if active_only:
        base_stmt = base_stmt.where(User.status == True)
    if role is not None:
        _role_sq = _single_role_link_subquery()
        base_stmt = (
            base_stmt
            .join(_role_sq, _role_sq.c.user_id == User.user_id)
            .join(Role, Role.role_id == _role_sq.c.role_id)
            .where(Role.role_name == role)
        )
    if exclude_group_id is not None:
        _already_in = (
            select(GroupMember.participant_id)
            .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
            .where(GroupMember.group_id == exclude_group_id)
            .where(GroupMember.left_at == None)
            .subquery()
        )
        _pp_sq = select(ParticipantProfile.user_id, ParticipantProfile.participant_id).subquery()
        base_stmt = (
            base_stmt
            .join(_pp_sq, _pp_sq.c.user_id == User.user_id)
            .where(~_pp_sq.c.participant_id.in_(select(_already_in)))
        )

    user_ids_stmt = _apply_user_ordering(
        _apply_user_search(
            base_stmt.limit(limit).offset(offset),
            search,
        ),
        sort_field=sort_field,
        sort_dir=sort_dir,
    )
    user_ids = [row[0] for row in (await db.execute(user_ids_stmt)).all()]
    if not user_ids:
        return []

    role_link_sq = _single_role_link_subquery()

    result = await db.execute(
        select(
            User.user_id,
            User.first_name,
            User.last_name,
            User.email,
            User.phone,
            User.Address.label("address"),
            User.status,
            User.locked_until,
            User.created_at,
            User.last_login_at,
            Role.role_name,
            Group.group_id,
            Group.name.label("group_name"),
            AssignedCaretakerProfile.caretaker_id,
            func.concat(CaretakerUser.first_name, " ", CaretakerUser.last_name).label("caretaker_name"),
            ParticipantProfile.dob,
            ParticipantProfile.gender,
            ParticipantProfile.pronouns,
            ParticipantProfile.primary_language,
            ParticipantProfile.country_of_origin,
            ParticipantProfile.occupation_status,
            ParticipantProfile.living_arrangement,
            ParticipantProfile.highest_education_level,
            ParticipantProfile.dependents,
            ParticipantProfile.marital_status,
            ParticipantProfile.onboarding_status,
            ParticipantProfile.program_enrolled_at,
            UserCaretakerProfile.title,
            UserCaretakerProfile.credentials,
            UserCaretakerProfile.organization,
            UserCaretakerProfile.department,
            UserCaretakerProfile.specialty,
            UserCaretakerProfile.bio,
            UserCaretakerProfile.working_hours_start,
            UserCaretakerProfile.working_hours_end,
            UserCaretakerProfile.contact_preference,
            UserCaretakerProfile.available_days,
            ResearcherProfile.title.label("researcher_title"),
            ResearcherProfile.credentials.label("researcher_credentials"),
            ResearcherProfile.organization.label("researcher_organization"),
            ResearcherProfile.department.label("researcher_department"),
            ResearcherProfile.specialty.label("researcher_specialty"),
            ResearcherProfile.bio.label("researcher_bio"),
            AdminProfile.title.label("admin_title"),
            AdminProfile.role_title,
            AdminProfile.organization.label("admin_organization"),
            AdminProfile.department.label("admin_department"),
            AdminProfile.bio.label("admin_bio"),
            AdminProfile.contact_preference.label("admin_contact_preference"),
        )
        .outerjoin(role_link_sq, role_link_sq.c.user_id == User.user_id)
        .outerjoin(Role, Role.role_id == role_link_sq.c.role_id)
        .outerjoin(ParticipantProfile, ParticipantProfile.user_id == User.user_id)
        .outerjoin(UserCaretakerProfile, UserCaretakerProfile.user_id == User.user_id)
        .outerjoin(ResearcherProfile, ResearcherProfile.user_id == User.user_id)
        .outerjoin(AdminProfile, AdminProfile.user_id == User.user_id)
        .outerjoin(GroupMember, (GroupMember.participant_id == ParticipantProfile.participant_id) & (GroupMember.left_at == None))
        .outerjoin(Group, Group.group_id == GroupMember.group_id)
        .outerjoin(AssignedCaretakerProfile, AssignedCaretakerProfile.caretaker_id == Group.caretaker_id)
        .outerjoin(CaretakerUser, CaretakerUser.user_id == AssignedCaretakerProfile.user_id)
        .where(User.user_id.in_(user_ids))
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
            address=row.address,
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
            pronouns=row.pronouns,
            primary_language=row.primary_language,
            country_of_origin=row.country_of_origin,
            occupation_status=row.occupation_status,
            living_arrangement=row.living_arrangement,
            highest_education_level=row.highest_education_level,
            dependents=row.dependents,
            marital_status=row.marital_status,
            onboarding_status=row.onboarding_status,
            program_enrolled_at=row.program_enrolled_at,
            last_login_at=row.last_login_at,
            **_role_scoped_profile_fields(row),
            anonymized_from=None,
            self_deactivated_at=None,
        )
        for row in rows
    ]


async def _get_users_total_cached(
    db: AsyncSession,
    search: str | None = None,
    role: str | None = None,
    exclude_group_id: int | None = None,
    active_only: bool = False,
) -> int:
    # Keep this live for correctness in admin UX; count cache can drift after rapid user changes.
    base_stmt = select(func.count(User.user_id))
    if active_only:
        base_stmt = base_stmt.where(User.status == True)
    if role is not None:
        _role_sq = _single_role_link_subquery()
        base_stmt = (
            base_stmt
            .join(_role_sq, _role_sq.c.user_id == User.user_id)
            .join(Role, Role.role_id == _role_sq.c.role_id)
            .where(Role.role_name == role)
        )
    if exclude_group_id is not None:
        _already_in = (
            select(GroupMember.participant_id)
            .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
            .where(GroupMember.group_id == exclude_group_id)
            .where(GroupMember.left_at == None)
            .subquery()
        )
        _pp_sq = select(ParticipantProfile.user_id, ParticipantProfile.participant_id).subquery()
        base_stmt = (
            base_stmt
            .join(_pp_sq, _pp_sq.c.user_id == User.user_id)
            .where(~_pp_sq.c.participant_id.in_(select(_already_in)))
        )
    total_stmt = _apply_user_search(base_stmt, search)
    total = (await db.execute(total_stmt)).scalar_one() or 0
    return int(total)


async def get_user_item(
    user_id: UUID,
    db: AsyncSession,
) -> UserListItem | None:
    """Return a single user row with role/group/caretaker info."""
    CaretakerUser = aliased(User)
    UserCaretakerProfile = aliased(CaretakerProfile)

    deactivation_row = (
        await db.execute(
            select(AuditLog.details, AuditLog.created_at)
            .where(AuditLog.action == "USER_SELF_DEACTIVATED")
            .where(AuditLog.entity_type == "user")
            .where(AuditLog.entity_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(1)
        )
    ).first()
    deactivation_details = (deactivation_row[0] if deactivation_row else {}) or {}
    self_deactivated_at = deactivation_row[1] if deactivation_row else None

    role_link_sq = _single_role_link_subquery()

    row = (
        await db.execute(
            select(
                User.user_id,
                User.first_name,
                User.last_name,
                User.email,
                User.phone,
                User.Address.label("address"),
                User.status,
                User.locked_until,
                User.created_at,
                User.last_login_at,
                Role.role_name,
                Group.group_id,
                Group.name.label("group_name"),
                CaretakerProfile.caretaker_id,
                func.concat(CaretakerUser.first_name, " ", CaretakerUser.last_name).label("caretaker_name"),
                ParticipantProfile.dob,
                ParticipantProfile.gender,
                ParticipantProfile.pronouns,
                ParticipantProfile.primary_language,
                ParticipantProfile.country_of_origin,
                ParticipantProfile.occupation_status,
                ParticipantProfile.living_arrangement,
                ParticipantProfile.highest_education_level,
                ParticipantProfile.dependents,
                ParticipantProfile.marital_status,
                ParticipantProfile.onboarding_status,
                ParticipantProfile.program_enrolled_at,
                UserCaretakerProfile.title,
                UserCaretakerProfile.credentials,
                UserCaretakerProfile.organization,
                UserCaretakerProfile.department,
                UserCaretakerProfile.specialty,
                UserCaretakerProfile.bio,
                UserCaretakerProfile.working_hours_start,
                UserCaretakerProfile.working_hours_end,
                UserCaretakerProfile.contact_preference,
                UserCaretakerProfile.available_days,
                ResearcherProfile.title.label("researcher_title"),
                ResearcherProfile.credentials.label("researcher_credentials"),
                ResearcherProfile.organization.label("researcher_organization"),
                ResearcherProfile.department.label("researcher_department"),
                ResearcherProfile.specialty.label("researcher_specialty"),
                ResearcherProfile.bio.label("researcher_bio"),
                AdminProfile.title.label("admin_title"),
                AdminProfile.role_title,
                AdminProfile.organization.label("admin_organization"),
                AdminProfile.department.label("admin_department"),
                AdminProfile.bio.label("admin_bio"),
                AdminProfile.contact_preference.label("admin_contact_preference"),
            )
            .outerjoin(role_link_sq, role_link_sq.c.user_id == User.user_id)
            .outerjoin(Role, Role.role_id == role_link_sq.c.role_id)
            .outerjoin(ParticipantProfile, ParticipantProfile.user_id == User.user_id)
            .outerjoin(UserCaretakerProfile, UserCaretakerProfile.user_id == User.user_id)
            .outerjoin(GroupMember, (GroupMember.participant_id == ParticipantProfile.participant_id) & (GroupMember.left_at == None))
            .outerjoin(Group, Group.group_id == GroupMember.group_id)
            .outerjoin(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .outerjoin(CaretakerUser, CaretakerUser.user_id == CaretakerProfile.user_id)
            .outerjoin(ResearcherProfile, ResearcherProfile.user_id == User.user_id)
            .outerjoin(AdminProfile, AdminProfile.user_id == User.user_id)
            .where(User.user_id == user_id)
            .limit(1)
        )
    ).first()

    if not row:
        return None

    return UserListItem(
        id=row.user_id,
        first_name=row.first_name,
        last_name=row.last_name,
        email=row.email,
        phone=row.phone,
        address=row.address,
        role=row.role_name,
        status=row.status,
        locked_until=row.locked_until,
        joined_at=row.created_at,
        last_login_at=row.last_login_at,
        group_id=row.group_id,
        group=row.group_name,
        caretaker_id=row.caretaker_id,
        caretaker=row.caretaker_name.strip() if row.caretaker_name else None,
        dob=row.dob,
        gender=row.gender,
        pronouns=row.pronouns,
        primary_language=row.primary_language,
        country_of_origin=row.country_of_origin,
        occupation_status=row.occupation_status,
        living_arrangement=row.living_arrangement,
        highest_education_level=row.highest_education_level,
        dependents=row.dependents,
        marital_status=row.marital_status,
        onboarding_status=row.onboarding_status,
        program_enrolled_at=row.program_enrolled_at,
        **_role_scoped_profile_fields(row),
        anonymized_from=deactivation_details.get("original_email"),
        self_deactivated_at=self_deactivated_at,
    )


async def list_users_paginated(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    sort_field: str = "joined",
    sort_dir: str = "desc",
    role: str | None = None,
    exclude_group_id: int | None = None,
    active_only: bool = False,
) -> UserListPage:
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    normalized_search = _normalize_user_search(search)
    normalized_sort_field, normalized_sort_dir = _normalize_user_sort(sort_field, sort_dir)
    total = await _get_users_total_cached(db, search=normalized_search, role=role, exclude_group_id=exclude_group_id, active_only=active_only)
    items = await _list_users_table_page(
        db,
        limit=safe_limit,
        offset=safe_offset,
        search=normalized_search,
        sort_field=normalized_sort_field,
        sort_dir=normalized_sort_dir,
        role=role,
        exclude_group_id=exclude_group_id,
        active_only=active_only,
    )
    return UserListPage(total=int(total), limit=safe_limit, offset=safe_offset, items=items)


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
            .join(SurveyForm, SurveyForm.form_id == FormDeployment.form_id)
            .where(FormDeployment.group_id.is_not(None))
            .where(FormDeployment.revoked_at.is_(None))
            .where(SurveyForm.status.notin_(["archived", "deleted", "ARCHIVED", "DELETED"]))
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


async def update_user(user_id: UUID, payload: AdminUserUpdate, actor_id: UUID, db: AsyncSession) -> User:
    """Update a user's basic info and optional role change. Validates email uniqueness if changed."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    requested_role = (payload.role or "").strip().lower() if payload.role else None
    current_role_names: set[str] = set()
    current_roles = []

    email_changed = False
    if payload.email and payload.email != user.email:
        existing = await db.scalar(select(User).where(User.email == payload.email))
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        email_changed = True

    password_changed = False
    for field, value in payload.model_dump(exclude_none=True, exclude={"role"}).items():
        if field == "password":
            password_changed = True
            user.password_hash = PasswordHash.from_password(value).to_str()
        else:
            setattr(user, field, value)

    if password_changed:
        from app.services.audit_service import write_audit_log
        await write_audit_log(
            db,
            action="PASSWORD_RESET_SUCCESS",
            actor_user_id=actor_id,
            entity_type="user",
            entity_id=user_id,
            details={"reason": "Admin set temporary password"},
            commit=False,
        )

    if requested_role:
        allowed_roles = {"admin", "researcher", "caretaker", "participant"}
        if requested_role not in allowed_roles:
            raise HTTPException(status_code=400, detail="Invalid role")

        target_role = await db.scalar(
            select(Role).where(func.lower(Role.role_name) == requested_role)
        )
        if not target_role:
            raise HTTPException(status_code=404, detail="Target role not found")

        current_roles = (
            await db.execute(
                select(UserRole, Role.role_name)
                .join(Role, Role.role_id == UserRole.role_id)
                .where(UserRole.user_id == user_id)
            )
        ).all()
        current_role_names = {
            (role_name or "").strip().lower()
            for _, role_name in current_roles
            if role_name
        }

        if "caretaker" in current_role_names and requested_role != "caretaker":
            groups_unassigned = await _unassign_groups_for_caretaker_user(db, user_id)
            if groups_unassigned:
                _invalidate_groups_cache()
            _invalidate_caretakers_cache()
        elif requested_role == "caretaker":
            _invalidate_caretakers_cache()

        if "participant" in current_role_names and requested_role != "participant":
            memberships_closed = await _deactivate_participant_group_memberships(db, user_id)
            if memberships_closed:
                _invalidate_groups_cache()

        if requested_role not in current_role_names or len(current_roles) != 1:
            if current_roles:
                keep_link = current_roles[0][0]
                keep_link.role_id = target_role.role_id
                for extra_link, _ in current_roles[1:]:
                    await db.delete(extra_link)
            else:
                db.add(UserRole(user_id=user_id, role_id=target_role.role_id))

            role_to_profile_model = {
                "participant": ParticipantProfile,
                "researcher": ResearcherProfile,
                "caretaker": CaretakerProfile,
                "admin": AdminProfile,
            }
            profile_model = role_to_profile_model.get(requested_role)
            if profile_model is not None:
                existing_profile = await db.scalar(
                    select(profile_model).where(profile_model.user_id == user_id)
                )
                if not existing_profile:
                    db.add(profile_model(user_id=user_id))

            from app.services.audit_service import write_audit_log
            await write_audit_log(
                db,
                action="USER_ROLE_CHANGED",
                actor_user_id=actor_id,
                entity_type="user",
                entity_id=user_id,
                details={"new_role": requested_role, "email": user.email},
                commit=False,
            )

    await db.commit()
    await db.refresh(user)

    if email_changed:
        try:
            send_email_update_notification(user.email)
        except Exception as e:
            print(f"Failed to send email update notification: {e}")

    return user


async def update_user_status(user_id: UUID, status: str, actor_id: UUID, db: AsyncSession) -> User:
    """Set a user's active/inactive status and log the action."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = status.lower() == "active"
    user.status = new_status

    if not new_status:
        memberships_closed = await _deactivate_participant_group_memberships(db, user_id)
        if memberships_closed:
            _invalidate_groups_cache()
        groups_unassigned = await _unassign_groups_for_caretaker_user(db, user_id)
        if groups_unassigned:
            _invalidate_groups_cache()
    _invalidate_caretakers_cache()

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="USER_STATUS_CHANGED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"new_status": status, "email": user.email},
        commit=False,
    )
    await db.commit()

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

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="USER_REACTIVATED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"email": user.email},
        commit=False,
    )
    await write_audit_log(
        db,
        action="PASSWORD_RESET_REQUESTED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"email": user.email, "reason": "Account reactivation"},
        commit=False,
    )
    await db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={raw_token}"
    send_reset_email(user.email, reset_link)

    return {
        "detail": "User reactivated. Password reset email sent.",
        "email": user.email,
    }


async def unlock_user_access(user_id: UUID, actor_id: UUID, db: AsyncSession) -> dict:
    """Clear failed login lock state without reactivating or emailing the user."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.failed_login_attempts = 0
    user.locked_until = None

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="USER_UNLOCKED",
        actor_user_id=actor_id,
        entity_type="user",
        entity_id=user_id,
        details={"email": user.email},
        commit=False,
    )
    await db.commit()

    return {
        "detail": "User account unlocked.",
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
        await write_audit_log(
            db,
            action="USER_ANONYMIZED",
            actor_user_id=actor_id,
            entity_type="user",
            entity_id=user_id,
            details={"mode": "anonymize"},
            commit=False,
        )
        await db.commit()
        return {"detail": "User anonymized successfully"}

    elif mode in ("delete", "permanent"):
        owned_form_count = await db.scalar(
            select(func.count(SurveyForm.form_id)).where(SurveyForm.created_by == user_id)
        )
        if owned_form_count:
            raise HTTPException(
                status_code=400,
                detail="This user still owns forms. Use anonymize instead of permanent delete.",
            )

        memberships_closed = await _deactivate_participant_group_memberships(db, user_id)
        if memberships_closed:
            _invalidate_groups_cache()

        groups_unassigned = await _unassign_groups_for_caretaker_user(db, user_id)
        if groups_unassigned:
            _invalidate_groups_cache()
        _invalidate_caretakers_cache()

        await db.execute(
            sa_delete(SignupInvite).where(SignupInvite.invited_by == user_id)
        )
        await db.execute(
            sa_delete(Notification).where(Notification.user_id == user_id)
        )
        await db.execute(
            sa_delete(Reminder).where(Reminder.user_id == user_id)
        )
        await db.execute(
            sa_delete(Session).where(Session.user_id == user_id)
        )
        await db.execute(
            sa_delete(Device).where(Device.user_id == user_id)
        )
        await db.execute(
            sa_delete(MFAMethod).where(MFAMethod.user_id == user_id)
        )

        nullable_user_fk_updates = (
            (Group, Group.created_by),
            (SurveyForm, SurveyForm.created_by),
            (FormDeployment, FormDeployment.deployed_by),
            (GoalTemplate, GoalTemplate.created_by),
            (Report, Report.requested_by),
            (Backup, Backup.created_by),
            (RestoreEvent, RestoreEvent.restored_by),
            (AuditLog, AuditLog.actor_user_id),
            (Notification, Notification.user_id),
            (Reminder, Reminder.user_id),
            (SystemFeedback, SystemFeedback.user_id),
            (SystemFeedback, SystemFeedback.reviewed_by),
            (ConsentFormTemplate, ConsentFormTemplate.created_by),
            (BackgroundInfoTemplate, BackgroundInfoTemplate.created_by),
            (BackupScheduleSettings, BackupScheduleSettings.updated_by),
            (SystemMaintenanceSettings, SystemMaintenanceSettings.updated_by),
        )
        for model, column in nullable_user_fk_updates:
            await db.execute(
                update(model).where(column == user_id).values({column.key: None})
            )

        await db.execute(
            sa_delete(UserRole).where(UserRole.user_id == user_id)
        )

        participant_profile = await db.scalar(
            select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
        )
        if participant_profile:
            participant_profile.dob = None
            participant_profile.gender = None
            participant_profile.pronouns = None
            participant_profile.primary_language = None
            participant_profile.occupation_status = None
            participant_profile.living_arrangement = None
            participant_profile.highest_education_level = None
            participant_profile.dependents = None
            participant_profile.marital_status = None
            participant_profile.country_of_origin = None

        caretaker_profile = await db.scalar(
            select(CaretakerProfile).where(CaretakerProfile.user_id == user_id)
        )
        if caretaker_profile:
            caretaker_profile.title = None
            caretaker_profile.organization = None
            caretaker_profile.credentials = None
            caretaker_profile.department = None
            caretaker_profile.specialty = None
            caretaker_profile.bio = None
            caretaker_profile.working_hours_start = None
            caretaker_profile.working_hours_end = None
            caretaker_profile.contact_preference = None
            caretaker_profile.available_days = None

        researcher_profile = await db.scalar(
            select(ResearcherProfile).where(ResearcherProfile.user_id == user_id)
        )
        if researcher_profile:
            researcher_profile.title = None
            researcher_profile.credentials = None
            researcher_profile.organization = None
            researcher_profile.department = None
            researcher_profile.specialty = None
            researcher_profile.bio = None

        admin_profile = await db.scalar(
            select(AdminProfile).where(AdminProfile.user_id == user_id)
        )
        if admin_profile:
            admin_profile.title = None
            admin_profile.role_title = None
            admin_profile.department = None
            admin_profile.organization = None
            admin_profile.bio = None

        user.username = f"deleted_{str(user_id).replace('-', '')[:20]}"
        user.first_name = "Deleted"
        user.last_name = f"User #{str(user_id)[:8]}"
        user.email = f"deleted_{user_id}@deleted.local"
        user.password_hash = hashlib.sha256(f"deleted:{user_id}".encode("utf-8")).hexdigest()
        user.phone = None
        user.Address = None
        user.status = False
        user.last_login_at = None
        user.reset_token_hash = None
        user.reset_token_expires_at = None
        user.failed_login_attempts = 0
        user.locked_until = None

        await write_audit_log(
            db,
            action="USER_DELETED",
            actor_user_id=actor_id,
            entity_type="user",
            entity_id=user_id,
            details={"mode": "delete", "retained_data": True, "identity_scrubbed": True},
            commit=False,
        )
        await db.commit()
        return {"detail": "User account deleted and retained data anonymized successfully"}

    else:
        raise HTTPException(status_code=400, detail="mode must be 'anonymize' or 'delete'")


# ── Invite Management ──────────────────────────────────────────────────────────

async def list_invites(
    db: AsyncSession,
    limit: int | None = None,
    offset: int = 0,
) -> list[InviteListItem]:
    """Return all invites with role, group, and derived status."""
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
        .order_by(SignupInvite.created_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit).offset(max(0, offset))

    result = await db.execute(stmt)

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

async def list_backups(db: AsyncSession, limit: int | None = None) -> list[BackupListItem]:
    """Return backup records ordered by newest first without loading full snapshot blobs."""
    stmt = (
        select(
            Backup.backup_id,
            Backup.storage_path,
            Backup.created_at,
            Backup.checksum,
            Backup.created_by,
            Backup.snapshot_content.is_not(None).label("can_inline_restore"),
        )
        .order_by(Backup.created_at.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)

    backups = (await db.execute(stmt)).all()
    return [
        BackupListItem(
            backup_id=b.backup_id,
            storage_path=b.storage_path,
            created_at=b.created_at,
            checksum=b.checksum,
            created_by=b.created_by,
            can_inline_restore=bool(b.can_inline_restore),
        )
        for b in backups
    ]


async def prune_old_backups(retention_count: int, db: AsyncSession) -> int:
    """Keep only the newest N backup records when retention is enabled."""
    if retention_count <= 0:
        return 0

    rows = await db.execute(
        select(Backup.backup_id)
        .order_by(Backup.created_at.desc(), Backup.backup_id.desc())
        .offset(retention_count)
    )
    backup_ids = [backup_id for (backup_id,) in rows.all()]
    if not backup_ids:
        return 0

    await db.execute(sa_delete(Backup).where(Backup.backup_id.in_(backup_ids)))
    return len(backup_ids)


async def delete_backup(backup_id: UUID, db: AsyncSession) -> dict:
    """Delete a backup record. Returns 404 if not found."""
    backup = await db.scalar(select(Backup).where(Backup.backup_id == backup_id))
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    await db.delete(backup)
    await db.commit()
    return {"detail": "Backup deleted successfully"}


async def get_maintenance_settings(db: AsyncSession) -> MaintenanceSettingsOut:
    cached_payload = _maintenance_cache.get("payload")
    captured_at = float(_maintenance_cache.get("captured_at") or 0.0)
    if cached_payload is not None and _cache_valid(captured_at):
        return cached_payload  # type: ignore[return-value]

    try:
        settings_row = await db.scalar(select(SystemMaintenanceSettings).limit(1))
    except ProgrammingError:
        # The app may be running before alembic revision 0024 has been applied.
        # Fall back to "maintenance off" so the API remains usable until the DB
        # schema catches up.
        payload = _default_maintenance_settings()
        _maintenance_cache["payload"] = payload
        _maintenance_cache["captured_at"] = time.monotonic()
        return payload

    payload = (
        MaintenanceSettingsOut(
            enabled=bool(settings_row.enabled),
            message=settings_row.message,
            updated_at=settings_row.updated_at,
            updated_by=settings_row.updated_by,
        )
        if settings_row
        else _default_maintenance_settings()
    )
    _maintenance_cache["payload"] = payload
    _maintenance_cache["captured_at"] = time.monotonic()
    return payload


async def update_maintenance_settings(
    payload: MaintenanceSettingsPayload,
    actor_id: UUID,
    db: AsyncSession,
) -> MaintenanceSettingsOut:
    settings_row = await db.scalar(select(SystemMaintenanceSettings).limit(1))
    if not settings_row:
        settings_row = SystemMaintenanceSettings()
        db.add(settings_row)

    settings_row.enabled = payload.enabled
    settings_row.message = payload.message
    settings_row.updated_at = datetime.now(timezone.utc)
    settings_row.updated_by = actor_id
    await db.flush()

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="MAINTENANCE_MODE_UPDATED",
        actor_user_id=actor_id,
        entity_type="system_maintenance_settings",
        entity_id=settings_row.setting_id,
        details=payload.model_dump(),
        commit=False,
    )
    await db.commit()
    await db.refresh(settings_row)
    _invalidate_maintenance_cache()
    return await get_maintenance_settings(db)


async def get_backup_schedule_settings(db: AsyncSession) -> BackupScheduleSettingsOut:
    schedule = await db.scalar(select(BackupScheduleSettings).limit(1))
    return _schedule_to_schema(schedule)


async def update_backup_schedule_settings(
    payload: BackupScheduleSettingsPayload,
    actor_id: UUID,
    db: AsyncSession,
) -> BackupScheduleSettingsOut:
    if payload.scope != "full":
        raise HTTPException(
            status_code=400,
            detail="Automatic backup scope is limited to Full Backup right now.",
        )

    schedule = await db.scalar(select(BackupScheduleSettings).limit(1))
    if not schedule:
        schedule = BackupScheduleSettings()
        db.add(schedule)

    anchor_at_utc = schedule.anchor_at_utc
    if payload.frequency == "biweekly":
        anchor_at_utc = _compute_next_backup_run(
            enabled=payload.enabled,
            frequency=payload.frequency,
            time_local=payload.time,
            day_of_week=payload.day_of_week,
            day_of_month=payload.day_of_month,
            timezone_name=payload.timezone,
        )
    elif payload.frequency != "biweekly":
        anchor_at_utc = None

    schedule.enabled = payload.enabled
    schedule.frequency = payload.frequency
    schedule.time_local = payload.time
    schedule.day_of_week = payload.day_of_week
    schedule.day_of_month = payload.day_of_month if payload.frequency == "monthly" else None
    schedule.timezone = payload.timezone
    schedule.scope = payload.scope
    schedule.retention_count = payload.retention_count
    schedule.notify_on_success = payload.notify_on_success
    schedule.notify_on_failure = payload.notify_on_failure
    schedule.anchor_at_utc = anchor_at_utc
    schedule.updated_at = datetime.now(timezone.utc)
    schedule.updated_by = actor_id
    await db.flush()

    from app.services.audit_service import write_audit_log
    await write_audit_log(
        db,
        action="BACKUP_SCHEDULE_UPDATED",
        actor_user_id=actor_id,
        entity_type="backup_schedule",
        entity_id=schedule.schedule_id,
        details=payload.model_dump(),
        commit=False,
    )
    await db.commit()
    await db.refresh(schedule)

    from app.services.notification_scheduler import refresh_backup_schedule_job

    await refresh_backup_schedule_job(schedule)
    return _schedule_to_schema(schedule)


# ── Participant Data (for admin drawer) ────────────────────────────────────────

async def get_user_submissions(user_id: UUID, db: AsyncSession) -> list:
    """Return form submissions for a participant, looked up by user_id."""
    participant = await db.scalar(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    rows = await CaretakersQuery(db).get_participant_submissions(participant.participant_id)
    result = []
    for row in rows:
        # Fetch answers for this submission
        answer_rows = (await db.execute(
            select(SubmissionAnswer, FormField.label)
            .join(FormField, FormField.field_id == SubmissionAnswer.field_id)
            .where(SubmissionAnswer.submission_id == row.submission_id)
        )).all()

        answers = []
        for ans, field_label in answer_rows:
            value = (
                ans.value_text if ans.value_text is not None
                else str(ans.value_number) if ans.value_number is not None
                else str(ans.value_date) if ans.value_date is not None
                else str(ans.value_json) if ans.value_json is not None
                else ""
            )
            answers.append({"field": field_label or "Unknown", "value": value})

        result.append({
            "id": str(row.submission_id),
            "form_name": row.form_name,
            "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
            "status": "submitted",
            "answers": answers,
        })

    return result


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
