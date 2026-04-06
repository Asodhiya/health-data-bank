from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date
from uuid import UUID

from app.db.models import User, GroupMember
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import STATS_VIEW
from app.db.queries.Queries import StatsQuery, CaretakersQuery, get_participant_id
from sqlalchemy import select

router = APIRouter()


@router.get("/stats_me")
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    participant_id = get_participant_id(current_user)
    return await StatsQuery(db).get_participant_summary(participant_id)


@router.get("/me/available-elements")
async def get_my_available_elements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    participant_id = get_participant_id(current_user)
    rows = await StatsQuery(db).get_available_elements(participant_id)
    return [
        {"element_id": str(row.element_id), "code": row.code, "label": row.label, "unit": row.unit, "datatype": row.datatype}
        for row in rows
    ]


@router.get("/me/elements")
async def get_my_elements(
    element_ids: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    participant_id = get_participant_id(current_user)
    return await StatsQuery(db).get_participant_element_stats(participant_id, element_ids, date_from, date_to)


@router.get("/me/health-timeseries")
async def get_my_health_timeseries(
    element_ids: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    participant_id = get_participant_id(current_user)
    return await StatsQuery(db).get_participant_health_timeseries(
        participant_id,
        element_ids,
        date_from,
        date_to,
    )


@router.get("/me/vs-group")
async def get_my_vs_group(
    element_ids: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(STATS_VIEW)),
):
    participant_id = get_participant_id(current_user)

    result = await db.execute(
        select(GroupMember.group_id)
        .where(GroupMember.participant_id == participant_id)
        .where(GroupMember.left_at == None)
        .limit(1)
    )
    group_id = result.scalar_one_or_none()
    if not group_id:
        raise HTTPException(status_code=404, detail="You are not in any active group")

    report = await CaretakersQuery(db).generate_comparison_report(
        participant_id=participant_id,
        requested_by=current_user.user_id,
        compare_with="group",
        group_id=group_id,
        element_ids=element_ids,
        date_from=date_from,
        date_to=date_to,
    )
    return report.parameters.get("payload", {})
