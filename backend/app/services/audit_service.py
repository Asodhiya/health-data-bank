"""
Audit Logging Service

Writes structured audit log entries to the audit_log table.
Called by auth routes whenever a login/logout/register/invite event occurs.

Event types captured:
  LOGIN_SUCCESS              - user authenticated successfully
  LOGIN_FAILED               - wrong password or email not found
  LOGOUT                     - user explicitly logged out
  REGISTER_SUCCESS           - new account created via invite link
  PASSWORD_RESET_REQUESTED   - forgot-password flow triggered
  INVITE_SENT                - admin/caretaker sent a signup invite
"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert
from app.db.models import AuditLog


async def write_audit_log(
    db: AsyncSession,
    *,
    action: str,
    ip_address: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str = "user",
    entity_id: uuid.UUID | None = None,
    details: dict | None = None,
    commit: bool = True,
) -> None:
    """
    Insert one audit log row.

    Args:
        db:             The active async DB session.
        action:         Event name, e.g. "LOGIN_SUCCESS".
        ip_address:     Client IP extracted from the HTTP request.
        actor_user_id:  UUID of the user performing the action (None for failed
                        logins where we don't have a confirmed user).
        entity_type:    The kind of object affected (default "user").
        entity_id:      UUID of the affected object.
        details:        Any extra context stored as JSONB (email attempted, role, etc.).
        commit:         When True, persist immediately. When False, leave commit control
                        to the caller so the audit row can participate in a larger transaction.
    """
    stmt = insert(AuditLog).values(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        details=details or {},
    )
    await db.execute(stmt)
    if commit:
        await db.commit()
    else:
        await db.flush()
