import asyncio
import platform
import time
from datetime import datetime, timedelta, timezone

import psutil
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, Request
from fastapi.responses import Response
from app.schemas.schemas import Role_schema, Permissions_schema, Role_user_link, Link_role_permission_schema
from app.schemas.admin_schema import AssignCaretakerRequest, AssignCaretakerResponse, UnassignCaretakerResponse, CaretakerItem, DeleteGroupResponse, RestoreResponse, BackupPreviewResponse, AdminProfileUpdate, AdminProfileOut, MaintenanceSettingsOut, MaintenanceSettingsPayload, UserListItem, UserListPage, AdminUserUpdate, UserStatusUpdate, UserReactivateRequest, UserDeleteRequest, MoveParticipantRequest, InviteListItem, BackupListItem, BackupScheduleSettingsOut, BackupScheduleSettingsPayload
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem, GroupUpdateRequest, GroupMemberItem
from app.schemas.notification_schema import NotificationItem
from app.services.role_service import addroles, viewroles, add_permissions, link_user_roles, link_role_permisson
from app.services.admin_service import assign_caretaker_to_group, unassign_caretaker_from_group, create_group, delete_group, update_group, move_participant_group, list_groups, list_group_members_for_admin, list_caretakers, backup_database, restore_database, preview_restore_file, restore_backup_by_id, preview_backup_by_id, list_users, list_users_paginated, get_user_item, update_user, update_user_status, reactivate_user_access, unlock_user_access, delete_user, list_invites, revoke_invite, list_backups, delete_backup, get_backup_schedule_settings, get_maintenance_settings, update_maintenance_settings, update_backup_schedule_settings, get_user_submissions, get_user_goals, get_onboarding_stats, get_survey_completion_stats
from typing import List
from app.db.session import get_db
from app.db.models import Role, UserRole, GroupMember, AuditLog, User, AdminProfile, SignupInvite, Backup, Group
from app.core.dependency import require_permissions, check_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, case
from typing import Optional
from app.core.permissions import ROLE_READ_ALL, GROUP_READ, GROUP_WRITE, GROUP_DELETE, CARETAKER_READ, CARETAKER_ASSIGN, BACKUP_CREATE, USER_READ, USER_WRITE, USER_DELETE
from app.core.config import settings
from uuid import UUID
from app.services.notification_service import (
    list_notifications_for_user,
    mark_notification_read_for_user,
)
from app.core.rate_limit import rate_limit

router = APIRouter()
_system_stats_cache: dict[str, object] = {"payload": None, "captured_at": 0.0}
_dashboard_summary_cache: dict[str, object] = {"payload": None, "captured_at": 0.0}
psutil.cpu_percent(interval=None)

backup_rate_limit = rate_limit(
    scope="admin:backup",
    limit=100 if settings.DEBUG else 5,
    window_seconds=3600,
)
restore_rate_limit = rate_limit(
    scope="admin:restore",
    limit=30 if settings.DEBUG else 3,
    window_seconds=3600,
)


# ── Existing role/permission endpoints ──────────────────────────────────────

