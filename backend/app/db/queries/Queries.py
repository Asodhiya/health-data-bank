from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from app.db.models import Role, User, UserRole, Permission, ParticipantProfile, CaretakerProfile, ResearcherProfile, SignupInvite, HealthGoal, GoalTemplate, DataElement, FieldElementMap, HealthDataPoint, FormDeployment, GroupMember, FormSubmission
from fastapi import HTTPException, status
import uuid
from sqlalchemy.exc import IntegrityError
from app.schemas.schemas import HealthGoalUpdate, GoalTemplateCreate, GoalTemplateUpdate
from app.schemas.data_element_schema import DataElementCreate

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
        return result.scalar_one_or_none()

    async def add_data_element(self,payload: DataElementCreate):
        data_element = DataElement(**payload.model_dump())
        self.db.add(data_element)
        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="data_element already exists")
        await self.db.refresh(data_element)
        return data_element

    async def delete_data_element(self, element_id: uuid.UUID):
        result = await self.db.execute(
            select(DataElement).where(
                DataElement.element_id == element_id,
            )
        )
        element = result.scalar_one_or_none()
        if not element:
            raise HTTPException(status_code=404, detail=" data element not found")

        await self.db.delete(element)
        await self.db.flush()

    async def map_field(self, field_id: uuid.UUID, element_id: uuid.UUID, transform_rule: dict | None = None):
        mapping = FieldElementMap(field_id=field_id, element_id=element_id, transform_rule=transform_rule)
        self.db.add(mapping)
        try:
            await self.db.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Field already mapped to this element")
        await self.db.refresh(mapping)
        return mapping

    async def get_field_mappings(self, field_id: uuid.UUID):
        result = await self.db.execute(
            select(FieldElementMap, DataElement)
            .join(DataElement, DataElement.element_id == FieldElementMap.element_id)
            .where(FieldElementMap.field_id == field_id)
        )
        return result.all()

    async def unmap_field(self, field_id: uuid.UUID, element_id: uuid.UUID):
        result = await self.db.execute(
            select(FieldElementMap).where(
                FieldElementMap.field_id == field_id,
                FieldElementMap.element_id == element_id,
            )
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        await self.db.delete(mapping)
        await self.db.flush()

class StatsQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_participant_summary(self, participant_id: uuid.UUID) -> dict:
        # Active forms: deployments for groups the participant belongs to, not revoked
        active_forms_result = await self.db.execute(
            select(func.count(distinct(FormDeployment.form_id)))
            .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
            .where(
                GroupMember.participant_id == participant_id,
                FormDeployment.revoked_at.is_(None),
            )
        )
        active_forms = active_forms_result.scalar() or 0

        # Forms filled today: distinct form_ids submitted on the current calendar day
        forms_filled_result = await self.db.execute(
            select
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
                func.date(HealthDataPoint.observed_at).func.current_date(),
            )
            .where(
                HealthDataPoint.participant_id == participant_id,
                HealthDataPoint.source_type == "health_goals",
            )
            .group_by(HealthDataPoint.element_id)
        )

        goals_met_result = await self.db.execute(
            select(func.count(HealthGoal.goal_id))
            .join(latest_obs, latest_obs.c.element_id == HealthGoal.element_id)
            .join(
                HealthDataPoint,
                (HealthDataPoint.element_id == HealthGoal.element_id)
                & (HealthDataPoint.observed_at == latest_obs.c.latest_at)
                & (HealthDataPoint.participant_id == participant_id)
                & (HealthDataPoint.source_type == "survey"),
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
        }

