from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import Response
from app.schemas.schemas import Role_schema, Permissions_schema, Role_user_link, Link_role_permission_schema
from app.schemas.admin_schema import AssignCaretakerRequest, AssignCaretakerResponse, UnassignCaretakerResponse, CaretakerItem, DeleteGroupResponse, RestoreResponse
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem
from app.services.role_service import addroles, viewroles, add_permissions, link_user_roles, link_role_permisson
from app.services.admin_service import assign_caretaker_to_group, unassign_caretaker_from_group, create_group, delete_group, list_groups, list_caretakers, backup_database, restore_database
from typing import List
from app.db.session import get_db
from app.db.models import Role, AuditLog, User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.core.dependency import require_permissions
from typing import Optional
from app.core.permissions import ROLE_READ_ALL, GROUP_READ, GROUP_WRITE, GROUP_DELETE, CARETAKER_READ, CARETAKER_ASSIGN, BACKUP_CREATE
from uuid import UUID

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
):
    """Upload a backup JSON file to wipe and restore the database."""
    raw_content = await file.read()
    return await restore_database(raw_content, db)
