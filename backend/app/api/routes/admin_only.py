from fastapi import APIRouter, Depends, Query
from app.schemas.schemas import Role_schema, Permissions_schema, Role_user_link, Link_role_permission_schema
from app.services.role_service import addroles, viewroles, add_permissions, link_user_roles, link_role_permisson
from app.db.session import get_db
from app.db.models import Role, AuditLog, User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.core.dependency import require_permissions
from typing import Optional
from app.core.permissions import ROLE_READ_ALL

router = APIRouter()


# ── Existing role/permission endpoints ──────────────────────────────────────

@router.post("/add_roles")
async def add_roles(Payload: Role_schema, db: AsyncSession = Depends(get_db)):
    role = await addroles(Payload, db)
    return role


@router.get("/view_roles", dependencies=[Depends(require_permissions(ROLE_READ_ALL))])
async def view_roles(db: AsyncSession = Depends(get_db)):
    roles = await viewroles(db)
    return roles


@router.post("/post_permission")
async def post_permission(Payload: Permissions_schema, db: AsyncSession = Depends(get_db)):
    user_role = await add_permissions(Payload, db)
    return user_role


@router.post("/linkrole")
async def give_role(Payload: Role_user_link, db: AsyncSession = Depends(get_db)):
    userrole = await link_user_roles(Payload, db)
    return userrole


@router.post("/linkpermission")
async def role_permission(Payload: Link_role_permission_schema, db: AsyncSession = Depends(get_db)):
    role_perm = await link_role_permisson(Payload, db)
    return role_perm


# ── Audit / Activity Log endpoint ────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(default=20, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    action: Optional[str] = Query(default=None, description="Filter by action e.g. LOGIN_FAILED"),
    db: AsyncSession = Depends(get_db),
    # Uncomment once 'audit:read' permission is seeded in the DB:
    # _: None = Depends(require_permissions("audit:read")),
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