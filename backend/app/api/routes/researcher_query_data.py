from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import FORM_VIEW
from app.core.config import settings
from app.schemas.filter_data_schema import (
    ParticipantFilter,
    ParticipantExportFilter,
    AvailableSurvey,
    TimeseriesFilter,
)
from app.services.filter_data_service import (
    get_survey_results_pivoted,
    get_survey_results_grouped,
    get_available_surveys,
    export_survey_results_csv,
    export_survey_results_excel,
    export_grouped_results_csv,
    export_grouped_results_excel,
    get_timeseries,
)

router = APIRouter()

@router.post("/results", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def get_survey_results(
    filters: ParticipantFilter,
    db: AsyncSession = Depends(get_db),
):
    """uses a survey_id to load in the submissions of the participants"""
    return await get_survey_results_pivoted(db, filters.survey_id, filters)


@router.post("/results/grouped", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def get_grouped_results(
    filters: ParticipantFilter,
    db: AsyncSession = Depends(get_db),
):
    if not filters.group_by:
        raise HTTPException(status_code=400, detail="group_by is required for this endpoint.")
    return await get_survey_results_grouped(db, filters.survey_id, filters)

@router.post("/results/download", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_survey_results_csv(
    filters: ParticipantExportFilter,
    db: AsyncSession = Depends(get_db),
):
    """Download survey results as a UTF-8 CSV file, respecting hidden columns."""
    return await export_survey_results_csv(
        db,
        filters.survey_id,
        filters,
        set(filters.exclude_columns),
    )


@router.post("/results/download.xlsx", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_survey_results_excel(
    filters: ParticipantExportFilter,
    db: AsyncSession = Depends(get_db),
):
    """Download survey results as an Excel workbook, respecting hidden columns."""
    return await export_survey_results_excel(
        db,
        filters.survey_id,
        filters,
        set(filters.exclude_columns),
    )


@router.post("/results/grouped/download", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_grouped_results_csv(
    filters: ParticipantExportFilter,
    db: AsyncSession = Depends(get_db),
):
    if not filters.group_by:
        raise HTTPException(status_code=400, detail="group_by is required for this endpoint.")
    return await export_grouped_results_csv(
        db,
        filters.survey_id,
        filters,
        set(filters.exclude_columns),
    )


@router.post("/results/grouped/download.xlsx", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_grouped_results_excel(
    filters: ParticipantExportFilter,
    db: AsyncSession = Depends(get_db),
):
    if not filters.group_by:
        raise HTTPException(status_code=400, detail="group_by is required for this endpoint.")
    return await export_grouped_results_excel(
        db,
        filters.survey_id,
        filters,
        set(filters.exclude_columns),
    )

@router.get("/available-surveys", response_model=List[AvailableSurvey], dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_available_surveys(db: AsyncSession = Depends(get_db)):
    """Get a list of all surveys with submissions (any status) for the data filter dropdown"""
    return await get_available_surveys(db)


@router.post("/timeseries", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def query_timeseries(
    filters: TimeseriesFilter,
    db: AsyncSession = Depends(get_db),
):
    return await get_timeseries(filters, db)


@router.get("/config", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def get_query_config():
    return {
        "min_cohort_size": settings.MIN_COHORT_SIZE,
        "min_cohort_size_raw": settings.MIN_COHORT_SIZE_RAW,
    }
