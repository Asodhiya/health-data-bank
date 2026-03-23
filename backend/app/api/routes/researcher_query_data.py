from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import FORM_VIEW
from app.schemas.filter_data_schema import ParticipantFilter, AvailableSurvey
from app.services.filter_data_service import get_survey_results_pivoted, get_available_surveys
from starlette.responses import StreamingResponse
import io
import csv

router = APIRouter()

@router.get("/results", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def get_survey_results(survey_id: Optional[str] = Query(None, description="ID of the survey to fetch results for"),filters: ParticipantFilter = Depends(),db: AsyncSession = Depends(get_db)):
    """uses a survey_id to load in the submissions of the participants"""
    return await get_survey_results_pivoted(db, survey_id, filters)

@router.get("/results/download", dependencies=[Depends(require_permissions(FORM_VIEW))])
async def download_survey_results_csv(survey_id: Optional[str] = Query(None, description="ID of the survey to fetch results for"),filters: ParticipantFilter = Depends(),db: AsyncSession = Depends(get_db)):
    """Download survey results as a CSV file."""
    results = await get_survey_results_pivoted(db, survey_id, filters)
    
    if not results["data"]:
        return {"message": "No data to download for the given filters."}

    column_data = results["columns"]
    row_data = results["data"]

    header_map = {col["id"]: col["text"] for col in column_data}
    
    # Ensure consistent header order based on the first data row's keys
    ordered_keys = row_data[0].keys()
    headers = [header_map.get(key, key) for key in ordered_keys]

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(headers)
    
    for record in row_data:
        writer.writerow([record.get(key) for key in ordered_keys])
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=survey_results.csv"}
    )

@router.get("/available-surveys", response_model=List[AvailableSurvey], dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_available_surveys(db: AsyncSession = Depends(get_db)):
    """Get a list of all available (published) surveys for dropdowns on query param section"""
    return await get_available_surveys(db)
