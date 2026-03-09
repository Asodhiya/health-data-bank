"""
Goal Template Routes (Researcher / Admin)

Researchers and admins define goal templates linked to a DataElement.
Participants browse these templates and add them to their dashboard as
personal HealthGoal instances.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.session import get_db
from app.db.models import User
from app.core.dependency import require_permissions
from app.db.queries.Queries import GoalTemplateQuery
from app.schemas.schemas import GoalTemplateCreate, GoalTemplateUpdate

router = APIRouter()


@router.get("")
async def list_goal_templates(db: AsyncSession = Depends(get_db),
                               _=Depends(require_permissions("goal_template:view"))):
    """List all active goal templates with their linked data element."""
    return await GoalTemplateQuery(db).list_templates()


@router.post("")
async def create_goal_template(
    payload: GoalTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("goal_template:create")),
):
    """Create a new goal template linked to a data element."""
    return await GoalTemplateQuery(db).create_template(payload, current_user.user_id)


@router.patch("/{template_id}")
async def update_goal_template(
    template_id: UUID,
    payload: GoalTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("goal_template:edit")),
):
    """Update name, description, default target, or active status of a template."""
    return await GoalTemplateQuery(db).update_template(template_id, payload)


@router.delete("/{template_id}")
async def deactivate_goal_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("goal_template:edit")),
):
    """Soft-delete a goal template (sets is_active=False)."""
    await GoalTemplateQuery(db).delete_template(template_id)
