from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import func, select
from sqlalchemy.exc import ProgrammingError
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.dependency import set_rls_context
from app.db.models import (
    Backup,
    BackupScheduleSettings,
    CaretakerProfile,
    FormDeployment,
    FormSubmission,
    GoalTemplate,
    Group,
    GroupMember,
    HealthGoal,
    ParticipantProfile,
    Role,
    SurveyForm,
    User,
    UserRole,
)
from app.db.session import AsyncSessionLocal
from app.services.admin_service import backup_database, prune_old_backups
from app.services.notification_service import (
    create_notification,
    notification_exists_recent,
)
from app.services.survey_cadence import get_cycle_key, get_cycle_label, normalize_cadence

_scheduler: AsyncIOScheduler | None = None

_WEEKDAY_TO_CRON = {
    "sunday": "sun",
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
}

_WEEKDAY_TO_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _get_default_backup_schedule():
    return {
        "enabled": settings.SCHEDULED_BACKUPS_ENABLED,
        "frequency": "daily",
        "time_local": f"{settings.SCHEDULED_BACKUP_HOUR_UTC:02d}:{settings.SCHEDULED_BACKUP_MINUTE_UTC:02d}",
        "day_of_week": "sunday",
        "day_of_month": None,
        "timezone": "UTC",
        "scope": "full",
        "retention_count": 5,
        "notify_on_success": True,
        "notify_on_failure": True,
        "anchor_at_utc": None,
    }


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def _load_backup_schedule(db) -> BackupScheduleSettings | dict | None:
    try:
        schedule = await db.scalar(select(BackupScheduleSettings).limit(1))
    except ProgrammingError:
        await db.rollback()
        return _get_default_backup_schedule()
    if schedule is not None:
        return schedule
    return _get_default_backup_schedule()


def _get_schedule_attr(schedule, field: str):
    if isinstance(schedule, dict):
        return schedule.get(field)
    return getattr(schedule, field)


def _compute_next_biweekly_anchor(
    *,
    timezone_name: str,
    day_of_week: str,
    time_local: str,
    now_utc: datetime | None = None,
) -> datetime:
    now_utc = now_utc or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(ZoneInfo(timezone_name))
    hour, minute = (int(part) for part in time_local.split(":"))
    target_weekday = _WEEKDAY_TO_INDEX[day_of_week]
    days_ahead = (target_weekday - local_now.weekday()) % 7
    candidate = (local_now + timedelta(days=days_ahead)).replace(
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0,
    )
    if candidate <= local_now:
        candidate += timedelta(days=7)
    return candidate.astimezone(timezone.utc)


def _build_backup_trigger(schedule) -> CronTrigger | IntervalTrigger | None:
    if not _get_schedule_attr(schedule, "enabled"):
        return None

    timezone_name = _get_schedule_attr(schedule, "timezone") or "UTC"
    time_local = _get_schedule_attr(schedule, "time_local")
    hour, minute = (int(part) for part in time_local.split(":"))
    frequency = _get_schedule_attr(schedule, "frequency")

    if frequency == "daily":
        return CronTrigger(hour=hour, minute=minute, timezone=timezone_name)

    if frequency == "weekly":
        return CronTrigger(
            day_of_week=_WEEKDAY_TO_CRON[_get_schedule_attr(schedule, "day_of_week") or "sunday"],
            hour=hour,
            minute=minute,
            timezone=timezone_name,
        )

    if frequency == "monthly":
        return CronTrigger(
            day=_get_schedule_attr(schedule, "day_of_month") or 1,
            hour=hour,
            minute=minute,
            timezone=timezone_name,
        )

    if frequency == "biweekly":
        anchor_at_utc = _as_utc(_get_schedule_attr(schedule, "anchor_at_utc"))
        if anchor_at_utc is None:
            anchor_at_utc = _compute_next_biweekly_anchor(
                timezone_name=timezone_name,
                day_of_week=_get_schedule_attr(schedule, "day_of_week") or "sunday",
                time_local=time_local,
            )
        return IntervalTrigger(weeks=2, start_date=anchor_at_utc, timezone=timezone.utc)

    return None


async def _notify_admins_of_scheduled_backup(db, *, success: bool, message: str) -> None:
    rows = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
    )
    title = "Scheduled backup completed" if success else "Scheduled backup failed"
    notification_type = "success" if success else "flag"
    source_type = "scheduled_backup_success" if success else "scheduled_backup_failure"

    for (admin_id,) in rows.all():
        await create_notification(
            db=db,
            user_id=admin_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link="/admin/backup",
            role_target="admin",
            source_type=source_type,
        )


async def refresh_backup_schedule_job(schedule: BackupScheduleSettings | dict | None = None) -> None:
    global _scheduler
    if _scheduler is None:
        return

    existing_job = _scheduler.get_job("scheduled_backup")
    if existing_job is not None:
        _scheduler.remove_job("scheduled_backup")

    if schedule is None:
        async with AsyncSessionLocal() as db:
            schedule = await _load_backup_schedule(db)

    trigger = _build_backup_trigger(schedule)
    if trigger is None:
        return

    _scheduler.add_job(
        _run_scheduled_backup,
        trigger=trigger,
        id="scheduled_backup",
        replace_existing=True,
    )


async def _notify_backup_overdue() -> None:
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, role="admin")
        now = datetime.now(timezone.utc)
        latest_backup = _as_utc(await db.scalar(select(func.max(Backup.created_at))))
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


