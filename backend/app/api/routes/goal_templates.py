"""
Goal Template Routes (Researcher / Admin)

Researchers and admins define goal templates linked to a DataElement.
Participants browse these templates and add them to their dashboard as
personal HealthGoal instances.
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.session import get_db
from app.db.models import User
from app.core.dependency import require_permissions
from app.core.permissions import GOAL_TEMPLATE_VIEW, GOAL_TEMPLATE_CREATE, GOAL_TEMPLATE_EDIT
from app.db.queries.Queries import GoalTemplateQuery
from app.schemas.schemas import GoalTemplateCreate, GoalTemplateUpdate
from app.services.notification_service import create_notifications_bulk

router = APIRouter()


@router.get("")
async def list_goal_templates(db: AsyncSession = Depends(get_db),
                               _=Depends(require_permissions(GOAL_TEMPLATE_VIEW))):
    """List all active goal templates with their linked data element."""
    return await GoalTemplateQuery(db).list_templates()


@router.post("")
async def create_goal_template(
    payload: GoalTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOAL_TEMPLATE_CREATE)),
):
    """Create a new goal template linked to a data element."""
    return await GoalTemplateQuery(db).create_template(payload, current_user.user_id)


@router.patch("/{template_id}")
async def update_goal_template(
    template_id: UUID,
    payload: GoalTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_EDIT)),
):
    """Update name, description, default target, or active status of a template."""
    return await GoalTemplateQuery(db).update_template(template_id, payload)


@router.get("/deleted")
async def list_deleted_templates(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_VIEW)),
):
    """List all soft-deleted goal templates."""
    return await GoalTemplateQuery(db).list_deleted_templates()


@router.post("/{template_id}/restore")
async def restore_goal_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_EDIT)),
):
    """Restore a soft-deleted goal template."""
    return await GoalTemplateQuery(db).restore_template(template_id)


@router.get("/{template_id}/stats")
async def get_goal_template_stats(
    template_id: UUID,
    granularity: str = Query(default="month", pattern="^(week|month|year)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_VIEW)),
):
    """Return participant tracking stats and chart data for a goal template."""
    return await GoalTemplateQuery(db).get_template_stats(template_id, granularity)


@router.get("/{template_id}/raw")
async def get_raw_datapoints(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_VIEW)),
):
    """Return raw individual data points for this template's metric."""
    return await GoalTemplateQuery(db).get_raw_datapoints(template_id)


@router.get("/{template_id}/export/summary")
async def export_summary(
    template_id: UUID,
    granularity: str = Query(default="month", pattern="^(week|month|year)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_VIEW)),
):
    """Download progress-over-time chart data as CSV."""
    csv = await GoalTemplateQuery(db).export_summary_csv(template_id, granularity)
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=goal_summary_{template_id}.csv"},
    )


@router.get("/{template_id}/export/raw")
async def export_raw(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_VIEW)),
):
    """Download all individual data points for this template's metric as CSV."""
    csv = await GoalTemplateQuery(db).export_raw_csv(template_id)
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=goal_raw_{template_id}.csv"},
    )


@router.delete("/{template_id}")
async def deactivate_goal_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOAL_TEMPLATE_EDIT)),
):
    """Soft-delete a goal template (sets is_active=False)."""
    result = await GoalTemplateQuery(db).delete_template(template_id)

    participant_user_ids = result.get("affected_participant_user_ids") or []
    if participant_user_ids:
        template_name = result.get("template_name") or "A goal template"
        await create_notifications_bulk(
            db=db,
            user_ids=participant_user_ids,
            notification_type="goal",
            title="Goal template retired",
            message=(
                f'The goal template "{template_name}" is no longer available for new use. '
                "Your existing goal will stay on your dashboard."
            ),
            link="/participant/healthgoals",
            role_target="participant",
            source_type="goal_template_deleted",
            source_id=template_id,
        )
        await db.commit()

    return {"detail": result.get("msg", "Template deleted")}
