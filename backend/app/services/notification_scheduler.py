from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select

from app.db.models import (
    Backup,
    CaretakerProfile,
    FormSubmission,
    GoalTemplate,
    Group,
    GroupMember,
    HealthGoal,
    ParticipantProfile,
    Role,
    User,
    UserRole,
)
from app.db.session import AsyncSessionLocal
from app.services.notification_service import (
    create_notification,
    notification_exists_recent,
)

_scheduler: AsyncIOScheduler | None = None


async def _notify_backup_overdue() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        latest_backup = await db.scalar(select(func.max(Backup.created_at)))
        overdue = not latest_backup or latest_backup < (now - timedelta(days=7))
        if not overdue:
            return

        rows = await db.execute(
            select(User.user_id)
            .join(UserRole, UserRole.user_id == User.user_id)
            .join(Role, Role.role_id == UserRole.role_id)
            .where(Role.role_name == "admin")
        )
        for (admin_id,) in rows.all():
            exists = await notification_exists_recent(
                db,
                user_id=admin_id,
                notification_type="flag",
                source_type="backup_overdue",
                source_id=None,
                within_hours=24,
            )
            if exists:
                continue
            await create_notification(
                db=db,
                user_id=admin_id,
                notification_type="flag",
                title="Backup overdue",
                message="No fresh backup found in the last 7 days.",
                link="/backup",
                role_target="admin",
                source_type="backup_overdue",
            )
        await db.commit()


async def _notify_goal_deadlines() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        soon = now + timedelta(days=3)

        rows = await db.execute(
            select(
                HealthGoal.goal_id,
                ParticipantProfile.user_id,
                GoalTemplate.name,
                HealthGoal.end_date,
            )
            .join(ParticipantProfile, ParticipantProfile.participant_id == HealthGoal.participant_id)
            .outerjoin(GoalTemplate, GoalTemplate.template_id == HealthGoal.template_id)
            .where(HealthGoal.status == "active")
            .where(HealthGoal.end_date.is_not(None))
            .where(HealthGoal.end_date >= now)
            .where(HealthGoal.end_date <= soon)
        )
        for goal_id, user_id, goal_name, end_date in rows.all():
            exists = await notification_exists_recent(
                db,
                user_id=user_id,
                notification_type="goal",
                source_type="goal_deadline",
                source_id=goal_id,
                within_hours=24,
            )
            if exists:
                continue
            due_label = end_date.date().isoformat() if end_date else "soon"
            await create_notification(
                db=db,
                user_id=user_id,
                notification_type="goal",
                title="Goal deadline approaching",
                message=f"Your goal '{goal_name or 'Health goal'}' is due on {due_label}.",
                link="/participant/healthgoals",
                role_target="participant",
                source_type="goal_deadline",
                source_id=goal_id,
            )
        await db.commit()


async def _notify_inactivity() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        threshold = now - timedelta(days=7)

        last_sub_sq = (
            select(
                FormSubmission.participant_id.label("participant_id"),
                func.max(FormSubmission.submitted_at).label("last_submitted_at"),
            )
            .where(FormSubmission.submitted_at.is_not(None))
            .group_by(FormSubmission.participant_id)
            .subquery()
        )

        rows = await db.execute(
            select(
                ParticipantProfile.participant_id,
                ParticipantProfile.user_id,
                last_sub_sq.c.last_submitted_at,
                Group.caretaker_id,
            )
            .outerjoin(last_sub_sq, last_sub_sq.c.participant_id == ParticipantProfile.participant_id)
            .outerjoin(
                GroupMember,
                (GroupMember.participant_id == ParticipantProfile.participant_id)
                & (GroupMember.left_at.is_(None)),
            )
            .outerjoin(Group, Group.group_id == GroupMember.group_id)
        )

        for participant_id, participant_user_id, last_submitted_at, caretaker_id in rows.all():
            inactive = (last_submitted_at is None) or (last_submitted_at < threshold)
            if not inactive:
                continue

            exists_participant = await notification_exists_recent(
                db,
                user_id=participant_user_id,
                notification_type="inactivity",
                source_type="participant_inactivity",
                source_id=participant_id,
                within_hours=24,
            )
            if not exists_participant:
                await create_notification(
                    db=db,
                    user_id=participant_user_id,
                    notification_type="inactivity",
                    title="We miss your updates",
                    message="You have not submitted a survey in the last 7 days.",
                    link="/participant/survey",
                    role_target="participant",
                    source_type="participant_inactivity",
                    source_id=participant_id,
                )

            if caretaker_id:
                caretaker_user_id = await db.scalar(
                    select(CaretakerProfile.user_id).where(CaretakerProfile.caretaker_id == caretaker_id)
                )
                if caretaker_user_id:
                    exists_caretaker = await notification_exists_recent(
                        db,
                        user_id=caretaker_user_id,
                        notification_type="inactivity",
                        source_type="participant_inactivity",
                        source_id=participant_id,
                        within_hours=24,
                    )
                    if not exists_caretaker:
                        await create_notification(
                            db=db,
                            user_id=caretaker_user_id,
                            notification_type="inactivity",
                            title="Participant inactivity detected",
                            message="A participant in your group has not submitted in 7+ days.",
                            link="/caretaker/participants",
                            role_target="caretaker",
                            source_type="participant_inactivity",
                            source_id=participant_id,
                        )

        await db.commit()


def start_notification_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_notify_inactivity, "cron", hour=2, minute=10, id="notify_inactivity", replace_existing=True)
    _scheduler.add_job(_notify_goal_deadlines, "cron", hour=2, minute=20, id="notify_goal_deadlines", replace_existing=True)
    _scheduler.add_job(_notify_backup_overdue, "cron", hour=2, minute=30, id="notify_backup_overdue", replace_existing=True)
    _scheduler.start()


def stop_notification_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None