@router.post("/add_roles", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def add_roles(Payload: Role_schema, db: AsyncSession = Depends(get_db)):
    role = await addroles(Payload, db)
    return role


@router.get("/view_roles", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def view_roles(db: AsyncSession = Depends(get_db)):
    roles = await viewroles(db)
    return roles


@router.post("/post_permission", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def post_permission(Payload: Permissions_schema, db: AsyncSession = Depends(get_db)):
    user_role = await add_permissions(Payload, db)
    return user_role


@router.post("/linkrole", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def give_role(Payload: Role_user_link, db: AsyncSession = Depends(get_db)):
    userrole = await link_user_roles(Payload, db)
    return userrole


@router.post("/linkpermission", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def role_permission(Payload: Link_role_permission_schema, db: AsyncSession = Depends(get_db)):
    role_perm = await link_role_permisson(Payload, db)
    return role_perm


# ── Audit / Activity Log endpoint ────────────────────────────────────────────


async def _fetch_audit_logs_payload(
    db: AsyncSession,
    *,
    limit: int,
    offset: int = 0,
    action: Optional[str] = None,
    user_id: Optional[UUID] = None,
):
    stmt = (
        select(AuditLog, User.first_name, User.last_name, User.email)
        .outerjoin(User, User.user_id == AuditLog.actor_user_id)
        .order_by(desc(AuditLog.created_at))
    )

    if action:
        stmt = stmt.where(AuditLog.action == action.upper())
    if user_id:
        stmt = stmt.where(
            (AuditLog.actor_user_id == user_id) | (AuditLog.entity_id == user_id)
        )

    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    count_stmt = select(func.count()).select_from(AuditLog)
    if action:
        count_stmt = count_stmt.where(AuditLog.action == action.upper())
    if user_id:
        count_stmt = count_stmt.where(
            (AuditLog.actor_user_id == user_id) | (AuditLog.entity_id == user_id)
        )
    total = (await db.execute(count_stmt)).scalar()

    logs = []
    for audit, first_name, last_name, email in rows:
        if first_name or last_name:
            actor_label = f"{first_name or ''} {last_name or ''}".strip()
        elif email:
            actor_label = email
        else:
            actor_label = "Unknown"

        logs.append({
            "audit_id": str(audit.audit_id),
            "action": audit.action,
            "actor_user_id": str(audit.actor_user_id) if audit.actor_user_id else None,
            "actor_label": actor_label,
            "entity_type": audit.entity_type,
            "entity_id": str(audit.entity_id) if audit.entity_id else None,
            "ip_address": audit.ip_address,
            "created_at": audit.created_at,
            "details": audit.details or {},
        })

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": logs,
    }


async def _get_system_stats_payload():
    now = time.monotonic()
    cached_payload = _system_stats_cache.get("payload")
    captured_at = float(_system_stats_cache.get("captured_at") or 0.0)
    if cached_payload is not None and now - captured_at < 10:
        return cached_payload

    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    days, remainder = divmod(int(uptime_seconds), 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)

    cpu_percent = await asyncio.to_thread(psutil.cpu_percent, interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    payload = {
        "cpu_percent": cpu_percent,
        "memory_percent": memory.percent,
        "memory_used_gb": round(memory.used / (1024 ** 3), 2),
        "memory_total_gb": round(memory.total / (1024 ** 3), 2),
        "disk_percent": disk.percent,
        "disk_used_gb": round(disk.used / (1024 ** 3), 2),
        "disk_total_gb": round(disk.total / (1024 ** 3), 2),
        "uptime_seconds": int(uptime_seconds),
        "uptime_formatted": f"{days}d {hours}h {minutes}m",
        "platform": platform.system(),
        "python_version": platform.python_version(),
    }
    _system_stats_cache["payload"] = payload
    _system_stats_cache["captured_at"] = now
    return payload


@router.get("/audit-logs", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_audit_logs(
    limit: int = Query(default=20, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    action: Optional[str] = Query(default=None, description="Filter by action e.g. LOGIN_FAILED"),
    user_id: Optional[UUID] = Query(default=None, description="Filter logs for a specific user"),
    db: AsyncSession = Depends(get_db),
    # TODO: replace ROLE_READ_ALL with require_permissions("audit:read") once that permission is seeded in the DB
):
    """
    Return paginated audit log entries, newest first.

    Query params:
      - limit:  max rows to return (default 20, max 100)
      - offset: pagination offset
      - action: optional filter e.g. ?action=LOGIN_FAILED

    Each row includes the actor's display name joined from the users table.
    """
    return await _fetch_audit_logs_payload(db, limit=limit, offset=offset, action=action, user_id=user_id)
    
    
    
# ── admin-only Assign Caretaker endpoints made by Job (SPRINT 6)  ────────────────────────────────────────────

@router.get("/groups", response_model=List[GroupItem], dependencies=[Depends(require_permissions(GROUP_READ))])
async def list_groups_endpoint(db: AsyncSession = Depends(get_db)):
    return await list_groups(db)


@router.get("/groups/{group_id}/members", response_model=List[GroupMemberItem], dependencies=[Depends(require_permissions(GROUP_READ))])
async def list_group_members_endpoint(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await list_group_members_for_admin(group_id, db)


@router.get("/caretakers", response_model=List[CaretakerItem], dependencies=[Depends(require_permissions(CARETAKER_READ))])
async def list_caretakers_endpoint(db: AsyncSession = Depends(get_db)):
    return await list_caretakers(db)


@router.post("/groups", response_model=GroupItem, status_code=201)
async def create_group_endpoint(
    payload: GroupCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GROUP_WRITE)),
):
    return await create_group(payload, current_user.user_id, db)


@router.delete("/groups/{group_id}", response_model=DeleteGroupResponse, dependencies=[Depends(require_permissions(GROUP_DELETE))])
async def delete_group_endpoint(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await delete_group(group_id, db)


@router.patch("/groups/{group_id}", response_model=GroupItem, dependencies=[Depends(require_permissions(GROUP_WRITE))])
async def update_group_endpoint(
    group_id: UUID,
    payload: GroupUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    return await update_group(group_id, payload, db)


@router.patch("/users/{user_id}/group", dependencies=[Depends(require_permissions(GROUP_WRITE))])
async def move_participant_group_endpoint(
    user_id: UUID,
    payload: MoveParticipantRequest,
    db: AsyncSession = Depends(get_db),
):
    return await move_participant_group(user_id, payload.group_id, db)


@router.post("/assign-caretaker", response_model=AssignCaretakerResponse, dependencies=[Depends(require_permissions(CARETAKER_ASSIGN))])
async def assign_caretaker(
    payload: AssignCaretakerRequest,
    db: AsyncSession = Depends(get_db),
):
    return await assign_caretaker_to_group(payload, db)


@router.delete("/assign-caretaker/{group_id}", response_model=UnassignCaretakerResponse, dependencies=[Depends(require_permissions(CARETAKER_ASSIGN))])
async def unassign_caretaker(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await unassign_caretaker_from_group(group_id, db)


# ── Backup & Restore endpoints (SPRINT 6) ─────────────────────────────────────

@router.get("/backup", dependencies=[Depends(backup_rate_limit)])
async def backup_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(BACKUP_CREATE)),
):
    """Export the full database as a downloadable JSON snapshot."""
    content, snapshot_name = await backup_database(current_user.user_id, db)
    filename = f"{snapshot_name}.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post("/restore", response_model=RestoreResponse, dependencies=[Depends(restore_rate_limit)])
async def restore_endpoint(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(BACKUP_CREATE)),
):
    """Upload a backup JSON file to wipe and restore the database."""
    allowed_content_types = {
        "application/json",
        "text/json",
        "text/plain",
        "application/octet-stream",
    }
    if file.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="Backup upload must be a JSON file.")

    raw_content = await file.read()
    if not raw_content.strip():
        raise HTTPException(status_code=400, detail="Backup upload is empty.")

    return await restore_database(raw_content, db, restored_by=current_user.user_id)


@router.post("/restore/preview", response_model=BackupPreviewResponse, dependencies=[Depends(backup_rate_limit)])
async def preview_restore_endpoint(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(BACKUP_CREATE)),
):
    allowed_content_types = {
        "application/json",
        "text/json",
        "text/plain",
        "application/octet-stream",
    }
    if file.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="Backup upload must be a JSON file.")

    raw_content = await file.read()
    if not raw_content.strip():
        raise HTTPException(status_code=400, detail="Backup upload is empty.")

    return await preview_restore_file(raw_content, db)


# ── Admin Profile ────────────────────────────────────────────────────────────

@router.get("/profile", response_model=AdminProfileOut)
async def get_admin_profile(
    user: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminProfile).where(AdminProfile.user_id == user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = AdminProfile(user_id=user.user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.patch("/profile", response_model=AdminProfileOut)
async def update_admin_profile(
    payload: AdminProfileUpdate,
    user: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminProfile).where(AdminProfile.user_id == user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = AdminProfile(user_id=user.user_id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    if not profile.onboarding_completed:
        profile.onboarding_completed = True

    await db.commit()
    await db.refresh(profile)
    return profile


# ── User Management ──────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserListItem], dependencies=[Depends(require_permissions(USER_READ))])
async def get_users(db: AsyncSession = Depends(get_db)):
    return await list_users(db)


@router.get("/users/by-id/{user_id}", response_model=UserListItem, dependencies=[Depends(require_permissions(USER_READ))])
async def get_user_by_id(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_item(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users/paged", response_model=UserListPage, dependencies=[Depends(require_permissions(USER_READ))])
async def get_users_paged(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    sort_field: str = Query(default="joined"),
    sort_dir: str = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
):
    return await list_users_paginated(
        db,
        limit=limit,
        offset=offset,
        search=search,
        sort_field=sort_field,
        sort_dir=sort_dir,
    )


@router.patch("/users/{user_id}", dependencies=[Depends(require_permissions(USER_WRITE))])
async def patch_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    actor: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(user_id, payload, actor.user_id, db)


@router.patch("/users/{user_id}/status", dependencies=[Depends(require_permissions(USER_WRITE))])
async def patch_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    actor: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_user_status(user_id, payload.status, actor.user_id, db)


@router.post("/users/{user_id}/reactivate", dependencies=[Depends(require_permissions(USER_WRITE))])
async def reactivate_user(
    user_id: UUID,
    payload: UserReactivateRequest,
    actor: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await reactivate_user_access(user_id, payload, actor.user_id, db)


@router.post("/users/{user_id}/unlock", dependencies=[Depends(require_permissions(USER_WRITE))])
async def unlock_user(
    user_id: UUID,
    actor: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await unlock_user_access(user_id, actor.user_id, db)


@router.delete("/users/{user_id}", dependencies=[Depends(require_permissions(USER_DELETE))])
async def remove_user(
    user_id: UUID,
    payload: UserDeleteRequest,
    actor: User = Depends(check_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await delete_user(user_id, payload.mode, actor.user_id, db)


# ── Participant Data (admin drawer) ──────────────────────────────────────────

@router.get("/users/{user_id}/submissions", dependencies=[Depends(require_permissions(USER_READ))])
async def get_user_submissions_endpoint(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await get_user_submissions(user_id, db)


@router.get("/users/{user_id}/goals", dependencies=[Depends(require_permissions(USER_READ))])
async def get_user_goals_endpoint(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await get_user_goals(user_id, db)


# ── Invite Management ────────────────────────────────────────────────────────

@router.get("/invites", response_model=list[InviteListItem], dependencies=[Depends(require_permissions(USER_READ))])
async def get_invites(
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await list_invites(db, limit=limit, offset=offset)


@router.delete("/invites/{invite_id}", dependencies=[Depends(require_permissions(USER_WRITE))])
async def delete_invite(invite_id: UUID, db: AsyncSession = Depends(get_db)):
    return await revoke_invite(invite_id, db)


# ── Backup History ───────────────────────────────────────────────────────────

@router.get("/backups", response_model=list[BackupListItem], dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def get_backups(
    limit: Optional[int] = Query(default=None, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await list_backups(db, limit=limit)


@router.delete("/backups/{backup_id}", dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def remove_backup(backup_id: UUID, db: AsyncSession = Depends(get_db)):
    return await delete_backup(backup_id, db)


@router.post("/backups/{backup_id}/restore", response_model=RestoreResponse, dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def restore_backup_from_history(
    backup_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    return await restore_backup_by_id(backup_id, db, restored_by=current_user.user_id)


@router.get("/backups/{backup_id}/preview", response_model=BackupPreviewResponse, dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def preview_backup_from_history(
    backup_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await preview_backup_by_id(backup_id, db)


@router.get(
    "/backup-schedule",
    response_model=BackupScheduleSettingsOut,
    dependencies=[Depends(require_permissions(BACKUP_CREATE))],
)
async def get_backup_schedule(
    db: AsyncSession = Depends(get_db),
):
    return await get_backup_schedule_settings(db)


@router.put(
    "/backup-schedule",
    response_model=BackupScheduleSettingsOut,
    dependencies=[Depends(require_permissions(BACKUP_CREATE))],
)
async def put_backup_schedule(
    payload: BackupScheduleSettingsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    return await update_backup_schedule_settings(payload, current_user.user_id, db)


@router.get(
    "/maintenance-settings",
    response_model=MaintenanceSettingsOut,
    dependencies=[Depends(require_permissions(ROLE_READ_ALL))],
)
async def get_system_maintenance_settings(
    db: AsyncSession = Depends(get_db),
):
    return await get_maintenance_settings(db)


@router.put(
    "/maintenance-settings",
    response_model=MaintenanceSettingsOut,
    dependencies=[Depends(require_permissions(ROLE_READ_ALL))],
)
async def put_system_maintenance_settings(
    payload: MaintenanceSettingsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    return await update_maintenance_settings(payload, current_user.user_id, db)


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationItem], dependencies=[Depends(require_permissions(USER_READ))])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    rows = await list_notifications_for_user(db, current_user.user_id, role_target="admin")
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


@router.patch("/notifications/{notification_id}", response_model=NotificationItem, dependencies=[Depends(require_permissions(USER_READ))])
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
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


# ── Dashboard Stats ──────────────────────────────────────────────────────────

@router.get("/stats/onboarding", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_onboarding_stats_endpoint(db: AsyncSession = Depends(get_db)):
    return await get_onboarding_stats(db)


@router.get("/stats/surveys", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_survey_stats_endpoint(db: AsyncSession = Depends(get_db)):
    return await get_survey_completion_stats(db)


@router.get("/stats/roles-groups", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_role_group_stats_endpoint(db: AsyncSession = Depends(get_db)):
    # Count by effective user role (one role per user), not raw role assignments.
    # This avoids double-counting users who accidentally have multiple role rows.
    role_rows = (
        await db.execute(
            select(
                User.user_id,
                User.status,
                Role.role_name,
            )
            .select_from(User)
            .outerjoin(UserRole, UserRole.user_id == User.user_id)
            .outerjoin(Role, Role.role_id == UserRole.role_id)
        )
    ).all()

    group_rows = (
        await db.execute(
            select(
                Group.group_id,
                func.count(GroupMember.participant_id).label("participant_count"),
            )
            .select_from(Group)
            .outerjoin(
                GroupMember,
                (GroupMember.group_id == Group.group_id) & (GroupMember.left_at.is_(None)),
            )
            .group_by(Group.group_id)
        )
    ).all()

    role_priority = {"admin": 4, "researcher": 3, "caretaker": 2, "participant": 1}
    per_user: dict[UUID, dict[str, object]] = {}
    for user_id, status, role_name in role_rows:
        normalized = (role_name or "").strip().lower()
        existing = per_user.get(user_id)
        if existing is None:
            per_user[user_id] = {
                "status": bool(status),
                "role": normalized or "unknown",
            }
            continue
        current_role = str(existing["role"] or "unknown")
        if role_priority.get(normalized, 0) > role_priority.get(current_role, 0):
            existing["role"] = normalized

    aggregates: dict[str, dict[str, int | str]] = {}
    for row in per_user.values():
        role = str(row["role"] or "unknown")
        if role not in aggregates:
            aggregates[role] = {"role": role, "total": 0, "active": 0, "inactive": 0}
        aggregates[role]["total"] = int(aggregates[role]["total"]) + 1
        if bool(row["status"]):
            aggregates[role]["active"] = int(aggregates[role]["active"]) + 1
        else:
            aggregates[role]["inactive"] = int(aggregates[role]["inactive"]) + 1

    ordered_roles = ["participant", "caretaker", "researcher", "admin", "unknown"]
    role_summary = [aggregates[r] for r in ordered_roles if r in aggregates]

    participant_counts_by_group = {
        str(group_id): int(count or 0)
        for group_id, count in group_rows
    }

    return {
        "role_summary": role_summary,
        "participant_counts_by_group": participant_counts_by_group,
    }


@router.get("/dashboard", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_admin_dashboard(
    audit_limit: int = Query(default=3, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(check_current_user),
):
    audit_logs = await _fetch_audit_logs_payload(db, limit=audit_limit)
    backups = await list_backups(db, limit=3)
    groups = await list_groups(db)
    caretakers = await list_caretakers(db)
    users = await list_users(db)
    invites = await list_invites(db)
    onboarding_stats = await get_onboarding_stats(db)
    survey_stats = await get_survey_completion_stats(db)
    system_stats = await _get_system_stats_payload()

    return {
        "audit_logs": audit_logs,
        "backups": backups,
        "groups": groups,
        "caretakers": caretakers,
        "users": users,
        "invites": invites,
        "onboarding_stats": onboarding_stats,
        "survey_stats": survey_stats,
        "system_stats": system_stats,
    }


@router.get("/dashboard/summary", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_admin_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(check_current_user),
):
    now_monotonic = time.monotonic()
    cached_summary = _dashboard_summary_cache.get("payload")
    cached_at = float(_dashboard_summary_cache.get("captured_at") or 0.0)
    if cached_summary is not None and now_monotonic - cached_at < 15:
        return cached_summary

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = (await db.scalar(select(func.count(User.user_id)))) or 0
    active_users = (await db.scalar(select(func.count(User.user_id)).where(User.status.is_(True)))) or 0
    locked_users = (
        await db.scalar(
            select(func.count(User.user_id)).where(
                User.locked_until.is_not(None),
                User.locked_until > now,
            )
        )
    ) or 0
    new_users_week = (await db.scalar(select(func.count(User.user_id)).where(User.created_at >= week_ago))) or 0
    new_users_month = (await db.scalar(select(func.count(User.user_id)).where(User.created_at >= month_ago))) or 0

    invites_total = (await db.scalar(select(func.count(SignupInvite.invite_id)))) or 0
    invites_accepted = (await db.scalar(select(func.count(SignupInvite.invite_id)).where(SignupInvite.used.is_(True)))) or 0
    invites_pending = (
        await db.scalar(
            select(func.count(SignupInvite.invite_id)).where(
                SignupInvite.used.is_(False),
                SignupInvite.expires_at >= now,
            )
        )
    ) or 0
    invites_expired = (
        await db.scalar(
            select(func.count(SignupInvite.invite_id)).where(
                SignupInvite.used.is_(False),
                SignupInvite.expires_at < now,
            )
        )
    ) or 0

    failed_logins = (
        await db.scalar(select(func.count(AuditLog.audit_id)).where(AuditLog.action == "LOGIN_FAILED"))
    ) or 0
    groups_without_caretaker = (
        await db.scalar(select(func.count(Group.group_id)).where(Group.caretaker_id.is_(None)))
    ) or 0
    latest_backup_created_at = await db.scalar(select(func.max(Backup.created_at)))
    survey_stats = await get_survey_completion_stats(db)
    survey_overall = survey_stats.get("overall", {}) if isinstance(survey_stats, dict) else {}

    invite_acceptance_rate = round((invites_accepted / invites_total) * 100, 1) if invites_total else 0.0

    payload = {
        "users": {
            "total": int(total_users),
            "active": int(active_users),
            "locked": int(locked_users),
            "new_week": int(new_users_week),
            "new_month": int(new_users_month),
        },
        "invites": {
            "total": int(invites_total),
            "accepted": int(invites_accepted),
            "pending": int(invites_pending),
            "expired_or_revoked": int(invites_expired),
            "acceptance_rate": invite_acceptance_rate,
        },
        "backup": {
            "latest_created_at": latest_backup_created_at,
        },
        "security": {
            "failed_logins": int(failed_logins),
        },
        "groups": {
            "without_caretaker": int(groups_without_caretaker),
        },
        "survey": {
            "daily_completion_rate": float(survey_overall.get("daily_completion_rate", 0) or 0),
            "completed_today": int(survey_overall.get("completed_today", 0) or 0),
            "expected_today": int(survey_overall.get("expected_today", 0) or 0),
        },
    }
    _dashboard_summary_cache["payload"] = payload
    _dashboard_summary_cache["captured_at"] = now_monotonic
    return payload



@router.get("/system-stats", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_system_stats():
    """Return live server metrics for admin dashboard gauges."""
    return await _get_system_stats_payload()


@router.get("/rbac-audit", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_rbac_audit(request: Request):
    """Introspect all routes and report their permission requirements."""
    from app.core.rbac_audit import build_rbac_audit_report

    app = request.app
    flat_endpoints = build_rbac_audit_report(app)

    # Group by module prefix
    modules: dict[str, list] = {}
    for ep in flat_endpoints:
        parts = ep["path"].strip("/").split("/")
        module_key = parts[2] if len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1" else "_root"
        modules.setdefault(module_key, []).append(ep)

    summary: dict[str, int] = {}
    for ep in flat_endpoints:
        summary[ep["auth_level"]] = summary.get(ep["auth_level"], 0) + 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_endpoints": len(flat_endpoints),
        "summary": summary,
        "modules": [
            {"module": key, "prefix": f"/api/v1/{key}" if key != "_root" else "/", "endpoints": eps}
            for key, eps in sorted(modules.items())
        ],
    }
