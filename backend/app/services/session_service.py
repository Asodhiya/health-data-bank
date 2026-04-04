import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Session


SESSION_IDLE_TIMEOUT_MINUTES = int(os.getenv("SESSION_IDLE_TIMEOUT_MINUTES", "30"))
SESSION_TOKEN_EXPIRE_MINUTES = int(os.getenv("SESSION_TOKEN_EXPIRE_MINUTES", "10080"))


def get_session_idle_timeout_minutes() -> int:
    return SESSION_IDLE_TIMEOUT_MINUTES


def get_session_token_expiry_minutes() -> int:
    return SESSION_TOKEN_EXPIRE_MINUTES


async def create_user_session(
    user_id: UUID,
    db: AsyncSession,
    *,
    device_id: UUID | None = None,
) -> Session:
    """Create a DB-backed session whose expiry slides with activity."""
    now = datetime.now(timezone.utc)
    session = Session(
        user_id=user_id,
        device_id=device_id,
        expired_at=now + timedelta(minutes=get_session_idle_timeout_minutes()),
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_active_session(session_id: UUID, db: AsyncSession) -> Session | None:
    result = await db.execute(
        select(Session).where(Session.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    if session.expired_at <= datetime.now(timezone.utc):
        return None
    return session


async def touch_session(session: Session, db: AsyncSession) -> Session:
    session.expired_at = datetime.now(timezone.utc) + timedelta(
        minutes=get_session_idle_timeout_minutes()
    )
    await db.flush()
    return session


async def revoke_session(session_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(select(Session).where(Session.session_id == session_id))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.flush()
