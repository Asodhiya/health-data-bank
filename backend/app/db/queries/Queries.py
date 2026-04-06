from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, case, and_, or_
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

    async def add_goal_from_template(self, participant_id: uuid.UUID, template_id: uuid.UUID, target_value: float | None = None):
        participants_goal = await self.get_goals(participant_id)
        if len(participants_goal) >= 10:
            raise HTTPException(status_code=400, detail="Maximum 10 goals allowed")
        template = await self.db.get(GoalTemplate, template_id)
        if not template or not template.is_active:
            raise HTTPException(status_code=404, detail="Goal template not found")
        existing_active = await self.db.execute(
            select(HealthGoal.goal_id)
            .where(HealthGoal.participant_id == participant_id)
            .where(HealthGoal.element_id == template.element_id)
            .where(HealthGoal.status == "active")
            .limit(1)
        )
        if existing_active.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="An active goal for this metric already exists.",
            )

        goal = HealthGoal(
            participant_id=participant_id,
            template_id=template.template_id,
            element_id=template.element_id,
            target_value=target_value if target_value is not None else template.default_target,
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

    async def delete_template(self, template_id: uuid.UUID):
        template = await self.db.get(GoalTemplate, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Goal template not found")
        template.is_active = False
        await self.db.flush()


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
        try:
            await self.db.delete(element)
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Cannot delete data element: it is referenced by existing mappings or health data points")

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

    


class CaretakersQuery:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_groups(self, user_id: uuid.UUID) -> list[Group]:
        result = await self.db.execute(
            select(Group)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(CaretakerProfile.user_id == user_id)
        )
        return result.scalars().all()
    


    async def get_group(self, group_id: uuid.UUID, user_id: uuid.UUID) -> Group:
        result = await self.db.execute(
            select(Group)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(Group.group_id == group_id, CaretakerProfile.user_id == user_id)
        )
        group = result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found or not assigned to you")
        return group

    async def get_group_participants(self, group_id: uuid.UUID, user_id: uuid.UUID):
        result = await self.db.execute(
            select(ParticipantProfile, User.first_name, User.last_name, GroupMember.joined_at)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .where(GroupMember.group_id == group_id)
            .where(GroupMember.left_at == None)
        )
        return result.all()

    async def get_group_participant(self, group_id: uuid.UUID, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(ParticipantProfile, User.first_name, User.last_name, GroupMember.joined_at)
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .where(GroupMember.group_id == group_id)
            .where(ParticipantProfile.participant_id == participant_id)
            .where(GroupMember.left_at == None)
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
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .where(GroupMember.participant_id == participant_id)
            .where(GroupMember.left_at == None)
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
            select(activity_expr, func.count(ParticipantProfile.participant_id).label("cnt"))
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .outerjoin(last_submission_sq, last_submission_sq.c.participant_id == ParticipantProfile.participant_id)
            .where(CaretakerProfile.user_id == user_id)
            .where(GroupMember.left_at == None)
            .group_by(activity_expr)
        )
        if group_id:
            stmt = stmt.where(GroupMember.group_id == group_id)

        rows = (await self.db.execute(stmt)).all()
        counts = {"highly_active": 0, "moderately_active": 0, "low_active": 0, "inactive": 0}
        for row in rows:
            counts[row.activity] = row.cnt
        return counts

    async def _compute_goal_progress_map(self, participant_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
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
        progress_map: dict[uuid.UUID, str] = {}
        for pid in participant_ids:
            goals = grouped.get(pid, [])
            if not goals:
                progress_map[pid] = "not_started"
                continue

            completed_count = 0
            for goal, datatype in goals:
                current = await participant_query._compute_goal_current_value(
                    goal, datatype, pid, as_of=datetime.now(timezone.utc)
                )
                if participant_query._goal_completed(goal, current):
                    completed_count += 1

            if completed_count == 0:
                progress_map[pid] = "in_progress"
            elif completed_count == len(goals):
                progress_map[pid] = "completed"
            else:
                progress_map[pid] = "in_progress"

        return progress_map

    async def get_participants(
        self,
        user_id: uuid.UUID,
        group_id: uuid.UUID | None = None,
        status: str | None = None,
        gender: str | None = None,
        age_min: int | None = None,
        age_max: int | None = None,
        has_alerts: bool | None = None,
        survey_progress: str | None = None,
        # goal_progress: str | None = None,
        sort_by: str | None = None,
        submission_date_from: date | None = None,
        submission_date_to: date | None = None,
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
                func.count(distinct(FormSubmission.form_id)).label("submitted_count"),
                func.cast(func.max(FormSubmission.submitted_at), SADate).label("last_submission_at"),
            )
            .where(FormSubmission.participant_id.in_(caretaker_participants_sq))
        )
        if submission_date_from:
            submissions_stmt = submissions_stmt.where(FormSubmission.submitted_at >= datetime.combine(submission_date_from, time.min).replace(tzinfo=timezone.utc))
        if submission_date_to:
            submissions_stmt = submissions_stmt.where(FormSubmission.submitted_at < datetime.combine(submission_date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc))
        submissions_sq = submissions_stmt.group_by(FormSubmission.participant_id).subquery()

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
                ParticipantProfile.gender,
                age_expr.label("age"),
                status_expr.label("status"),
                GroupMember.group_id,
                survey_progress_expr.label("survey_progress"),
                User.last_login_at,
                submissions_sq.c.last_submission_at,
            )
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .outerjoin(deployed_sq, deployed_sq.c.group_id == GroupMember.group_id)
            .outerjoin(submissions_sq, submissions_sq.c.participant_id == ParticipantProfile.participant_id)
            .where(CaretakerProfile.user_id == user_id)
        )

        # ── Filters ───────────────────────────────────────────────────────────
        if group_id:
            stmt = stmt.where(GroupMember.group_id == group_id)
        if status in ("highly_active", "moderately_active", "low_active", "inactive"):
            stmt = stmt.where(status_expr == status)
        if gender:
            stmt = stmt.where(ParticipantProfile.gender == gender)
        if age_min is not None:
            stmt = stmt.where(age_expr >= age_min)
        if age_max is not None:
            stmt = stmt.where(age_expr <= age_max)
        if has_alerts is True:
            stmt = stmt.where(submissions_sq.c.submitted_count < deployed_sq.c.deployed_count)
        if survey_progress:
            stmt = stmt.where(survey_progress_expr == survey_progress)

        # ── Sorting ───────────────────────────────────────────────────────────
        if sort_by == "name":
            stmt = stmt.order_by(User.first_name, User.last_name)
        elif sort_by == "age":
            stmt = stmt.order_by(age_expr)
        elif sort_by == "status":
            stmt = stmt.order_by(status_expr)
        elif sort_by == "gender":
            stmt = stmt.order_by(ParticipantProfile.gender)
        elif sort_by == "surveys":
            stmt = stmt.order_by(survey_progress_expr)
        elif sort_by == "last_active":
            stmt = stmt.order_by(User.last_login_at.desc())
        elif sort_by == "enrolled":
            stmt = stmt.order_by(GroupMember.joined_at.desc())
        elif sort_by == "submission_date":
            stmt = stmt.order_by(submissions_sq.c.last_submission_at.desc())

        result = await self.db.execute(stmt)
        rows = result.all()

        participant_ids = [row.participant_id for row in rows]
        progress_map = await self._compute_goal_progress_map(participant_ids)
        output_rows = []
        for row in rows:
            output_rows.append(
                SimpleNamespace(
                    participant_id=row.participant_id,
                    first_name=row.first_name,
                    last_name=row.last_name,
                    gender=row.gender,
                    age=row.age,
                    status=row.status,
                    group_id=row.group_id,
                    survey_progress=row.survey_progress,
                    goal_progress=progress_map.get(row.participant_id, "not_started"),
                    last_login_at=row.last_login_at,
                    last_submission_at=row.last_submission_at,
                )
            )

        if sort_by == "goals":
            order = {"not_started": 0, "in_progress": 1, "completed": 2}
            output_rows.sort(key=lambda r: order.get(r.goal_progress, 0))

        return output_rows

    async def get_participant_submissions(
        self,
        participant_id: uuid.UUID,
        date_from: date | None = None,
        date_to: date | None = None,
    ):
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

    async def get_group_elements(self, group_id: uuid.UUID):
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

    async def list_feedback(self, participant_id: uuid.UUID) -> list[CaretakerFeedback]:
        result = await self.db.execute(
            select(CaretakerFeedback)
            .where(CaretakerFeedback.participant_id == participant_id)
            .order_by(CaretakerFeedback.created_at.desc())
        )
        return result.scalars().all()

    async def get_submission_detail(
        self, participant_id: uuid.UUID, submission_id: uuid.UUID
    ):
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

    async def get_participant_goals(self, participant_id: uuid.UUID):
        return await ParticipantQuery(self.db).get_goals(participant_id)

    async def get_health_trends(
        self,
        participant_id: uuid.UUID,
        element_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
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