async def _run_scheduled_backup() -> None:
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, role="admin")
        schedule = await _load_backup_schedule(db)
        if not _get_schedule_attr(schedule, "enabled"):
            return

        now = datetime.now(timezone.utc)
        latest_backup = _as_utc(
            await db.scalar(
                select(func.max(Backup.created_at)).where(Backup.source == "scheduled")
            )
        )
        if latest_backup and latest_backup >= (now - timedelta(hours=23)):
            return

        try:
            _, snapshot_name = await backup_database(
                created_by=None,
                db=db,
                source="scheduled",
            )

            retention_count = int(_get_schedule_attr(schedule, "retention_count") or 0)
            if retention_count > 0:
                deleted = await prune_old_backups(retention_count, db)
                if deleted:
                    await db.commit()

            if _get_schedule_attr(schedule, "notify_on_success"):
                await _notify_admins_of_scheduled_backup(
                    db,
                    success=True,
                    message=f"Scheduled backup '{snapshot_name}' completed successfully.",
                )
                await db.commit()
        except Exception as exc:
            await db.rollback()
            if _get_schedule_attr(schedule, "notify_on_failure"):
                async with AsyncSessionLocal() as notify_db:
                    await _notify_admins_of_scheduled_backup(
                        notify_db,
                        success=False,
                        message=f"Scheduled backup failed: {exc}",
                    )
                    await notify_db.commit()


async def _notify_goal_deadlines() -> None:
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, role="admin")
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
            end_date = _as_utc(end_date)
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
        await set_rls_context(db, role="admin")
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
            last_submitted_at = _as_utc(last_submitted_at)
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


async def _notify_recurring_surveys() -> None:
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, role="admin")
        now = datetime.now(timezone.utc)
        rows = await db.execute(
            select(
                ParticipantProfile.participant_id,
                ParticipantProfile.user_id,
                SurveyForm.form_id,
                SurveyForm.title,
                FormDeployment.deployment_id,
                FormDeployment.cadence,
                FormDeployment.cadence_anchor_at,
                GroupMember.group_id,
            )
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(FormDeployment, FormDeployment.group_id == GroupMember.group_id)
            .join(SurveyForm, SurveyForm.form_id == FormDeployment.form_id)
            .where(GroupMember.left_at.is_(None))
            .where(FormDeployment.revoked_at.is_(None))
            .where(SurveyForm.status == "PUBLISHED")
        )

        # Track which (caretaker, deployment, cycle_key) combos we've already notified
        # to avoid duplicate caretaker notifications across participants in same group
        notified_caretaker_cycles: set = set()

        seen_pairs = set()
        for participant_id, user_id, form_id, form_title, deployment_id, cadence, cadence_anchor_at, group_id in rows.all():
            normalized_cadence = normalize_cadence(cadence)
            if normalized_cadence == "once":
                continue

            key = (participant_id, deployment_id)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)

            anchor = _as_utc(cadence_anchor_at) or now
            cycle_key = get_cycle_key(normalized_cadence, now, anchor)
            cycle_label = get_cycle_label(normalized_cadence).lower()

            completed_submission = await db.scalar(
                select(FormSubmission.submission_id)
                .where(FormSubmission.participant_id == participant_id)
                .where(FormSubmission.form_id == form_id)
                .where(FormSubmission.cycle_key == cycle_key)
                .where(FormSubmission.submitted_at.is_not(None))
                .limit(1)
            )
            if completed_submission:
                continue

            # Notify participant
            reminder_source_type = f"survey_cycle_reminder:{cycle_key}"
            exists = await notification_exists_recent(
                db,
                user_id=user_id,
                notification_type="submission",
                source_type=reminder_source_type,
                source_id=deployment_id,
                within_hours=24 * 90,
            )
            if not exists:
                await create_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="submission",
                    title="Survey check-in available",
                    message=f"Your {cycle_label} survey '{form_title}' is ready to complete.",
                    link="/participant/survey",
                    role_target="participant",
                    source_type=reminder_source_type,
                    source_id=deployment_id,
                    deployment_id=deployment_id,
                )

            # Notify caretaker of this group (once per deployment+cycle, not per participant)
            caretaker_cycle_key = (group_id, deployment_id, cycle_key)
            if caretaker_cycle_key not in notified_caretaker_cycles:
                notified_caretaker_cycles.add(caretaker_cycle_key)
                caretaker_row = await db.execute(
                    select(CaretakerProfile.user_id)
                    .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
                    .where(Group.group_id == group_id)
                )
                caretaker_user_id = caretaker_row.scalar_one_or_none()
                if caretaker_user_id:
                    caretaker_source_type = f"survey_cycle_caretaker:{cycle_key}"
                    ct_exists = await notification_exists_recent(
                        db,
                        user_id=caretaker_user_id,
                        notification_type="summary",
                        source_type=caretaker_source_type,
                        source_id=deployment_id,
                        within_hours=24 * 90,
                    )
                    if not ct_exists:
                        await create_notification(
                            db=db,
                            user_id=caretaker_user_id,
                            notification_type="summary",
                            title="New survey cycle started",
                            message=f"A new {cycle_label} cycle for '{form_title}' is now available for your group.",
                            link="/caretaker/reports",
                            role_target="caretaker",
                            source_type=caretaker_source_type,
                            source_id=deployment_id,
                            deployment_id=deployment_id,
                        )

        await db.commit()


async def start_notification_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_notify_recurring_surveys, "cron", hour=2, minute=5, id="notify_recurring_surveys", replace_existing=True)
    _scheduler.add_job(_notify_inactivity, "cron", hour=2, minute=10, id="notify_inactivity", replace_existing=True)
    _scheduler.add_job(_notify_goal_deadlines, "cron", hour=2, minute=20, id="notify_goal_deadlines", replace_existing=True)
    _scheduler.add_job(_notify_backup_overdue, "cron", hour=2, minute=30, id="notify_backup_overdue", replace_existing=True)
    await refresh_backup_schedule_job()
    _scheduler.start()


def stop_notification_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
