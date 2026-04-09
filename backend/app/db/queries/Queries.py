from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, case, and_, or_, desc
from sqlalchemy import Date as SADate
from app.db.models import Role, User, UserRole, Permission, ParticipantProfile, CaretakerProfile, ResearcherProfile, SignupInvite, HealthGoal, GoalTemplate, DataElement, FieldElementMap, HealthDataPoint, FormDeployment, GroupMember, FormSubmission, Group, SurveyForm, CaretakerFeedback, Notification, Report, SubmissionAnswer
from fastapi import HTTPException, status
import uuid
from sqlalchemy.exc import IntegrityError
from app.schemas.schemas import HealthGoalUpdate, GoalTemplateCreate, GoalTemplateUpdate, GoalProgressLog
from app.schemas.data_element_schema import DataElementCreate
from app.services.participant_survey_service import _get_deployed_forms
from datetime import date, datetime, timezone, timedelta, time
from app.db.models import FormField
from types import SimpleNamespace


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _utc_day_bounds(target_date: date | None = None) -> tuple[datetime, datetime]:
    current_date = target_date or _utc_today()
    start = datetime.combine(current_date, time.min).replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end

def get_participant_id(current_user: User) -> uuid.UUID:
    """
    Extract participant_id from the authenticated user's loaded profile.

    Raises 403 if the user does not have a participant profile.
    """
    if not current_user.participant_profile:
        raise HTTPException(status_code=403, detail="Not a participant")
    return current_user.participant_profile.participant_id


class UserQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user(self, username: str):
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_user_roles(self, user_id: uuid.UUID) -> list[str]:
        result = await self.db.execute(
            select(Role.role_name)
            .join(UserRole, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == user_id)
        )
        return [row[0].lower() for row in result.fetchall()]


class RoleQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_role(self, role_name: str):
        result = await self.db.execute(
            select(Role).where(Role.role_name == role_name)
        )
        return result.scalar_one_or_none()

    async def get_role_by_id(self, role_id: uuid.UUID):
        result = await self.db.execute(
            select(Role).where(Role.role_id == role_id)
        )
        return result.scalar_one_or_none()

    async def put_role(self, user_id: uuid.UUID, role_name: str):
        ROLE_TO_PROFILE_MODEL = {
            "participant": ParticipantProfile,
            "researcher": ResearcherProfile,
            "caretaker": CaretakerProfile,
        }
        profile_model = ROLE_TO_PROFILE_MODEL.get(role_name.lower())
        if profile_model:
            profile = profile_model(user_id=user_id)
            self.db.add(profile)

        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="User-profile role already exists")

    async def assign_role_to_user(self, user_record, role_record):
        existing = await self.db.execute(
            select(UserRole).where(UserRole.user_id == user_record.user_id).limit(1)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="User already has a role. A user can only have one role.")

        user_role = UserRole(
            user_id=user_record.user_id,
            role_id=role_record.role_id
        )
        self.db.add(user_role)

        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="User role already exists")

        await self.db.refresh(user_role)
        return {"detail": "role successfully given"}

    async def get_permission(self, code: str):
        result = await self.db.execute(
            select(Permission).where(Permission.code == code)
        )
        return result.scalar_one_or_none()


class InviteQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_invite_by_token_hash(self, token_hash: str):
        result = await self.db.execute(
            select(SignupInvite).where(SignupInvite.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

class ParticipantQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _normalize_datatype(datatype: str | None) -> str:
        normalized = (datatype or "number").strip().lower()
        if normalized == "string":
            return "text"
        if normalized == "bool":
            return "boolean"
        if normalized in {"int", "integer", "float", "double", "decimal", "numeric"}:
            return "number"
        if normalized not in {"text", "number", "boolean"}:
            return "number"
        return normalized

    @staticmethod
    def _window_bounds(window: str | None, as_of: datetime | None = None):
        current = as_of or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)

        mode = (window or "daily").lower()
        if mode == "none":
            return None, None

        if mode == "daily":
            start = datetime.combine(current.date(), time.min).replace(tzinfo=timezone.utc)
            end = start + timedelta(days=1)
            return start, end

        if mode == "weekly":
            start_date = current.date() - timedelta(days=current.weekday())
            start = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
            end = start + timedelta(days=7)
            return start, end

        if mode == "monthly":
            month_start_date = current.date().replace(day=1)
            start = datetime.combine(month_start_date, time.min).replace(tzinfo=timezone.utc)
            if month_start_date.month == 12:
                next_month_date = month_start_date.replace(
                    year=month_start_date.year + 1, month=1
                )
            else:
                next_month_date = month_start_date.replace(month=month_start_date.month + 1)
            end = datetime.combine(next_month_date, time.min).replace(tzinfo=timezone.utc)
            return start, end

        # Safe fallback.
        start = datetime.combine(current.date(), time.min).replace(tzinfo=timezone.utc)
        return start, start + timedelta(days=1)

    @staticmethod
    def _is_numeric_datatype(datatype: str | None) -> bool:
        return ParticipantQuery._normalize_datatype(datatype) != "text"

    @staticmethod
    def _goal_completed(goal: HealthGoal, current_value) -> bool:
        if goal.target_value is None or not isinstance(current_value, (int, float)):
            return False

        target = float(goal.target_value)
        direction = (goal.direction or "at_least").lower()
        if direction == "at_most":
            return current_value <= target
        return current_value >= target

    async def _compute_goal_current_value(
        self,
        goal: HealthGoal,
        datatype: str | None,
        participant_id: uuid.UUID,
        as_of: datetime | None = None,
    ):
        start, end = self._window_bounds(goal.window, as_of)

        points_stmt = (
            select(
                HealthDataPoint.value_number.label("value_number"),
                HealthDataPoint.value_text.label("value_text"),
                HealthDataPoint.observed_at.label("observed_at"),
            )
            .where(HealthDataPoint.participant_id == participant_id)
            .where(HealthDataPoint.element_id == goal.element_id)
            .where(HealthDataPoint.source_type == "goal")
        )
        if start is not None:
            points_stmt = points_stmt.where(HealthDataPoint.observed_at >= start)
        if end is not None:
            points_stmt = points_stmt.where(HealthDataPoint.observed_at < end)
        points_sq = points_stmt.subquery()

        progress_mode = (goal.progress_mode or "incremental").lower()
        numeric = self._is_numeric_datatype(datatype)

        if progress_mode == "incremental" and numeric:
            total_result = await self.db.execute(
                select(
                    func.count(points_sq.c.value_number).label("n"),
                    func.coalesce(func.sum(points_sq.c.value_number), 0).label("s"),
                )
            )
            row = total_result.one_or_none()
            if not row or row.n == 0:
                return None
            return float(row.s or 0)

        latest_result = await self.db.execute(
            select(points_sq.c.value_number, points_sq.c.value_text)
            .order_by(points_sq.c.observed_at.desc())
            .limit(1)
        )
        latest = latest_result.one_or_none()
        if not latest:
            return None

        value_number, value_text = latest
        if value_number is not None:
            return float(value_number)
        return value_text

    async def _serialize_goal(
        self,
        goal: HealthGoal,
        element: DataElement,
        participant_id: uuid.UUID,
        as_of: datetime | None = None,
    ):
        current_value = await self._compute_goal_current_value(
            goal,
            element.datatype,
            participant_id,
            as_of=as_of,
        )
        is_completed = self._goal_completed(goal, current_value)
        window_start, window_end = self._window_bounds(goal.window, as_of)

        return {
            **goal.__dict__,
            "name": element.label,
            "element": element,
            "current_value": current_value,
            "is_completed": bool(is_completed),
            "completion_context": {
                "window": goal.window or "daily",
                "progress_mode": goal.progress_mode or "incremental",
                "direction": goal.direction or "at_least",
                "window_start": window_start.isoformat() if window_start else None,
                "window_end": window_end.isoformat() if window_end else None,
            },
        }

        
    async def get_goals(self, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(HealthGoal, DataElement)
            .join(DataElement, DataElement.element_id == HealthGoal.element_id)
            .where(HealthGoal.participant_id == participant_id)
        )
        rows = result.all()
        goals = [
            await self._serialize_goal(goal, element, participant_id)
            for goal, element in rows
        ]
        return goals

    async def get_goal(self, goal_id: uuid.UUID, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(HealthGoal, DataElement)
            .join(DataElement, DataElement.element_id == HealthGoal.element_id)
            .where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        row = result.one_or_none()
        if not row:
            return None
        goal, element = row
        return await self._serialize_goal(goal, element, participant_id)

    async def add_goal_from_template(
        self,
        participant_id: uuid.UUID,
        template_id: uuid.UUID,
        target_value: float | None = None,
        window: str | None = None,
    ):
        participants_goal = await self.get_goals(participant_id)
        if len(participants_goal) >= 10:
            raise HTTPException(status_code=400, detail="Maximum 10 goals allowed")
        template = await self.db.get(GoalTemplate, template_id)
        if not template or not template.is_active:
            raise HTTPException(status_code=404, detail="Goal template not found")
        existing_goal_for_element = await self.db.execute(
            select(HealthGoal.goal_id)
            .where(HealthGoal.participant_id == participant_id)
            .where(HealthGoal.element_id == template.element_id)
            .limit(1)
        )
        if existing_goal_for_element.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="A goal for this metric already exists.",
            )

        goal = HealthGoal(
            participant_id=participant_id,
            template_id=template.template_id,
            element_id=template.element_id,
            target_value=target_value if target_value is not None else template.default_target,
            progress_mode=template.progress_mode or "incremental",
            direction=template.direction or "at_least",
            window=window or "daily",
        )
        self.db.add(goal)
        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Goal already exists")
        await self.db.refresh(goal)
        return goal

    async def update_goal(self, goal_id: uuid.UUID, participant_id: uuid.UUID, update_data: HealthGoalUpdate):
        result = await self.db.execute(
            select(HealthGoal).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        for field, value in update_data.model_dump(exclude_none=True).items():
            setattr(goal, field, value)

        await self.db.flush()
        await self.db.refresh(goal)

        return goal

    async def delete_goal(self, goal_id: uuid.UUID, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(HealthGoal).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        await self.db.delete(goal)
        await self.db.flush()

    async def get_goal_progress(self, goal_id: uuid.UUID, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(HealthGoal, DataElement).join(
                DataElement, DataElement.element_id == HealthGoal.element_id
            ).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Goal not found")
        goal, element = row

        now = datetime.now(timezone.utc)
        current_value = await self._compute_goal_current_value(
            goal, element.datatype, participant_id, as_of=now
        )
        target = float(goal.target_value) if goal.target_value is not None else None
        completed = self._goal_completed(goal, current_value)
        start, end = self._window_bounds(goal.window, now)
        return {
            "goal_id": goal_id,
            "date": now.date(),
            "current_value": current_value,
            "target_value": target,
            "completed": completed,
            "completion_context": {
                "window": goal.window or "daily",
                "progress_mode": goal.progress_mode or "incremental",
                "direction": goal.direction or "at_least",
                "window_start": start.isoformat() if start else None,
                "window_end": end.isoformat() if end else None,
            },
        }

    async def log_progress(self, goal_id: uuid.UUID, participant_id: uuid.UUID, payload: GoalProgressLog):
        result = await self.db.execute(
            select(HealthGoal, DataElement.datatype).join(
                DataElement, DataElement.element_id == HealthGoal.element_id
            ).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Goal not found")
        goal, datatype = row

        legacy_value = payload.value
        numeric_value = payload.value_number
        text_value = payload.value_text
        bool_value = payload.value_bool

        if isinstance(legacy_value, bool):
            bool_value = legacy_value if bool_value is None else bool_value
        elif isinstance(legacy_value, (int, float)):
            numeric_value = float(legacy_value) if numeric_value is None else numeric_value
        elif isinstance(legacy_value, str):
            text_value = legacy_value if text_value is None else text_value

        observed_at = payload.observed_at or datetime.now(timezone.utc)
        progress_mode = (goal.progress_mode or "incremental").lower()
        if self._normalize_datatype(datatype) == "text":
            if text_value is None or str(text_value).strip() == "":
                raise HTTPException(
                    status_code=422,
                    detail="Text goals require a non-empty text value.",
                )
            text_value = str(text_value).strip()
            data_point = HealthDataPoint(
                participant_id=participant_id,
                element_id=goal.element_id,
                observed_at=observed_at,
                source_type="goal",
                value_text=text_value,
                notes=payload.notes,
            )
        else:
            delta = None
            if numeric_value is not None:
                delta = float(numeric_value)
            elif bool_value is not None:
                delta = 1.0 if bool_value else 0.0
            if delta is None:
                raise HTTPException(
                    status_code=422,
                    detail="Numeric/boolean goals require a numeric value.",
                )
            value_number = delta
            # For absolute goals, each log is the new measured value.
            # For incremental goals, each log is an additive delta.
            if progress_mode == "absolute":
                value_number = delta

            data_point = HealthDataPoint(
                participant_id=participant_id,
                element_id=goal.element_id,
                observed_at=observed_at,
                source_type="goal",
                value_number=value_number,
                notes=payload.notes,
            )

        self.db.add(data_point)
        await self.db.flush()
        await self.db.refresh(data_point)
        return data_point

    async def get_goal_logs(
        self,
        goal_id: uuid.UUID,
        participant_id: uuid.UUID,
        days: int = 7,
    ) -> dict:
        result = await self.db.execute(
            select(HealthGoal, DataElement).join(
                DataElement, DataElement.element_id == HealthGoal.element_id
            ).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id,
            )
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Goal not found")
        goal, element = row

        since = datetime.now(timezone.utc) - timedelta(days=days)
        rows = await self.db.execute(
            select(
                HealthDataPoint.data_id,
                HealthDataPoint.value_number,
                HealthDataPoint.value_text,
                HealthDataPoint.notes,
                HealthDataPoint.observed_at,
            )
            .where(HealthDataPoint.participant_id == participant_id)
            .where(HealthDataPoint.element_id == goal.element_id)
            .where(HealthDataPoint.source_type == "goal")
            .where(HealthDataPoint.observed_at >= since)
            .order_by(HealthDataPoint.observed_at.asc())
        )
        entries = []
        daily_totals: dict[str, float] = {}
        for r in rows.all():
            observed = r.observed_at
            if observed and observed.tzinfo is None:
                observed = observed.replace(tzinfo=timezone.utc)
            date_key = observed.date().isoformat() if observed else None
            value = float(r.value_number) if r.value_number is not None else r.value_text
            entries.append({
                "data_id": r.data_id,
                "value": value,
                "notes": r.notes,
                "observed_at": observed.isoformat() if observed else None,
                "date": date_key,
            })
            if date_key and isinstance(value, float):
                daily_totals[date_key] = round(daily_totals.get(date_key, 0.0) + value, 4)

        return {
            "goal_id": goal_id,
            "element": {"label": element.label, "unit": element.unit, "datatype": element.datatype},
            "window": goal.window or "daily",
            "progress_mode": goal.progress_mode or "incremental",
            "target_value": float(goal.target_value) if goal.target_value is not None else None,
            "entries": entries,
            "daily_totals": daily_totals,
        }


class GoalTemplateQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_templates(self):
        result = await self.db.execute(
            select(GoalTemplate, DataElement)
            .join(DataElement, DataElement.element_id == GoalTemplate.element_id)
            .where(GoalTemplate.is_active == True)
        )
        return [
            {**tpl.__dict__, "element": element}
            for tpl, element in result.all()
        ]

    async def create_template(self, payload: GoalTemplateCreate, created_by: uuid.UUID):
        template = GoalTemplate(**payload.model_dump(), created_by=created_by)
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def update_template(self, template_id: uuid.UUID, payload: GoalTemplateUpdate):
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")
        for field, value in payload.model_dump(exclude_none=True).items():
           setattr(template, field, value)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def list_deleted_templates(self):
        result = await self.db.execute(
            select(GoalTemplate, DataElement)
            .join(DataElement, DataElement.element_id == GoalTemplate.element_id)
            .where(GoalTemplate.is_active == False)
        )
        return [
            {**tpl.__dict__, "element": element}
            for tpl, element in result.all()
        ]

    async def delete_template(self, template_id: uuid.UUID):
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")

        # Hard delete if no participants have ever adopted this template
        has_goals = await self.db.scalar(
            select(HealthGoal.goal_id).where(HealthGoal.template_id == template_id).limit(1)
        )
        if has_goals:
            template.is_active = False
            await self.db.commit()
            return {"deleted": False, "msg": "Template deactivated"}
        else:
            await self.db.delete(template)
            await self.db.commit()
            return {"deleted": True, "msg": "Template permanently deleted"}

    async def restore_template(self, template_id: uuid.UUID):
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")
        if template.is_active:
            raise HTTPException(status_code=400, detail="Template is already active")
        template.is_active = True
        await self.db.commit()
        return {"msg": "Template restored"}

    async def get_template_stats(self, template_id: uuid.UUID, granularity: str = "month"):
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")

        element_id = template.element_id
        default_target = float(template.default_target) if template.default_target is not None else None

        # Participants currently tracking this template
        goals_result = await self.db.execute(
            select(HealthGoal).where(
                HealthGoal.template_id == template_id,
                HealthGoal.status == "active",
            )
        )
        active_goals = goals_result.scalars().all()
        participants_tracking = len(active_goals)

        # Per-participant latest value for this element
        latest_subq = (
            select(
                HealthDataPoint.participant_id,
                func.max(HealthDataPoint.observed_at).label("latest_at"),
            )
            .where(HealthDataPoint.element_id == element_id)
            .group_by(HealthDataPoint.participant_id)
            .subquery()
        )
        latest_vals_result = await self.db.execute(
            select(HealthDataPoint.participant_id, HealthDataPoint.value_number)
            .join(
                latest_subq,
                and_(
                    HealthDataPoint.participant_id == latest_subq.c.participant_id,
                    HealthDataPoint.observed_at == latest_subq.c.latest_at,
                ),
            )
            .where(HealthDataPoint.element_id == element_id)
        )
        latest_vals = latest_vals_result.all()
        values = [float(r.value_number) for r in latest_vals if r.value_number is not None]

        avg_current = round(sum(values) / len(values), 2) if values else None
        completion_rate = None
        if values and default_target is not None:
            meeting = sum(1 for v in values if v >= default_target)
            completion_rate = round(meeting / len(values) * 100)

        # Time series — granularity controls bucket size and lookback window
        if granularity == "week":
            trunc = "week"
            lookback = timedelta(weeks=12)
            fmt_str = lambda d: f"W{d.isocalendar()[1]} {d.strftime('%b %Y')}"
        elif granularity == "year":
            trunc = "year"
            lookback = timedelta(days=365 * 5)
            fmt_str = lambda d: d.strftime("%Y")
        else:  # month (default)
            trunc = "month"
            lookback = timedelta(days=365)
            fmt_str = lambda d: d.strftime("%b %Y")

        since = datetime.now(timezone.utc) - lookback
        period_expr = func.date_trunc(trunc, HealthDataPoint.observed_at)
        period_result = await self.db.execute(
            select(
                period_expr.label("period"),
                func.avg(HealthDataPoint.value_number).label("avg_val"),
            )
            .where(
                HealthDataPoint.element_id == element_id,
                HealthDataPoint.observed_at >= since,
                HealthDataPoint.value_number.is_not(None),
            )
            .group_by(period_expr)
            .order_by(period_expr)
        )
        progress_over_time = [
            {"month": fmt_str(row.period), "avg": round(float(row.avg_val), 2)}
            for row in period_result.all()
        ]

        # Distribution buckets
        distribution = []
        if values and default_target is not None:
            bucket_size = default_target / 4 if default_target > 0 else 1
            buckets = {}
            for v in values:
                bucket = int(v // bucket_size) * bucket_size
                label = f"{int(bucket)}–{int(bucket + bucket_size)}"
                buckets[label] = buckets.get(label, 0) + 1
            distribution = [{"range": k, "count": v} for k, v in sorted(buckets.items())]

        return {
            "template_id": str(template_id),
            "participants_tracking": participants_tracking,
            "avg_current_value": avg_current,
            "completion_rate": completion_rate,
            "default_target": default_target,
            "progress_over_time": progress_over_time,
            "distribution": distribution,
        }

    async def get_raw_datapoints(self, template_id: uuid.UUID) -> list:
        """Return raw data points for the template's element as JSON."""
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")

        result = await self.db.execute(
            select(
                HealthDataPoint.value_number,
                HealthDataPoint.observed_at,
                HealthDataPoint.source_type,
            )
            .where(
                HealthDataPoint.element_id == template.element_id,
                HealthDataPoint.value_number.is_not(None),
            )
            .order_by(HealthDataPoint.observed_at.desc())
        )
        return [
            {
                "value": float(r.value_number),
                "observed_at": r.observed_at.strftime("%Y-%m-%d %H:%M"),
                "source": r.source_type or "",
            }
            for r in result.all()
        ]

    async def export_summary_csv(self, template_id: uuid.UUID, granularity: str = "month") -> str:
        """Return progress-over-time chart data as a CSV string."""
        stats = await self.get_template_stats(template_id, granularity)
        lines = ["Period,Avg Value"]
        for row in stats["progress_over_time"]:
            lines.append(f'{row["month"]},{row["avg"]}')
        return "\n".join(lines)

    async def export_raw_csv(self, template_id: uuid.UUID) -> str:
        """Return all individual HealthDataPoint rows for this template's element as a CSV string."""
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")

        result = await self.db.execute(
            select(
                HealthDataPoint.value_number,
                HealthDataPoint.observed_at,
                HealthDataPoint.source_type,
            )
            .where(
                HealthDataPoint.element_id == template.element_id,
                HealthDataPoint.value_number.is_not(None),
            )
            .order_by(HealthDataPoint.observed_at)
        )
        rows = result.all()
        lines = ["Value,Observed At,Source"]
        for r in rows:
            lines.append(
                f'{r.value_number},{r.observed_at.strftime("%Y-%m-%d %H:%M:%S")},{r.source_type or ""}'
            )
        return "\n".join(lines)


class DataElementQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_data_elements(self):
        result = await self.db.execute(
            select(DataElement).where(DataElement.is_active == True)
        )
        return result.scalars().all()

    async def get_data_element(self, element_id: uuid.UUID):
        result = await self.db.execute(
            select(DataElement).where(DataElement.element_id == element_id)
        )
        element = result.scalar_one_or_none()
        if not element:
            raise HTTPException(status_code=404, detail="Data element not found")
        return element

    async def add_data_element(self, payload: DataElementCreate):
        data_element = DataElement(**payload.model_dump())
        self.db.add(data_element)
        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="A data element with this code already exists")
        await self.db.refresh(data_element)
        return data_element

    async def delete_data_element(self, element_id: uuid.UUID):
        result = await self.db.execute(
            select(DataElement).where(DataElement.element_id == element_id)
        )
        element = result.scalar_one_or_none()
        if not element:
            raise HTTPException(status_code=404, detail="Data element not found")

        # Non-survey references always require soft delete to preserve data integrity
        has_goal_template = await self.db.scalar(
            select(GoalTemplate.element_id).where(GoalTemplate.element_id == element_id).limit(1)
        )
        has_health_goal = await self.db.scalar(
            select(HealthGoal.element_id).where(HealthGoal.element_id == element_id).limit(1)
        )
        has_health_data = await self.db.scalar(
            select(HealthDataPoint.element_id).where(HealthDataPoint.element_id == element_id).limit(1)
        )
        if any([has_goal_template, has_health_goal, has_health_data]):
            element.is_active = False
            await self.db.commit()
            return {"msg": "data element deactivated", "deleted": False}

        # Check field mappings and the status of their parent forms
        mapping_result = await self.db.execute(
            select(FieldElementMap, SurveyForm.status)
            .join(FormField, FieldElementMap.field_id == FormField.field_id)
            .join(SurveyForm, FormField.form_id == SurveyForm.form_id)
            .where(FieldElementMap.element_id == element_id)
        )
        mappings = mapping_result.all()

        if mappings:
            has_non_draft = any(status in ("PUBLISHED", "ARCHIVED") for _, status in mappings)
            if has_non_draft:
                # Soft delete — linked to a published/archived survey, preserve those mappings
                # but remove any draft-only mappings since drafts have no submissions
                for mapping, status in mappings:
                    if status == "DRAFT":
                        await self.db.delete(mapping)
                element.is_active = False
                await self.db.commit()
                return {"msg": "data element deactivated", "deleted": False}
            else:
                # Only DRAFT mappings — safe to remove all mappings and hard delete
                for mapping, _ in mappings:
                    await self.db.delete(mapping)
                await self.db.delete(element)
                await self.db.commit()
                return {"msg": "data element deleted", "deleted": True}

        # No references at all — hard delete
        await self.db.delete(element)
        await self.db.commit()
        return {"msg": "data element deleted", "deleted": True}

    async def map_field(self, field_id: uuid.UUID, element_id: uuid.UUID, transform_rule: dict | None = None):
        # Verify the field exists
        
        field = await self.db.get(FormField, field_id)
        if not field:
            raise HTTPException(status_code=404, detail="Form field not found")

        # Verify the element exists and is active
        element = await self.db.get(DataElement, element_id)
        if not element:
            raise HTTPException(status_code=404, detail="Data element not found")
        if not element.is_active:
            raise HTTPException(status_code=400, detail="Data element is inactive and cannot be mapped")

        # Check if this exact mapping already exists
        existing = await self.db.execute(
            select(FieldElementMap).where(
                FieldElementMap.field_id == field_id,
                FieldElementMap.element_id == element_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This field is already mapped to the specified element")

        mapping = FieldElementMap(field_id=field_id, element_id=element_id, transform_rule=transform_rule)
        self.db.add(mapping)
        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="This field is already mapped to the specified element")
        await self.db.refresh(mapping)
        return mapping

    async def get_all_field_mappings(self):
        from app.db.models import FormField, SurveyForm
        result = await self.db.execute(
            select(
                FieldElementMap.element_id,
                FieldElementMap.field_id,
                FormField.label.label("field_label"),
                SurveyForm.form_id,
                SurveyForm.title.label("form_title"),
                SurveyForm.status.label("form_status"),
                SurveyForm.version.label("form_version"),
            )
            .join(FormField, FormField.field_id == FieldElementMap.field_id)
            .join(SurveyForm, SurveyForm.form_id == FormField.form_id)
        )
        return [
            {
                "element_id": str(row.element_id),
                "field_id": str(row.field_id),
                "field_label": row.field_label,
                "form_id": str(row.form_id),
                "form_title": row.form_title,
                "form_status": row.form_status,
                "form_version": row.form_version,
            }
            for row in result.all()
        ]

    async def get_field_mappings(self, field_id: uuid.UUID):
        # Verify the field exists
        from app.db.models import FormField
        field = await self.db.get(FormField, field_id)
        if not field:
            raise HTTPException(status_code=404, detail="Form field not found")

        result = await self.db.execute(
            select(FieldElementMap, DataElement)
            .join(DataElement, DataElement.element_id == FieldElementMap.element_id)
            .where(FieldElementMap.field_id == field_id)
        )
        return [
            {
                **{k: v for k, v in mapping.__dict__.items() if not k.startswith("_")},
                "element": {k: v for k, v in element.__dict__.items() if not k.startswith("_")},
            }
            for mapping, element in result.all()
        ]

    async def unmap_field(self, field_id: uuid.UUID, element_id: uuid.UUID):
        # Verify the field exists
        from app.db.models import FormField
        field = await self.db.get(FormField, field_id)
        if not field:
            raise HTTPException(status_code=404, detail="Form field not found")

        # Verify the element exists
        element = await self.db.get(DataElement, element_id)
        if not element:
            raise HTTPException(status_code=404, detail="Data element not found")

        result = await self.db.execute(
            select(FieldElementMap).where(
                FieldElementMap.field_id == field_id,
                FieldElementMap.element_id == element_id,
            )
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            raise HTTPException(status_code=404, detail="No mapping found between this field and element")
        await self.db.delete(mapping)
        await self.db.flush()

class StatsQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_participant_summary(self, participant_id: uuid.UUID) -> dict:
        # Active forms: deployments for groups the participant belongs to, not revoked
        deployed = await _get_deployed_forms(participant_id, self.db)
        active_forms = len(deployed)

        # Forms filled today + active goals count — combined into one round trip
        today_start, today_end = _utc_day_bounds()
        forms_filled_sq = (
            select(func.count(distinct(FormSubmission.form_id)))
            .where(
                FormSubmission.participant_id == participant_id,
                FormSubmission.submitted_at >= today_start,
                FormSubmission.submitted_at < today_end,
            )
            .scalar_subquery()
        )
        active_goals_sq = (
            select(func.count(HealthGoal.goal_id))
            .where(HealthGoal.participant_id == participant_id)
            .scalar_subquery()
        )
        combined = (await self.db.execute(
            select(forms_filled_sq.label("forms_filled"), active_goals_sq.label("active_goals"))
        )).one()
        forms_filled = combined.forms_filled or 0
        active_goals = combined.active_goals or 0

        # Goals met: latest survey data point per element >= target_value
        # Subquery: most recent survey observation per element for this participant
        latest_obs = (
            select(
                HealthDataPoint.element_id,
                func.max(HealthDataPoint.observed_at).label("latest_at")
            )
            .where(
                HealthDataPoint.participant_id == participant_id,
                HealthDataPoint.source_type == "goal",
                HealthDataPoint.observed_at >= today_start,
                HealthDataPoint.observed_at < today_end,
            )
            .group_by(HealthDataPoint.element_id)
            .subquery()
        )

        goals_met_result = await self.db.execute(
            select(func.count(HealthGoal.goal_id))
            .join(latest_obs, latest_obs.c.element_id == HealthGoal.element_id)
            .join(
                HealthDataPoint,
                (HealthDataPoint.element_id == HealthGoal.element_id)
                & (HealthDataPoint.observed_at == latest_obs.c.latest_at)
                & (HealthDataPoint.participant_id == participant_id)
                & (HealthDataPoint.source_type == "goal"),
            )
            .where(
                HealthGoal.participant_id == participant_id,
                HealthDataPoint.value_number >= HealthGoal.target_value,
            )
        )
        goals_met = goals_met_result.scalar() or 0

        return {
            "active_forms": active_forms,
            "forms_filled": forms_filled,
            "active_goals": active_goals,
            "goals_met": goals_met,
            "goal_remaining": active_goals - goals_met
        }
    

    async def get_available_elements(self, participant_id: uuid.UUID) -> list:
        result = await self.db.execute(
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                DataElement.datatype,
            )
            .distinct()
            .join(FieldElementMap, FieldElementMap.element_id == DataElement.element_id)
            .join(FormField, FormField.field_id == FieldElementMap.field_id)
            .join(SurveyForm, SurveyForm.form_id == FormField.form_id)
            .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
            .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
            .where(GroupMember.participant_id == participant_id)
            .where(GroupMember.left_at == None)
            .where(FormDeployment.revoked_at == None)
        )
        return result.all()

    async def get_participant_element_stats(
        self,
        participant_id: uuid.UUID,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        stmt = (
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                func.avg(HealthDataPoint.value_number).label("avg"),
                func.min(HealthDataPoint.value_number).label("min"),
                func.max(HealthDataPoint.value_number).label("max"),
                func.count(HealthDataPoint.data_id).label("count"),
            )
            .join(DataElement, DataElement.element_id == HealthDataPoint.element_id)
            .where(HealthDataPoint.participant_id == participant_id)
            .group_by(DataElement.element_id, DataElement.code, DataElement.label, DataElement.unit)
        )
        if element_ids:
            stmt = stmt.where(HealthDataPoint.element_id.in_(element_ids))
        if date_from:
            stmt = stmt.where(HealthDataPoint.observed_at >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc))
        if date_to:
            stmt = stmt.where(HealthDataPoint.observed_at < datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))

        rows = (await self.db.execute(stmt)).all()
        return [
            {
                "element_id": str(row.element_id),
                "code": row.code,
                "label": row.label,
                "unit": row.unit,
                "avg": round(float(row.avg), 2) if row.avg is not None else None,
                "min": float(row.min) if row.min is not None else None,
                "max": float(row.max) if row.max is not None else None,
                "count": row.count,
            }
            for row in rows
        ]

    async def get_participant_health_timeseries(
        self,
        participant_id: uuid.UUID,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict]:
        stmt = (
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                DataElement.datatype,
                HealthDataPoint.data_id,
                HealthDataPoint.observed_at,
                HealthDataPoint.source_type,
                HealthDataPoint.source_submission_id,
                HealthDataPoint.source_field_id,
                HealthDataPoint.value_number,
                HealthDataPoint.value_text,
                HealthDataPoint.value_date,
                HealthDataPoint.value_json,
                HealthDataPoint.notes,
            )
            .join(DataElement, DataElement.element_id == HealthDataPoint.element_id)
            .where(HealthDataPoint.participant_id == participant_id)
            .order_by(
                DataElement.element_id,
                HealthDataPoint.observed_at,
                HealthDataPoint.data_id,
            )
        )
        if element_ids:
            stmt = stmt.where(HealthDataPoint.element_id.in_(element_ids))
        if date_from:
            stmt = stmt.where(
                HealthDataPoint.observed_at
                >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc)
            )
        if date_to:
            stmt = stmt.where(
                HealthDataPoint.observed_at
                < datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc)
            )

        rows = (await self.db.execute(stmt.limit(5000))).all()
        series_by_element: dict[str, dict] = {}
        for row in rows:
            element_key = str(row.element_id)
            if element_key not in series_by_element:
                series_by_element[element_key] = {
                    "element_id": element_key,
                    "code": row.code,
                    "label": row.label,
                    "unit": row.unit,
                    "datatype": row.datatype,
                    "points": [],
                }

            series_by_element[element_key]["points"].append(
                {
                    "data_id": str(row.data_id),
                    "observed_at": row.observed_at.isoformat() if row.observed_at else None,
                    "source_type": row.source_type,
                    "source_submission_id": (
                        str(row.source_submission_id) if row.source_submission_id else None
                    ),
                    "source_field_id": (
                        str(row.source_field_id) if row.source_field_id else None
                    ),
                    "value_number": (
                        float(row.value_number) if row.value_number is not None else None
                    ),
                    "value_text": row.value_text,
                    "value_date": row.value_date.isoformat() if row.value_date else None,
                    "value_json": row.value_json,
                    "notes": row.notes,
                }
            )

        return list(series_by_element.values())

    


class CaretakersQuery:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _assert_group_owned(self, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """B2: ownership guard for any group-scoped query.

        Raises 404 ('Group not found or not assigned to you') if the group
        either doesn't exist or isn't owned by the caretaker. Same wording as
        get_group() so callers don't accidentally leak the difference between
        'no such group' and 'not yours'.
        """
        owns_group = await self.db.scalar(
            select(Group.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(Group.group_id == group_id)
            .where(CaretakerProfile.user_id == user_id)
        )
        if not owns_group:
            raise HTTPException(status_code=404, detail="Group not found or not assigned to you")

    async def _assert_participant_in_owned_group(
        self, participant_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """B1: ownership guard for any participant-scoped query.

        Raises 404 ('Participant not found or not assigned to you') if the
        participant either doesn't exist or isn't a current member of any
        group owned by this caretaker. Deliberately ambiguous to prevent
        caretakers from enumerating participant IDs they don't own.
        """
        has_access = await self.db.scalar(
            select(GroupMember.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(GroupMember.participant_id == participant_id)
            .where(GroupMember.left_at == None)
            .where(CaretakerProfile.user_id == user_id)
            .limit(1)
        )
        if not has_access:
            raise HTTPException(status_code=404, detail="Participant not found or not assigned to you")

    async def get_groups(self, user_id: uuid.UUID) -> list:
        # Subquery: number of currently-active members per group.
        member_count_sq = (
            select(
                GroupMember.group_id.label("gm_group_id"),
                func.count(GroupMember.participant_id).label("member_count"),
            )
            .where(GroupMember.left_at == None)
            .group_by(GroupMember.group_id)
            .subquery()
        )

        result = await self.db.execute(
            select(Group, func.coalesce(member_count_sq.c.member_count, 0).label("member_count"))
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .outerjoin(member_count_sq, member_count_sq.c.gm_group_id == Group.group_id)
            .where(CaretakerProfile.user_id == user_id)
        )
        return result.all()



    async def get_group(self, group_id: uuid.UUID, user_id: uuid.UUID):
        member_count_sq = (
            select(
                GroupMember.group_id.label("gm_group_id"),
                func.count(GroupMember.participant_id).label("member_count"),
            )
            .where(GroupMember.left_at == None)
            .where(GroupMember.group_id == group_id)
            .group_by(GroupMember.group_id)
            .subquery()
        )

        result = await self.db.execute(
            select(Group, func.coalesce(member_count_sq.c.member_count, 0).label("member_count"))
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .outerjoin(member_count_sq, member_count_sq.c.gm_group_id == Group.group_id)
            .where(Group.group_id == group_id, CaretakerProfile.user_id == user_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Group not found or not assigned to you")
        return row

    async def get_group_participants(self, group_id: uuid.UUID, user_id: uuid.UUID):
        # B2: was previously accepting user_id but never using it — group_id
        # alone was enough to read any group's participants. Now guarded.
        await self._assert_group_owned(group_id, user_id)
        result = await self.db.execute(
            select(ParticipantProfile, User.first_name, User.last_name, GroupMember.joined_at)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .where(GroupMember.group_id == group_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
        )
        return result.all()

    async def get_group_participant(self, group_id: uuid.UUID, participant_id: uuid.UUID, user_id: uuid.UUID):
        # B1: was previously taking only group_id and participant_id with no
        # caretaker filter. Any caretaker could read any participant in any
        # group just by guessing IDs. Now guarded.
        await self._assert_group_owned(group_id, user_id)
        result = await self.db.execute(
            select(ParticipantProfile, User.first_name, User.last_name, User.status, GroupMember.joined_at)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .where(GroupMember.group_id == group_id)
            .where(ParticipantProfile.participant_id == participant_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Participant not found in this group")
        return row

    async def get_participant_group_memberships(
        self,
        participant_id: uuid.UUID,
        caretaker_user_id: uuid.UUID,
    ) -> list[dict]:
        result = await self.db.execute(
            select(
                Group.group_id,
                Group.name,
                Group.description,
                GroupMember.joined_at,
            )
            .join(GroupMember, GroupMember.group_id == Group.group_id)
            .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(GroupMember.participant_id == participant_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
            .where(CaretakerProfile.user_id == caretaker_user_id)
            .order_by(Group.name)
        )
        return [
            {
                "group_id": row.group_id,
                "name": row.name,
                "description": row.description,
                "joined_at": row.joined_at,
            }
            for row in result.all()
        ]

    async def get_participant_activity_counts(self, user_id: uuid.UUID, group_id: uuid.UUID | None = None):
        today = _utc_today()
        caretaker_participants_sq = (
            select(ParticipantProfile.participant_id)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
        )
        last_submission_sq = (
            select(
                FormSubmission.participant_id,
                func.max(func.cast(FormSubmission.submitted_at, SADate)).label("last_submission_at"),
            )
            .join(
                FormDeployment,
                and_(
                    FormDeployment.group_id == FormSubmission.group_id,
                    FormDeployment.form_id == FormSubmission.form_id,
                    FormDeployment.revoked_at == None,
                ),
            )
            .where(FormSubmission.participant_id.in_(caretaker_participants_sq))
            .group_by(FormSubmission.participant_id)
            .subquery()
        )
        activity_expr = case(
            (last_submission_sq.c.last_submission_at >= today - timedelta(days=7), "highly_active"),
            (last_submission_sq.c.last_submission_at >= today - timedelta(days=14), "moderately_active"),
            (last_submission_sq.c.last_submission_at >= today - timedelta(days=30), "low_active"),
            else_="inactive",
        ).label("activity")

        stmt = (
            select(activity_expr, func.count(distinct(ParticipantProfile.participant_id)).label("cnt"))
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .join(UserRole, UserRole.user_id == User.user_id)
            .join(Role, Role.role_id == UserRole.role_id)
            .outerjoin(last_submission_sq, last_submission_sq.c.participant_id == ParticipantProfile.participant_id)
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
            .where(func.lower(Role.role_name) == "participant")
            .group_by(activity_expr)
        )
        if group_id:
            stmt = stmt.where(GroupMember.group_id == group_id)

        rows = (await self.db.execute(stmt)).all()
        counts = {"highly_active": 0, "moderately_active": 0, "low_active": 0, "inactive": 0}
        for row in rows:
            counts[row.activity] = row.cnt
        return counts

    async def _compute_goal_stats_map(self, participant_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
        if not participant_ids:
            return {}

        result = await self.db.execute(
            select(HealthGoal, DataElement.datatype)
            .join(DataElement, DataElement.element_id == HealthGoal.element_id)
            .where(HealthGoal.participant_id.in_(participant_ids))
            .where(HealthGoal.status == "active")
        )
        rows = result.all()

        grouped: dict[uuid.UUID, list[tuple[HealthGoal, str | None]]] = {}
        for goal, datatype in rows:
            grouped.setdefault(goal.participant_id, []).append((goal, datatype))

        participant_query = ParticipantQuery(self.db)
        stats_map: dict[uuid.UUID, dict] = {}
        for pid in participant_ids:
            goals = grouped.get(pid, [])
            if not goals:
                stats_map[pid] = {
                    "progress": "not_started",
                    "completed_count": 0,
                    "total_count": 0,
                }
                continue

            completed_count = 0
            for goal, datatype in goals:
                current = await participant_query._compute_goal_current_value(
                    goal, datatype, pid, as_of=datetime.now(timezone.utc)
                )
                if participant_query._goal_completed(goal, current):
                    completed_count += 1

            if completed_count == 0:
                progress = "in_progress"
            elif completed_count == len(goals):
                progress = "completed"
            else:
                progress = "in_progress"

            stats_map[pid] = {
                "progress": progress,
                "completed_count": int(completed_count),
                "total_count": int(len(goals)),
            }

        return stats_map

    async def get_participants(
        self,
        user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
        q: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        age_min: int | None = None,
        age_max: int | None = None,
        has_alerts: bool | None = None,
        survey_progress: str | None = None,
        goal_progress: str | None = None,
        # goal_progress: str | None = None,
        sort_by: str | None = None,
        sort_dir: str = "asc",
        submission_date_from: date | None = None,
        submission_date_to: date | None = None,
        limit: int | None = None,
        offset: int = 0,
        # goal_date: date | None = None,
    ):
        deployed_sq = (
            select(
                FormDeployment.group_id,
                func.count(FormDeployment.deployment_id).label("deployed_count"),
            )
            .where(FormDeployment.revoked_at == None)
            .group_by(FormDeployment.group_id)
            .subquery()
        )

        caretaker_participants_sq = (
            select(ParticipantProfile.participant_id)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
        )

        submissions_stmt = (
            select(
                FormSubmission.participant_id,
                FormSubmission.group_id,
                func.count(distinct(FormSubmission.form_id)).label("submitted_count"),
                func.cast(func.max(FormSubmission.submitted_at), SADate).label("last_submission_at"),
            )
            .join(
                FormDeployment,
                and_(
                    FormDeployment.group_id == FormSubmission.group_id,
                    FormDeployment.form_id == FormSubmission.form_id,
                    FormDeployment.revoked_at == None,
                ),
            )
            .where(FormSubmission.participant_id.in_(caretaker_participants_sq))
        )
        if submission_date_from:
            submissions_stmt = submissions_stmt.where(FormSubmission.submitted_at >= datetime.combine(submission_date_from, time.min).replace(tzinfo=timezone.utc))
        if submission_date_to:
            submissions_stmt = submissions_stmt.where(FormSubmission.submitted_at < datetime.combine(submission_date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))
        submissions_sq = submissions_stmt.group_by(
            FormSubmission.participant_id,
            FormSubmission.group_id,
        ).subquery()

        age_expr = func.date_part("year", func.age(ParticipantProfile.dob))

        survey_progress_expr = case(
            (or_(submissions_sq.c.submitted_count == None, submissions_sq.c.submitted_count == 0), "not_started"),
            (submissions_sq.c.submitted_count >= deployed_sq.c.deployed_count, "completed"),
            else_="in_progress",
        )

        today = _utc_today()
        status_expr = case(
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=7), "highly_active"),
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=14), "moderately_active"),
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=30), "low_active"),
            else_="inactive",
        )

        # ── Base query ────────────────────────────────────────────────────────
        stmt = (
            select(
                ParticipantProfile.participant_id,
                User.first_name,
                User.last_name,
                User.email,
                User.phone,
                ParticipantProfile.dob,
                ParticipantProfile.gender,
                age_expr.label("age"),
                status_expr.label("status"),
                GroupMember.group_id,
                GroupMember.joined_at.label("enrolled_at"),
                survey_progress_expr.label("survey_progress"),
                func.coalesce(submissions_sq.c.submitted_count, 0).label("survey_submitted_count"),
                func.coalesce(deployed_sq.c.deployed_count, 0).label("survey_deployed_count"),
                User.last_login_at,
                submissions_sq.c.last_submission_at,
            )
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .join(UserRole, UserRole.user_id == User.user_id)
            .join(Role, Role.role_id == UserRole.role_id)
            .outerjoin(deployed_sq, deployed_sq.c.group_id == GroupMember.group_id)
            .outerjoin(
                submissions_sq,
                and_(
                    submissions_sq.c.participant_id == ParticipantProfile.participant_id,
                    submissions_sq.c.group_id == GroupMember.group_id,
                ),
            )
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
            .where(func.lower(Role.role_name) == "participant")
        )

        # ── Filters ───────────────────────────────────────────────────────────
        if group_id:
            stmt = stmt.where(GroupMember.group_id == group_id)
        if q:
            needle = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(needle),
                    User.last_name.ilike(needle),
                    User.email.ilike(needle),
                )
            )
        if status == "active":
            stmt = stmt.where(status_expr != "inactive")
        elif status in ("highly_active", "moderately_active", "low_active", "inactive"):
            stmt = stmt.where(status_expr == status)
        if gender:
            stmt = stmt.where(func.lower(ParticipantProfile.gender) == gender.lower())
        if age_min is not None:
            stmt = stmt.where(age_expr >= age_min)
        if age_max is not None:
            stmt = stmt.where(age_expr <= age_max)
        if has_alerts is True:
            stmt = stmt.where(submissions_sq.c.submitted_count < deployed_sq.c.deployed_count)
        elif has_alerts is False:
            stmt = stmt.where(
                or_(
                    submissions_sq.c.submitted_count >= deployed_sq.c.deployed_count,
                    deployed_sq.c.deployed_count == None,
                    deployed_sq.c.deployed_count == 0,
                )
            )
        if survey_progress in {"not_started", "in_progress", "completed"}:
            stmt = stmt.where(survey_progress_expr == survey_progress)
        elif survey_progress == "below_50":
            stmt = stmt.where(
                and_(
                    func.coalesce(deployed_sq.c.deployed_count, 0) > 0,
                    func.coalesce(submissions_sq.c.submitted_count, 0) > 0,
                    func.coalesce(submissions_sq.c.submitted_count, 0)
                    < (func.coalesce(deployed_sq.c.deployed_count, 0) * 0.5),
                )
            )
        elif survey_progress == "above_50":
            stmt = stmt.where(
                and_(
                    func.coalesce(deployed_sq.c.deployed_count, 0) > 0,
                    func.coalesce(submissions_sq.c.submitted_count, 0)
                    >= (func.coalesce(deployed_sq.c.deployed_count, 0) * 0.5),
                    func.coalesce(submissions_sq.c.submitted_count, 0)
                    < func.coalesce(deployed_sq.c.deployed_count, 0),
                )
            )

        # B8: Compute total_count BEFORE applying ORDER BY / LIMIT / OFFSET so
        # the frontend gets the real filtered total. Note: this count reflects
        # SQL-level filters only — goal_progress is post-filtered in Python
        # below, so when goal_progress is set this is an upper bound. That
        # limitation is tracked as B22.
        count_stmt = select(func.count()).select_from(stmt.subquery())
        sql_total = (await self.db.execute(count_stmt)).scalar() or 0

        # ── Sorting ───────────────────────────────────────────────────────────
        is_desc = sort_dir == "desc"
        if sort_by == "name":
            stmt = stmt.order_by(
                desc(User.first_name) if is_desc else User.first_name,
                desc(User.last_name) if is_desc else User.last_name,
            )
        elif sort_by == "age":
            stmt = stmt.order_by(desc(age_expr) if is_desc else age_expr)
        elif sort_by == "status":
            stmt = stmt.order_by(desc(status_expr) if is_desc else status_expr)
        elif sort_by == "gender":
            stmt = stmt.order_by(desc(ParticipantProfile.gender) if is_desc else ParticipantProfile.gender)
        elif sort_by == "surveys":
            stmt = stmt.order_by(desc(survey_progress_expr) if is_desc else survey_progress_expr)
        elif sort_by == "last_active":
            stmt = stmt.order_by(desc(User.last_login_at) if is_desc else User.last_login_at)
        elif sort_by == "enrolled":
            stmt = stmt.order_by(desc(GroupMember.joined_at) if is_desc else GroupMember.joined_at)
        elif sort_by == "submission_date":
            stmt = stmt.order_by(desc(submissions_sq.c.last_submission_at) if is_desc else submissions_sq.c.last_submission_at)

        if limit is not None:
            stmt = stmt.limit(limit).offset(max(0, offset))

        result = await self.db.execute(stmt)
        rows = result.all()

        participant_ids = [row.participant_id for row in rows]
        goal_stats_map = await self._compute_goal_stats_map(participant_ids)
        output_rows = []
        for row in rows:
            goal_stats = goal_stats_map.get(
                row.participant_id,
                {"progress": "not_started", "completed_count": 0, "total_count": 0},
            )
            output_rows.append(
                SimpleNamespace(
                    participant_id=row.participant_id,
                    first_name=row.first_name,
                    last_name=row.last_name,
                    email=row.email,
                    phone=row.phone,
                    dob=row.dob,
                    gender=row.gender,
                    age=row.age,
                    status=row.status,
                    group_id=row.group_id,
                    enrolled_at=row.enrolled_at,
                    survey_progress=row.survey_progress,
                    goal_progress=goal_stats.get("progress", "not_started"),
                    survey_submitted_count=int(row.survey_submitted_count or 0),
                    survey_deployed_count=int(row.survey_deployed_count or 0),
                    goals_completed_count=int(goal_stats.get("completed_count", 0) or 0),
                    goals_total_count=int(goal_stats.get("total_count", 0) or 0),
                    last_login_at=row.last_login_at,
                    last_submission_at=row.last_submission_at,
                )
            )

        if sort_by == "goals":
            order = {"not_started": 0, "in_progress": 1, "completed": 2}
            output_rows.sort(key=lambda r: order.get(r.goal_progress, 0), reverse=is_desc)

        if goal_progress in {"not_started", "in_progress", "completed"}:
            output_rows = [row for row in output_rows if row.goal_progress == goal_progress]
        elif goal_progress == "no_goals":
            output_rows = [row for row in output_rows if int(getattr(row, "goals_total_count", 0) or 0) == 0]

        return output_rows, int(sql_total)

    async def get_participant_summary(
        self,
        user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
    ) -> dict:
        deployed_sq = (
            select(
                FormDeployment.group_id,
                func.count(FormDeployment.deployment_id).label("deployed_count"),
            )
            .where(FormDeployment.revoked_at == None)
            .group_by(FormDeployment.group_id)
            .subquery()
        )

        submissions_sq = (
            select(
                FormSubmission.participant_id,
                func.count(distinct(FormSubmission.form_id)).label("submitted_count"),
                func.cast(func.max(FormSubmission.submitted_at), SADate).label("last_submission_at"),
            )
            .join(
                FormDeployment,
                and_(
                    FormDeployment.group_id == FormSubmission.group_id,
                    FormDeployment.form_id == FormSubmission.form_id,
                    FormDeployment.revoked_at == None,
                ),
            )
            .group_by(FormSubmission.participant_id)
            .subquery()
        )

        today = _utc_today()
        status_expr = case(
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=7), "highly_active"),
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=14), "moderately_active"),
            (func.cast(submissions_sq.c.last_submission_at, SADate) >= today - timedelta(days=30), "low_active"),
            else_="inactive",
        )
        flagged_expr = case(
            (
                and_(
                    func.coalesce(submissions_sq.c.submitted_count, 0)
                    < func.coalesce(deployed_sq.c.deployed_count, 0),
                    func.coalesce(deployed_sq.c.deployed_count, 0) > 0,
                ),
                1,
            ),
            else_=0,
        )

        stmt = (
            select(
                func.count(distinct(ParticipantProfile.participant_id)).label("total"),
                func.sum(case((status_expr == "inactive", 1), else_=0)).label("inactive"),
                func.sum(case((status_expr != "inactive", 1), else_=0)).label("active"),
                func.sum(flagged_expr).label("flagged"),
            )
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .join(UserRole, UserRole.user_id == User.user_id)
            .join(Role, Role.role_id == UserRole.role_id)
            .outerjoin(deployed_sq, deployed_sq.c.group_id == GroupMember.group_id)
            .outerjoin(submissions_sq, submissions_sq.c.participant_id == ParticipantProfile.participant_id)
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
            .where(func.lower(Role.role_name) == "participant")
        )
        if group_id:
            stmt = stmt.where(GroupMember.group_id == group_id)

        row = (await self.db.execute(stmt)).one()
        return {
            "total": int(row.total or 0),
            "active": int(row.active or 0),
            "inactive": int(row.inactive or 0),
            "flagged": int(row.flagged or 0),
        }

    async def get_group_forms_summary(
        self,
        caretaker_user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
    ) -> dict:
        stmt = (
            select(
                func.count(FormDeployment.deployment_id).label("total"),
                func.sum(case((FormDeployment.revoked_at.is_(None), 1), else_=0)).label("active"),
                func.sum(case((FormDeployment.revoked_at.is_not(None), 1), else_=0)).label("revoked"),
            )
            .join(Group, Group.group_id == FormDeployment.group_id)
            .join(SurveyForm, SurveyForm.form_id == FormDeployment.form_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(CaretakerProfile.user_id == caretaker_user_id)
            .where(SurveyForm.status != "DELETED")
        )
        if group_id:
            stmt = stmt.where(FormDeployment.group_id == group_id)

        row = (await self.db.execute(stmt)).one()
        return {
            "total": int(row.total or 0),
            "active": int(row.active or 0),
            "revoked": int(row.revoked or 0),
        }

    async def get_participant_submissions(
        self,
        participant_id: uuid.UUID,
        date_from: date | None = None,
        date_to: date | None = None,
        caretaker_user_id: uuid.UUID | None = None,
    ):
        # B1: when called from a caretaker route, caretaker_user_id MUST be
        # passed so the ownership check fires. The param is optional only
        # because admin_service.py also calls this function and admins are
        # already authorized to see any participant's submissions.
        if caretaker_user_id is not None:
            await self._assert_participant_in_owned_group(participant_id, caretaker_user_id)
        stmt = (
            select(
                FormSubmission.submission_id,
                FormSubmission.participant_id,
                FormSubmission.form_id,
                SurveyForm.title.label("form_name"),
                FormSubmission.submitted_at,
            )
            .join(SurveyForm, SurveyForm.form_id == FormSubmission.form_id)
            .where(FormSubmission.participant_id == participant_id)
            .order_by(FormSubmission.submitted_at.desc())
        )

        if date_from:
            stmt = stmt.where(FormSubmission.submitted_at >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc))
        if date_to:
            stmt = stmt.where(FormSubmission.submitted_at < datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))

        result = await self.db.execute(stmt)
        return result.all()

    async def get_group_elements(self, group_id: uuid.UUID, user_id: uuid.UUID):
        # B2: was previously taking only group_id with no caretaker filter,
        # which let any caretaker read the deployed elements of any group.
        await self._assert_group_owned(group_id, user_id)
        result = await self.db.execute(
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                DataElement.datatype,
            )
            .join(FieldElementMap, FieldElementMap.element_id == DataElement.element_id)
            .join(FormField, FormField.field_id == FieldElementMap.field_id)
            .join(SurveyForm, SurveyForm.form_id == FormField.form_id)
            .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
            .where(FormDeployment.group_id == group_id)
            .where(FormDeployment.revoked_at == None)
            .distinct()
        )
        return result.all()

    async def get_group_forms(
        self,
        caretaker_user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
        limit: int | None = None,
        offset: int = 0,
    ):
        participant_counts_sq = (
            select(
                GroupMember.group_id.label("group_id"),
                func.count(distinct(GroupMember.participant_id)).label("participant_count"),
            )
            .join(ParticipantProfile, ParticipantProfile.participant_id == GroupMember.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .where(GroupMember.left_at == None)
            .where(User.status.is_(True))
            .group_by(GroupMember.group_id)
            .subquery()
        )

        submitted_counts_sq = (
            select(
                FormSubmission.form_id.label("form_id"),
                FormSubmission.group_id.label("group_id"),
                func.count(distinct(FormSubmission.participant_id)).label("submitted_count"),
            )
            .where(FormSubmission.submitted_at.is_not(None))
            .group_by(FormSubmission.form_id, FormSubmission.group_id)
            .subquery()
        )

        stmt = (
            select(
                FormDeployment.deployment_id,
                FormDeployment.form_id,
                FormDeployment.group_id,
                Group.name.label("group_name"),
                SurveyForm.title.label("form_title"),
                SurveyForm.description.label("form_description"),
                SurveyForm.status.label("form_status"),
                FormDeployment.deployed_at,
                FormDeployment.revoked_at,
                func.coalesce(participant_counts_sq.c.participant_count, 0).label("participant_count"),
                func.coalesce(submitted_counts_sq.c.submitted_count, 0).label("submitted_count"),
            )
            .join(Group, Group.group_id == FormDeployment.group_id)
            .join(SurveyForm, SurveyForm.form_id == FormDeployment.form_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .outerjoin(participant_counts_sq, participant_counts_sq.c.group_id == FormDeployment.group_id)
            .outerjoin(
                submitted_counts_sq,
                and_(
                    submitted_counts_sq.c.form_id == FormDeployment.form_id,
                    submitted_counts_sq.c.group_id == FormDeployment.group_id,
                ),
            )
            .where(CaretakerProfile.user_id == caretaker_user_id)
            .where(SurveyForm.status != "DELETED")
            .order_by(FormDeployment.revoked_at.is_not(None), FormDeployment.deployed_at.desc())
        )
        if group_id:
            stmt = stmt.where(FormDeployment.group_id == group_id)
        if limit is not None:
            stmt = stmt.limit(limit).offset(max(0, offset))

        return (await self.db.execute(stmt)).all()

    async def get_caretaker_form_group_ids(
        self,
        form_id: uuid.UUID,
        caretaker_user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
    ) -> list[uuid.UUID]:
        stmt = (
            select(FormDeployment.group_id)
            .join(Group, Group.group_id == FormDeployment.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(CaretakerProfile.user_id == caretaker_user_id)
            .where(FormDeployment.form_id == form_id)
        )
        if group_id:
            stmt = stmt.where(FormDeployment.group_id == group_id)
        result = await self.db.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]

    async def generate_group_report(
        self,
        group_id: uuid.UUID,
        requested_by: uuid.UUID,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Report:
        stmt = (
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                func.avg(HealthDataPoint.value_number).label("avg"),
                func.min(HealthDataPoint.value_number).label("min"),
                func.max(HealthDataPoint.value_number).label("max"),
                func.count(HealthDataPoint.data_id).label("count"),
            )
            .join(DataElement, DataElement.element_id == HealthDataPoint.element_id)
            .join(ParticipantProfile, ParticipantProfile.participant_id == HealthDataPoint.participant_id)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .where(GroupMember.group_id == group_id)
            .where(GroupMember.left_at == None)
            .group_by(DataElement.element_id, DataElement.code, DataElement.label, DataElement.unit)
        )
        if element_ids:
            stmt = stmt.where(HealthDataPoint.element_id.in_(element_ids))
        if date_from:
            stmt = stmt.where(HealthDataPoint.observed_at >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc))
        if date_to:
            stmt = stmt.where(HealthDataPoint.observed_at < datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))

        rows = (await self.db.execute(stmt)).all()

        payload = {
            "elements": [
                {
                    "element_id": str(row.element_id),
                    "code": row.code,
                    "label": row.label,
                    "unit": row.unit,
                    "avg": round(float(row.avg), 2) if row.avg is not None else None,
                    "min": float(row.min) if row.min is not None else None,
                    "max": float(row.max) if row.max is not None else None,
                    "count": row.count,
                }
                for row in rows
            ]
        }

        report = Report(
            report_type="group",
            requested_by=requested_by,
            group_id=group_id,
            parameters={
                "element_ids": [str(e) for e in (element_ids or [])],
                "date_from": str(date_from) if date_from else None,
                "date_to": str(date_to) if date_to else None,
            },
        )
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(report)

        report.parameters = {**report.parameters, "payload": payload}
        await self.db.flush()

        return report
    



    async def generate_comparison_report(
        self,
        participant_id: uuid.UUID,
        requested_by: uuid.UUID,
        compare_with: str,                        # "participant" | "group" | "all"
        compare_participant_id: uuid.UUID | None = None,
        group_id: uuid.UUID | None = None,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Report:

        def _build_stats_sq(participant_filter):
            stmt = (
                select(
                    HealthDataPoint.element_id,
                    func.avg(HealthDataPoint.value_number).label("avg"),
                    func.min(HealthDataPoint.value_number).label("min"),
                    func.max(HealthDataPoint.value_number).label("max"),
                    func.count(HealthDataPoint.data_id).label("count"),
                )
                .where(participant_filter)
                .group_by(HealthDataPoint.element_id)
            )
            if element_ids:
                stmt = stmt.where(HealthDataPoint.element_id.in_(element_ids))
            if date_from:
                stmt = stmt.where(HealthDataPoint.observed_at >= datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc))
            if date_to:
                stmt = stmt.where(HealthDataPoint.observed_at < datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))
            return stmt.subquery()

        subject_sq = _build_stats_sq(HealthDataPoint.participant_id == participant_id)

        if compare_with == "participant":
            comparison_sq = _build_stats_sq(HealthDataPoint.participant_id == compare_participant_id)
        elif compare_with == "group":
            members_sq = select(GroupMember.participant_id).where(
                GroupMember.group_id == group_id,
                GroupMember.left_at == None,
            )
            comparison_sq = _build_stats_sq(HealthDataPoint.participant_id.in_(members_sq))
        else:  # "all"
            comparison_sq = _build_stats_sq(True)

        stmt = (
            select(
                DataElement.element_id,
                DataElement.code,
                DataElement.label,
                DataElement.unit,
                subject_sq.c.avg.label("subject_avg"),
                subject_sq.c.min.label("subject_min"),
                subject_sq.c.max.label("subject_max"),
                subject_sq.c.count.label("subject_count"),
                comparison_sq.c.avg.label("comparison_avg"),
                comparison_sq.c.min.label("comparison_min"),
                comparison_sq.c.max.label("comparison_max"),
                comparison_sq.c.count.label("comparison_count"),
            )
            .outerjoin(subject_sq, subject_sq.c.element_id == DataElement.element_id)
            .outerjoin(comparison_sq, comparison_sq.c.element_id == DataElement.element_id)
            .where(
                or_(
                    subject_sq.c.element_id != None,
                    comparison_sq.c.element_id != None,
                )
            )
        )
        if element_ids:
            stmt = stmt.where(DataElement.element_id.in_(element_ids))

        rows = (await self.db.execute(stmt)).all()

        def fmt(v):
            return round(float(v), 2) if v is not None else None

        payload = {
            "compare_with": compare_with,
            "elements": [
                {
                    "element_id": str(row.element_id),
                    "code": row.code,
                    "label": row.label,
                    "unit": row.unit,
                    "subject": {
                        "avg": fmt(row.subject_avg),
                        "min": fmt(row.subject_min),
                        "max": fmt(row.subject_max),
                        "count": row.subject_count,
                    },
                    "comparison": {
                        "avg": fmt(row.comparison_avg),
                        "min": fmt(row.comparison_min),
                        "max": fmt(row.comparison_max),
                        "count": row.comparison_count,
                    },
                }
                for row in rows
            ],
        }

        report = Report(
            report_type="comparison",
            requested_by=requested_by,
            participant_id=participant_id,
            group_id=group_id if compare_with == "group" else None,
            parameters={
                "compare_with": compare_with,
                "compare_participant_id": str(compare_participant_id) if compare_participant_id else None,
                "group_id": str(group_id) if group_id else None,
                "element_ids": [str(e) for e in (element_ids or [])],
                "date_from": str(date_from) if date_from else None,
                "date_to": str(date_to) if date_to else None,
            },
        )
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(report)

        report.parameters = {**report.parameters, "payload": payload}
        await self.db.flush()

        return report

    async def get_report(self, report_id: uuid.UUID, requested_by: uuid.UUID) -> Report:
        result = await self.db.execute(
            select(Report).where(
                Report.report_id == report_id,
                Report.requested_by == requested_by,
            )
        )
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    async def create_feedback(
        self,
        caretaker_user_id: uuid.UUID,
        participant_id: uuid.UUID,
        message: str,
        submission_id: uuid.UUID | None = None,
    ) -> CaretakerFeedback:
        # B1: ownership guard — previously this only checked that both
        # entities exist independently, allowing a caretaker to create
        # feedback rows attached to participants in other caretakers' groups.
        await self._assert_participant_in_owned_group(participant_id, caretaker_user_id)
        row = (await self.db.execute(
            select(CaretakerProfile.caretaker_id, ParticipantProfile.user_id)
            .where(CaretakerProfile.user_id == caretaker_user_id)
            .where(ParticipantProfile.participant_id == participant_id)
        )).one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Caretaker or participant not found")

        feedback = CaretakerFeedback(
            caretaker_id=row.caretaker_id,
            participant_id=participant_id,
            submission_id=submission_id,
            message=message,
        )
        self.db.add(feedback)
        await self.db.flush()

        return feedback

    async def list_feedback(
        self,
        participant_id: uuid.UUID,
        caretaker_user_id: uuid.UUID | None = None,
    ) -> list[CaretakerFeedback]:
        # B1: when called from a caretaker route, caretaker_user_id MUST be
        # passed so the ownership check fires. Optional because
        # participants_only.py uses this endpoint for participants to read
        # feedback ABOUT themselves (a participant viewing their own data
        # doesn't go through caretaker ownership rules).
        # Note: B29 was closed as not-a-bug — feedback is intentionally
        # collaborative across all caretakers assigned to the same participant.
        if caretaker_user_id is not None:
            await self._assert_participant_in_owned_group(participant_id, caretaker_user_id)
        result = await self.db.execute(
            select(CaretakerFeedback)
            .where(CaretakerFeedback.participant_id == participant_id)
            .order_by(CaretakerFeedback.created_at.desc())
        )
        return result.scalars().all()

    async def get_submission_detail(
        self, participant_id: uuid.UUID, submission_id: uuid.UUID, user_id: uuid.UUID
    ):
        # B1: ownership guard
        await self._assert_participant_in_owned_group(participant_id, user_id)
        row = (await self.db.execute(
            select(
                FormSubmission.submission_id,
                FormSubmission.participant_id,
                FormSubmission.form_id,
                SurveyForm.title.label("form_name"),
                FormSubmission.submitted_at,
            )
            .join(SurveyForm, SurveyForm.form_id == FormSubmission.form_id)
            .where(
                FormSubmission.submission_id == submission_id,
                FormSubmission.participant_id == participant_id,
            )
        )).one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Submission not found")

        answers = (await self.db.execute(
            select(
                SubmissionAnswer.field_id,
                FormField.label.label("field_label"),
                SubmissionAnswer.value_text,
                SubmissionAnswer.value_number,
                SubmissionAnswer.value_date,
                SubmissionAnswer.value_json,
            )
            .join(FormField, FormField.field_id == SubmissionAnswer.field_id)
            .where(SubmissionAnswer.submission_id == submission_id)
        )).all()

        return row, answers

    async def get_participant_goals(self, participant_id: uuid.UUID, user_id: uuid.UUID):
        # B1: ownership guard
        await self._assert_participant_in_owned_group(participant_id, user_id)
        return await ParticipantQuery(self.db).get_goals(participant_id)

    async def get_health_trends(
        self,
        participant_id: uuid.UUID,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list:
        # B1: ownership guard. Param is keyword-only positionally because it
        # was added at the end to avoid disturbing existing positional callers,
        # but it is REQUIRED in practice — passing None bypasses the check
        # and should never happen from a caretaker route.
        if user_id is None:
            raise HTTPException(status_code=500, detail="get_health_trends: missing user_id (caretaker context required)")
        await self._assert_participant_in_owned_group(participant_id, user_id)
        stmt = (
            select(
                DataElement.element_id,
                DataElement.label,
                DataElement.unit,
                HealthDataPoint.observed_at,
                HealthDataPoint.value_number,
            )
            .join(DataElement, DataElement.element_id == HealthDataPoint.element_id)
            .where(HealthDataPoint.participant_id == participant_id)
            .order_by(DataElement.element_id, HealthDataPoint.observed_at)
        )
        if element_ids:
            stmt = stmt.where(HealthDataPoint.element_id.in_(element_ids))
        if date_from:
            stmt = stmt.where(HealthDataPoint.observed_at >= date_from)
        if date_to:
            stmt = stmt.where(HealthDataPoint.observed_at < date_to + timedelta(days=1))

        rows = (await self.db.execute(stmt.limit(1000))).all()
        trends: dict[str, dict] = {}
        for row in rows:
            key = str(row.element_id)
            if key not in trends:
                trends[key] = {"element_id": key, "label": row.label, "unit": row.unit, "points": []}
            trends[key]["points"].append({
                "date": row.observed_at.isoformat() if row.observed_at else None,
                "value": float(row.value_number) if row.value_number is not None else None,
            })
        return list(trends.values())

    async def list_reports(self, user_id: uuid.UUID) -> list[Report]:
        result = await self.db.execute(
            select(Report)
            .where(Report.requested_by == user_id)
            .order_by(Report.created_at.desc())
            .limit(100)
        )
        return result.scalars().all()

    async def list_notifications(self, user_id: uuid.UUID) -> list[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
        return result.scalars().all()

    async def mark_notification_read(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> Notification:
        result = await self.db.execute(
            select(Notification).where(
                Notification.notification_id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        notification.status = "read"
        notification.read_at = datetime.now(timezone.utc)
        await self.db.flush()
        return notification

