

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import STATS_VIEW
from app.db.queries.Queries import StatsQuery,get_participant_id
router = APIRouter()


@router.get("/stats_me")
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    stats_queries = StatsQuery(db)
    participant_id = get_participant_id(current_user)
    return await stats_queries.get_participant_summary(participant_id)


@router.get("/me/elements")
async def get_my_elements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    """
    Return a breakdown of the participant's health data points by element.
    """
    pass


@router.get("/me/vs-group")
async def get_my_vs_group(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    """
    Compare the participant's stats against their group's aggregate.
    """
    pass
