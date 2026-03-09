"""
Participant statistics routes.

Endpoints for retrieving personal health stats, data element breakdowns,
and group comparisons for the authenticated participant.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.db.session import get_db
from app.core.dependency import require_permissions

router = APIRouter()


@router.get("/me")
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Stats:View")),
):
    """
    Return a summary of the authenticated participant's health stats.
    """
    pass


@router.get("/me/elements")
async def get_my_elements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Stats:View")),
):
    """
    Return a breakdown of the participant's health data points by element.
    """
    pass


@router.get("/me/vs-group")
async def get_my_vs_group(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("Stats:View")),
):
    """
    Compare the participant's stats against their group's aggregate.
    """
    pass
