from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import Response
from app.schemas.schemas import Role_schema, Permissions_schema, Role_user_link, Link_role_permission_schema
from app.schemas.admin_schema import AssignCaretakerRequest, AssignCaretakerResponse, UnassignCaretakerResponse, CaretakerItem, DeleteGroupResponse, RestoreResponse, AdminProfileUpdate, AdminProfileOut, UserListItem, AdminUserUpdate, UserStatusUpdate, UserReactivateRequest, UserDeleteRequest, MoveParticipantRequest, InviteListItem, BackupListItem
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem, GroupUpdateRequest
from app.schemas.notification_schema import NotificationItem
from app.services.role_service import addroles, viewroles, add_permissions, link_user_roles, link_role_permisson
from app.services.admin_service import assign_caretaker_to_group, unassign_caretaker_from_group, create_group, delete_group, update_group, move_participant_group, list_groups, list_caretakers, backup_database, restore_database, list_users, update_user, update_user_status, reactivate_user_access, delete_user, list_invites, revoke_invite, list_backups, delete_backup, get_user_submissions, get_user_goals, get_onboarding_stats, get_survey_completion_stats
from typing import List
from app.db.session import get_db
from app.db.models import Role, AuditLog, User, AdminProfile
from app.core.dependency import require_permissions, check_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from app.core.permissions import ROLE_READ_ALL, GROUP_READ, GROUP_WRITE, GROUP_DELETE, CARETAKER_READ, CARETAKER_ASSIGN, BACKUP_CREATE, USER_READ, USER_WRITE, USER_DELETE
from uuid import UUID
from app.services.notification_service import (
    list_notifications_for_user,
    mark_notification_read_for_user,
)

router = APIRouter()


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

@router.get("/audit-logs", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_audit_logs(
    limit: int = Query(default=20, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    action: Optional[str] = Query(default=None, description="Filter by action e.g. LOGIN_FAILED"),
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
    stmt = (
        select(AuditLog, User.first_name, User.last_name, User.email)
        .outerjoin(User, User.user_id == AuditLog.actor_user_id)
        .order_by(desc(AuditLog.created_at))
    )

    if action:
        stmt = stmt.where(AuditLog.action == action.upper())

    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    # Total count for pagination metadata
    count_stmt = select(func.count()).select_from(AuditLog)
    if action:
        count_stmt = count_stmt.where(AuditLog.action == action.upper())
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
    
    
    
# ── admin-only Assign Caretaker endpoints made by Job (SPRINT 6)  ────────────────────────────────────────────

@router.get("/groups", response_model=List[GroupItem], dependencies=[Depends(require_permissions(GROUP_READ))])
async def list_groups_endpoint(db: AsyncSession = Depends(get_db)):
    return await list_groups(db)


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

@router.get("/backup")
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

@router.post("/restore", response_model=RestoreResponse)
async def restore_endpoint(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(BACKUP_CREATE)),
):
    """Upload a backup JSON file to wipe and restore the database."""
    raw_content = await file.read()
    return await restore_database(raw_content, db, restored_by=current_user.user_id)


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


@router.patch("/users/{user_id}", dependencies=[Depends(require_permissions(USER_WRITE))])
async def patch_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await update_user(user_id, payload, db)


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
async def get_invites(db: AsyncSession = Depends(get_db)):
    return await list_invites(db)


@router.delete("/invites/{invite_id}", dependencies=[Depends(require_permissions(USER_WRITE))])
async def delete_invite(invite_id: UUID, db: AsyncSession = Depends(get_db)):
    return await revoke_invite(invite_id, db)


# ── Backup History ───────────────────────────────────────────────────────────

@router.get("/backups", response_model=list[BackupListItem], dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def get_backups(db: AsyncSession = Depends(get_db)):
    return await list_backups(db)


@router.delete("/backups/{backup_id}", dependencies=[Depends(require_permissions(BACKUP_CREATE))])
async def remove_backup(backup_id: UUID, db: AsyncSession = Depends(get_db)):
    return await delete_backup(backup_id, db)


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationItem], dependencies=[Depends(require_permissions(USER_READ))])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    rows = await list_notifications_for_user(db, current_user.user_id)
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

@router.get("/stats/onboarding", dependencies=[Depends(require_permissions(USER_READ))])
async def get_onboarding_stats_endpoint(db: AsyncSession = Depends(get_db)):
    return await get_onboarding_stats(db)


@router.get("/stats/surveys", dependencies=[Depends(require_permissions(USER_READ))])
async def get_survey_stats_endpoint(db: AsyncSession = Depends(get_db)):
    return await get_survey_completion_stats(db)



@router.get("/system-stats", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def get_system_stats():
    """Return live server metrics for admin dashboard gauges."""
    import psutil, time, platform

    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    days, remainder = divmod(int(uptime_seconds), 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)

    cpu_percent = psutil.cpu_percent(interval=0.5)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
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
