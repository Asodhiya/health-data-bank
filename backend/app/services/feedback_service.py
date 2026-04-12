from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Role, SystemFeedback, UserRole
from app.schemas.schemas import (
    SystemFeedbackCreate,
    SystemFeedbackStatusUpdate,
)
from app.services.audit_service import write_audit_log
from app.services.notification_service import create_notifications_bulk

ISSUE_CATEGORIES = {"bug", "issue", "support", "account", "performance"}


async def _get_admin_user_ids(db: AsyncSession) -> list[UUID]:
    result = await db.execute(
        select(UserRole.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
    )
    return [row[0] for row in result.all()]


async def submit_system_feedback(
    payload: SystemFeedbackCreate,
    user_id: UUID,
    db: AsyncSession,
) -> SystemFeedback:
    is_issue = payload.category in ISSUE_CATEGORIES
    feedback = SystemFeedback(
        user_id=user_id,
        category=payload.category,
        subject=payload.subject,
        message=payload.message,
        page_path=payload.page_path,
        status="new",
    )
    db.add(feedback)
    await db.flush()

    admin_ids = await _get_admin_user_ids(db)
    if admin_ids:
        title = "New issue reported" if is_issue else "New system feedback"
        message = payload.subject or payload.message[:120]
        await create_notifications_bulk(
            db,
            user_ids=admin_ids,
            notification_type="feedback",
            title=title,
            message=message,
            role_target="admin",
            source_type="system_feedback",
            source_id=feedback.feedback_id,
            link="/admin/messages",
        )

    await write_audit_log(
        db,
        action="SYSTEM_ISSUE_REPORTED" if is_issue else "SYSTEM_FEEDBACK_SUBMITTED",
        actor_user_id=user_id,
        entity_type="system_feedback",
        entity_id=feedback.feedback_id,
        details={
            "category": feedback.category,
            "subject": feedback.subject,
            "page_path": feedback.page_path,
        },
        commit=False,
    )
    await db.commit()
    await db.refresh(feedback)
    return feedback


async def list_my_feedback(user_id: UUID, db: AsyncSession) -> list[SystemFeedback]:
    result = await db.execute(
        select(SystemFeedback)
        .where(SystemFeedback.user_id == user_id)
        .order_by(desc(SystemFeedback.created_at))
    )
    return result.scalars().all()


async def list_system_feedback(db: AsyncSession) -> list[SystemFeedback]:
    result = await db.execute(
        select(SystemFeedback).order_by(desc(SystemFeedback.created_at))
    )
    return result.scalars().all()


async def update_system_feedback_status(
    feedback_id: UUID,
    payload: SystemFeedbackStatusUpdate,
    actor_user_id: UUID,
    db: AsyncSession,
) -> SystemFeedback:
    feedback = await db.scalar(
        select(SystemFeedback).where(SystemFeedback.feedback_id == feedback_id)
    )
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback.status = payload.status
    if payload.status == "new":
        feedback.reviewed_at = None
        feedback.reviewed_by = None
    else:
        from datetime import datetime, timezone

        feedback.reviewed_at = datetime.now(timezone.utc)
        feedback.reviewed_by = actor_user_id

    await write_audit_log(
        db,
        action="SYSTEM_FEEDBACK_STATUS_UPDATED",
        actor_user_id=actor_user_id,
        entity_type="system_feedback",
        entity_id=feedback.feedback_id,
        details={"status": feedback.status, "category": feedback.category},
        commit=False,
    )
    await db.commit()
    await db.refresh(feedback)
    return feedback
