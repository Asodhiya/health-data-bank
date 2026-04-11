from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification


async def _ensure_notification_rls_context(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
) -> None:
    current_result = await db.execute(
        text(
            """
            SELECT
              nullif(current_setting('app.current_user_id', true), ''),
              nullif(current_setting('app.current_user_role', true), '')
            """
        )
    )
    current_user_id, current_role = current_result.one()

    if not current_user_id and user_id is not None:
        await db.execute(
            text("SELECT set_config('app.current_user_id', :uid, TRUE)"),
            {"uid": str(user_id)},
        )

    # Internal jobs and unauthenticated auth/rate-limit flows still need to create
    # and dedupe notifications safely after notifications RLS is enabled.
    if not current_role:
        await db.execute(
            text("SELECT set_config('app.current_user_role', 'admin', TRUE)")
        )


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: str,
    *,
    link: Optional[str] = None,
    role_target: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
    deployment_id: Optional[UUID] = None,
) -> Notification:
    await _ensure_notification_rls_context(db, user_id=user_id)
    row = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
        role_target=role_target,
        source_type=source_type,
        source_id=source_id,
        deployment_id=deployment_id,
        status="unread",
    )
    db.add(row)
    await db.flush()
    return row


async def create_notifications_bulk(
    db: AsyncSession,
    user_ids: Iterable[UUID],
    notification_type: str,
    title: str,
    message: str,
    *,
    link: Optional[str] = None,
    role_target: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
    deployment_id: Optional[UUID] = None,
) -> None:
    for user_id in user_ids:
        await create_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            role_target=role_target,
            source_type=source_type,
            source_id=source_id,
            deployment_id=deployment_id,
        )


async def list_notifications_for_user(
    db: AsyncSession,
    user_id: UUID,
    *,
    limit: int = 100,
    role_target: Optional[str] = None,
) -> list[Notification]:
    await _ensure_notification_rls_context(db, user_id=user_id)
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if role_target:
        # Keep legacy notifications (NULL role_target) visible while enforcing role-specific rows.
        stmt = stmt.where(
            (Notification.role_target.is_(None)) | (Notification.role_target == role_target)
        )
    result = await db.execute(
        stmt
    )
    return result.scalars().all()


async def mark_notification_read_for_user(
    db: AsyncSession,
    notification_id: UUID,
    user_id: UUID,
) -> Notification:
    await _ensure_notification_rls_context(db, user_id=user_id)
    result = await db.execute(
        select(Notification).where(
            Notification.notification_id == notification_id,
            Notification.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.status = "read"
    row.read_at = datetime.now(timezone.utc)
    await db.flush()
    return row


async def notification_exists_recent(
    db: AsyncSession,
    *,
    user_id: UUID,
    notification_type: str,
    source_type: Optional[str],
    source_id: Optional[UUID],
    within_hours: int,
) -> bool:
    await _ensure_notification_rls_context(db, user_id=user_id)
    since = datetime.now(timezone.utc) - timedelta(hours=within_hours)
    stmt = (
        select(Notification.notification_id)
        .where(Notification.user_id == user_id)
        .where(Notification.type == notification_type)
        .where(Notification.created_at >= since)
    )
    if source_type is None:
        stmt = stmt.where(Notification.source_type.is_(None))
    else:
        stmt = stmt.where(Notification.source_type == source_type)
    if source_id is None:
        stmt = stmt.where(Notification.source_id.is_(None))
    else:
        stmt = stmt.where(Notification.source_id == source_id)
    result = await db.execute(stmt.limit(1))
    return result.scalar_one_or_none() is not None

