from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import FORM_VIEW
from app.schemas.filter_data_schema import ParticipantFilter, AvailableSurvey
from app.services.filter_data_service import (
    get_survey_results_pivoted,
    get_available_surveys,
    export_survey_results_csv,
    export_survey_results_excel,
)

router = APIRouter()

@router.get("/results", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def get_survey_results(
    survey_id: Optional[str] = Query(None, description="ID of the survey to fetch results for"),
    group_ids: List[str] = Query(default=[]),
    primary_language: List[str] = Query(default=[]),
    filters: ParticipantFilter = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """uses a survey_id to load in the submissions of the participants"""
    if group_ids:
        from uuid import UUID as _UUID
        filters.group_ids = [_UUID(g) for g in group_ids]
    if primary_language:
        filters.primary_language = primary_language
    return await get_survey_results_pivoted(db, survey_id, filters)

@router.get("/results/download", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_survey_results_csv(
    survey_id: Optional[str] = Query(None),
    exclude_columns: Optional[str] = Query(None, description="Comma-separated column IDs to exclude"),
    group_ids: List[str] = Query(default=[]),
    primary_language: List[str] = Query(default=[]),
    filters: ParticipantFilter = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Download survey results as a UTF-8 CSV file, respecting hidden columns."""
    if group_ids:
        from uuid import UUID as _UUID
        filters.group_ids = [_UUID(g) for g in group_ids]
    if primary_language:
        filters.primary_language = primary_language
    excluded = set(exclude_columns.split(",")) if exclude_columns else set()
    return await export_survey_results_csv(db, survey_id, filters, excluded)


@router.get("/results/download.xlsx", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_survey_results_excel(
    survey_id: Optional[str] = Query(None),
    exclude_columns: Optional[str] = Query(None, description="Comma-separated column IDs to exclude"),
    group_ids: List[str] = Query(default=[]),
    primary_language: List[str] = Query(default=[]),
    filters: ParticipantFilter = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Download survey results as an Excel workbook, respecting hidden columns."""
    if group_ids:
        from uuid import UUID as _UUID
        filters.group_ids = [_UUID(g) for g in group_ids]
    if primary_language:
        filters.primary_language = primary_language
    excluded = set(exclude_columns.split(",")) if exclude_columns else set()
    return await export_survey_results_excel(db, survey_id, filters, excluded)

@router.get("/available-surveys", response_model=List[AvailableSurvey], dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_available_surveys(db: AsyncSession = Depends(get_db)):
    """Get a list of all surveys with submissions (any status) for the data filter dropdown"""
    return await get_available_surveys(db)


