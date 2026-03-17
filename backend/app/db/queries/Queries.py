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
from datetime import date, datetime, timezone, timedelta
from app.db.models import FormField

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

        
    async def get_goals(self, participant_id: uuid.UUID):
        result = await self.db.execute(
            select(HealthGoal, DataElement)
            .join(DataElement, DataElement.element_id == HealthGoal.element_id)
            .where(HealthGoal.participant_id == participant_id)
        )
        return [
            {**goal.__dict__, "name": element.label, "element": element}
            for goal, element in result.all()
        ]

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
        return {**goal.__dict__, "name": element.label, "element": element}
    
    def _goal_data_point(self, participant_id: uuid.UUID, goal: HealthGoal) -> HealthDataPoint:
        """Create a HealthDataPoint snapshot representing the goal's target value."""
        return HealthDataPoint(
            participant_id=participant_id,
            element_id=goal.element_id,
            observed_at=datetime.now(timezone.utc),
            source_type="goal",
            source_submission_id=None,
            source_field_id=None,
            value_number=float(goal.target_value) if goal.target_value is not None else None,
        )

    async def add_goal_from_template(self, participant_id: uuid.UUID, template_id: uuid.UUID, target_value: float | None = None):
        participants_goal = await self.get_goals(participant_id)
        if len(participants_goal) >= 10:
            raise HTTPException(status_code=400, detail="Maximum 10 goals allowed")
        template = await self.db.get(GoalTemplate, template_id)
        if not template or not template.is_active:
            raise HTTPException(status_code=404, detail="Goal template not found")

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
        self.db.add(self._goal_data_point(participant_id, goal))
        await self.db.flush()
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

        target_changed = (
            update_data.target_value is not None
            and update_data.target_value != goal.target_value
        )

        for field, value in update_data.model_dump(exclude_none=True).items():
            setattr(goal, field, value)

        await self.db.flush()
        await self.db.refresh(goal)

        if target_changed:
            self.db.add(self._goal_data_point(participant_id, goal))
            await self.db.flush()

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
            select(HealthGoal).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        today = datetime.now(timezone.utc).date()
        entry_result = await self.db.execute(
            select(HealthDataPoint).where(
                HealthDataPoint.participant_id == participant_id,
                HealthDataPoint.element_id == goal.element_id,
                HealthDataPoint.source_type == "goal",
                func.date(HealthDataPoint.observed_at) == today,
            ).limit(1)
        )
        entry = entry_result.scalar_one_or_none()

        current_value = float(entry.value_number) if entry and entry.value_number is not None else 0.0
        target = float(goal.target_value) if goal.target_value is not None else None
        return {
            "goal_id": goal_id,
            "date": today,
            "current_value": current_value,
            "target_value": target,
            "completed": (current_value >= target) if target is not None else False,
        }

    async def log_progress(self, goal_id: uuid.UUID, participant_id: uuid.UUID, payload: GoalProgressLog):
        result = await self.db.execute(
            select(HealthGoal).where(
                HealthGoal.goal_id == goal_id,
                HealthGoal.participant_id == participant_id
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        log_date = (payload.observed_at or datetime.now(timezone.utc)).date()

        # Look for an existing goal data point for this element today
        existing_result = await self.db.execute(
            select(HealthDataPoint).where(
                HealthDataPoint.participant_id == participant_id,
                HealthDataPoint.element_id == goal.element_id,
                HealthDataPoint.source_type == "goal",
                func.date(HealthDataPoint.observed_at) == log_date,
            ).order_by(HealthDataPoint.observed_at.desc()).limit(1)
        )
        data_point = existing_result.scalar_one_or_none()

        if data_point:
            data_point.value_number = float(data_point.value_number or 0) + payload.value
            if payload.notes:
                data_point.notes = payload.notes
        else:
            data_point = HealthDataPoint(
                participant_id=participant_id,
                element_id=goal.element_id,
                observed_at=payload.observed_at or datetime.now(timezone.utc),
                source_type="goal",
                value_number=payload.value,
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

        # Forms filled today: distinct form_ids submitted on the current calendar day
        forms_filled_result = await self.db.execute(
            select(func.count(distinct(FormSubmission.form_id)))
            .where(
                FormSubmission.participant_id == participant_id,
                func.date(FormSubmission.submitted_at) == date.today()
            )
        )
        forms_filled = forms_filled_result.scalar() or 0

        # Active goals count
        active_goals_result = await self.db.execute(
            select(func.count(HealthGoal.goal_id))
            .where(HealthGoal.participant_id == participant_id)
        )
        active_goals = active_goals_result.scalar() or 0

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
                func.date(HealthDataPoint.observed_at) == date.today(),
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
            stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) >= date_from)
        if date_to:
            stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) <= date_to)

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
        # Check if the group exists at all
        result = await self.db.execute(
            select(Group).where(Group.group_id == group_id)
        )
        group = result.scalar_one_or_none()

        if not group:
            raise HTTPException(status_code=404, detail="No group found with that id")

        # Check if this group belongs to the current caretaker via user_id
        caretaker = await self.db.execute(
            select(CaretakerProfile).where(CaretakerProfile.user_id == user_id)
        )
        caretaker_profile = caretaker.scalar_one_or_none()

        if not caretaker_profile or group.caretaker_id != caretaker_profile.caretaker_id:
            raise HTTPException(status_code=403, detail="This group is not assigned to you")

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

    async def get_participant_activity_counts(self, user_id: uuid.UUID, group_id: uuid.UUID | None = None):
        today = date.today()
        last_submission_sq = (
            select(
                FormSubmission.participant_id,
                func.max(func.cast(FormSubmission.submitted_at, SADate)).label("last_submission_at"),
            )
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

        submissions_stmt = (
            select(
                FormSubmission.participant_id,
                func.count(distinct(FormSubmission.form_id)).label("submitted_count"),
                func.cast(func.max(FormSubmission.submitted_at), SADate).label("last_submission_at"),
            )
        )
        if submission_date_from:
            submissions_stmt = submissions_stmt.where(func.cast(FormSubmission.submitted_at, SADate) >= submission_date_from)
        if submission_date_to:
            submissions_stmt = submissions_stmt.where(func.cast(FormSubmission.submitted_at, SADate) <= submission_date_to)
        submissions_sq = submissions_stmt.group_by(FormSubmission.participant_id).subquery()

        # Goals reset daily — progress is based on today's HealthDataPoint vs target
        # target_date = goal_date_from or date.today()
        # goals_stmt = (
        #     select(
        #         HealthGoal.participant_id,
        #         func.count(HealthGoal.goal_id).label("total_goals"),
        #         func.count(
        #             case(
        #                 (and_(
        #                     HealthDataPoint.value_number != None,
        #                     HealthDataPoint.value_number >= HealthGoal.target_value,
        #                 ), HealthGoal.goal_id),
        #                 else_=None,
        #             )
        #         ).label("completed_goals"),
        #     )
        #     .outerjoin(HealthDataPoint, and_(
        #         HealthDataPoint.participant_id == HealthGoal.participant_id,
        #         HealthDataPoint.element_id == HealthGoal.element_id,
        #         HealthDataPoint.source_type == "goal",
        #         func.cast(HealthDataPoint.observed_at, date) == target_date,
        #     ))
        #     .where(HealthGoal.status == "active")
        #)
        # goals_sq = goals_stmt.group_by(HealthGoal.participant_id).subquery()


        age_expr = func.date_part("year", func.age(ParticipantProfile.dob))

        survey_progress_expr = case(
            (or_(submissions_sq.c.submitted_count == None, submissions_sq.c.submitted_count == 0), "not_started"),
            (submissions_sq.c.submitted_count >= deployed_sq.c.deployed_count, "completed"),
            else_="in_progress",
        )

        # goal_progress_expr = case(
        #     (or_(goals_sq.c.total_goals == None, goals_sq.c.total_goals == 0), "not_started"),
        #     (goals_sq.c.completed_goals == goals_sq.c.total_goals, "completed"),
        #     else_="in_progress",
        # )

        today = date.today()
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
                # goal_progress_expr.label("goal_progress"),
                User.last_login_at,
                submissions_sq.c.last_submission_at,
            )
            .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(CaretakerProfile, CaretakerProfile.caretaker_id == Group.caretaker_id)
            .join(User, User.user_id == ParticipantProfile.user_id)
            .outerjoin(deployed_sq, deployed_sq.c.group_id == GroupMember.group_id)
            .outerjoin(submissions_sq, submissions_sq.c.participant_id == ParticipantProfile.participant_id)
            # .outerjoin(goals_sq, goals_sq.c.participant_id == ParticipantProfile.participant_id)
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
        # if goal_progress:
        #     stmt = stmt.where(goal_progress_expr == goal_progress)

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
        # elif sort_by == "goals":
        #     stmt = stmt.order_by(goal_progress_expr)
        elif sort_by == "last_active":
            stmt = stmt.order_by(User.last_login_at.desc())
        elif sort_by == "enrolled":
            stmt = stmt.order_by(GroupMember.joined_at.desc())
        elif sort_by == "submission_date":
            stmt = stmt.order_by(submissions_sq.c.last_submission_at.desc())

        result = await self.db.execute(stmt)
        return result.all()

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
                func.cast(FormSubmission.submitted_at, SADate).label("submitted_at"),
            )
            .join(SurveyForm, SurveyForm.form_id == FormSubmission.form_id)
            .where(FormSubmission.participant_id == participant_id)
            .order_by(FormSubmission.submitted_at.desc())
        )

        if date_from:
            stmt = stmt.where(func.cast(FormSubmission.submitted_at, SADate) >= date_from)
        if date_to:
            stmt = stmt.where(func.cast(FormSubmission.submitted_at, SADate) <= date_to)

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
            stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) >= date_from)
        if date_to:
            stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) <= date_to)

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
                stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) >= date_from)
            if date_to:
                stmt = stmt.where(func.cast(HealthDataPoint.observed_at, SADate) <= date_to)
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
        caretaker_result = await self.db.execute(
            select(CaretakerProfile).where(CaretakerProfile.user_id == caretaker_user_id)
        )
        caretaker = caretaker_result.scalar_one_or_none()
        if not caretaker:
            raise HTTPException(status_code=403, detail="Caretaker profile not found")

        participant_result = await self.db.execute(
            select(ParticipantProfile).where(ParticipantProfile.participant_id == participant_id)
        )
        participant = participant_result.scalar_one_or_none()
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")

        feedback = CaretakerFeedback(
            caretaker_id=caretaker.caretaker_id,
            participant_id=participant_id,
            submission_id=submission_id,
            message=message,
        )
        self.db.add(feedback)
        await self.db.flush()

        notification = Notification(
            user_id=participant.user_id,
            type="feedback",
            title="New feedback from your caretaker",
            message=message[:200],
            source_type="caretaker_feedback",
            source_id=feedback.feedback_id,
        )
        self.db.add(notification)
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
                func.cast(FormSubmission.submitted_at, SADate).label("submitted_at"),
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
                SubmissionAnswer.answer_id,
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

        rows = (await self.db.execute(stmt)).all()
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
        )
        return result.scalars().all()

    async def list_notifications(self, user_id: uuid.UUID) -> list[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
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

