# ── Admin service functions made by Job (SPRINT 6) ──────────────────────────

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, insert, text, delete as sa_delete
from sqlalchemy.orm import aliased
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy import TIMESTAMP, Date
from uuid import UUID
from datetime import datetime, date, timezone
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
    AdminUserUpdate,
    UserListItem,
    InviteListItem,
    BackupListItem,
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


# ── User Management ────────────────────────────────────────────────────────────

async def list_users(db: AsyncSession) -> list[UserListItem]:
    """Return all users with their role, group, and caretaker info."""
    CaretakerUser = aliased(User)

    result = await db.execute(
        select(
            User.user_id,
            User.first_name,
            User.last_name,
            User.email,
            User.phone,
            User.status,
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
        .outerjoin(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
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
            joined_at=row.created_at,
            group_id=row.group_id,
            group=row.group_name,
            caretaker_id=row.caretaker_id,
            caretaker=row.caretaker_name.strip() if row.caretaker_name else None,
            dob=row.dob,
            gender=row.gender,
        )
        for row in rows
    ]


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


async def delete_user(user_id: UUID, mode: str, actor_id: UUID, db: AsyncSession) -> dict:
    """Delete or anonymize a user. mode='anonymize' or mode='delete'."""
    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.services.audit_service import write_audit_log

    if mode == "anonymize":
        user.first_name = "Anonymized"
        user.last_name = "User"
        user.email = f"anonymized_{user_id}@deleted.local"
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

    elif mode == "delete":
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


