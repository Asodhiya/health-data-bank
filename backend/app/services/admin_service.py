# ── Admin service functions made by Job (SPRINT 6) ──────────────────────────

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, insert, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy import TIMESTAMP, Date
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
import uuid as uuid_module
import hashlib
import json

from app.db.models import (
    AdminProfile, AuditLog, Backup, CaretakerFeedback, CaretakerProfile,
    DataElement, Device, FieldElementMap, FieldOption, FormDeployment,
    FormField, FormSubmission, GoalTemplate, Group, GroupMember,
    HealthDataPoint, HealthGoal, MFAChallenge, MFAMethod, Notification,
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
)
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem
from typing import List

# ── Backup helpers ─────────────────────────────────────────────────────────────

# Insert order for restore — each table comes after all its FK dependencies
TABLE_ORDER = [
    ("roles",               Role),
    ("permissions",         Permission),
    ("users",               User),
    ("signup_invites",      SignupInvite),
    ("user_roles",          UserRole),
    ("role_permissions",    RolePermission),
    ("devices",             Device),
    ("sessions",            Session),
    ("mfa_methods",         MFAMethod),
    ("mfa_challenges",      MFAChallenge),
    ("participant_profile", ParticipantProfile),
    ("caretaker_profile",   CaretakerProfile),
    ("researcher_profile",  ResearcherProfile),
    ("admin_profile",       AdminProfile),
    ("data_elements",       DataElement),
    ("survey_forms",        SurveyForm),
    ("form_fields",         FormField),
    ("field_options",       FieldOption),
    ("groups",              Group),
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
        select(GroupMember.participant_id).where(GroupMember.group_id == group_id)
    )
    ungrouped = [str(row[0]) for row in members_result.all()]

    await db.execute(
        update(FormDeployment).where(FormDeployment.group_id == group_id).values(group_id=None)
    )
    await db.execute(
        update(FormSubmission).where(FormSubmission.group_id == group_id).values(group_id=None)
    )

    await db.delete(group)
    await db.commit()

    return DeleteGroupResponse(
        group_id=group_id,
        message=f"Group '{group_name}' has been deleted.",
        ungrouped_participants=ungrouped,
    )


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

    snapshot_name = f"backup_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}"
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
        "created_at": datetime.now().isoformat(),
        "table_row_counts": row_counts,
        "tables": tables,
    }

    content = json.dumps(data, indent=2, default=str)
    checksum = hashlib.sha256(content.encode()).hexdigest()

    record = Backup(created_by=created_by, storage_path=snapshot_name, checksum=checksum)
    db.add(record)
    await db.commit()

    return content, snapshot_name


async def restore_database(raw_content: bytes, db: AsyncSession) -> RestoreResponse:
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
    await db.execute(text(
        "TRUNCATE TABLE roles, permissions, users, data_elements RESTART IDENTITY CASCADE"
    ))

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
        restored_by=None,
        notes=f"Restored from snapshot: {snapshot_name}",
    )
    db.add(restore_record)
    await db.commit()

    return RestoreResponse(
        restored_from=snapshot_name,
        tables_restored=len(TABLE_ORDER),
        message=f"Database successfully restored from '{snapshot_name}'.",
    )
