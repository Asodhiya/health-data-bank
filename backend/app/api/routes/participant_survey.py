"""
Participant Survey Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.core.dependency import check_current_user, require_permissions
from app.db.models import User
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, ParticipantSurveyItem
from app.services.participant_survey_service import (list_assigned_surveys, get_participant_survey_detail, save_survey_response,get_participant_survey_response)

router = APIRouter()
#TODO:dependencies do not work as of the moment, needs it to be initialized in the database/or when testing, remove it

@router.get("/assigned", response_model=List[ParticipantSurveyItem], dependencies=[Depends(require_permissions("survey:list_assigned"))])
async def list_assigned_surveys_route(db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """List surveys assigned participant"""
    surveys = await list_assigned_surveys(current_user.user_id, db)
    return surveys


@router.get("/{form_id}", response_model=SurveyDetailOut, dependencies=[Depends(require_permissions("survey:read"))])
async def get_survey_detail_route(form_id: UUID,db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """Get details of a specific survey assigned to participant"""
    survey = await get_participant_survey_detail(form_id, current_user.user_id, db)
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found or not assigned")
    return survey

@router.get("/{form_id}/response", dependencies=[Depends(require_permissions("survey:read"))])
async def get_survey_response_route(form_id: UUID,db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """Get the existing submission (draft or completed) for a survey"""
    submission = await get_participant_survey_response(form_id, current_user.user_id, db)
    if not submission:
        return None # returns no submission if no draft or completed submission
    
    return {
        "submission_id": submission.submission_id,
        "status": "COMPLETED" if submission.submitted_at else "DRAFT",
        "submitted_at": submission.submitted_at,
        "answers": [
            {
                "field_id": ans.field_id,
                "value": ans.value_text or ans.value_number or ans.value_json or ans.value_date
            }
            for ans in submission.answers
        ]
    }

@router.post("/{form_id}/submit", dependencies=[Depends(require_permissions("survey:submit"))])
async def submit_survey_response_route(form_id: UUID,answers: List[dict], db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """Submit responses of a survey form (submit)"""
    try:
        submission = await save_survey_response(form_id, current_user.user_id, answers, db, is_draft=False)
        return {"message": "Survey submitted successfully", "submission_id": str(submission.submission_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit survey")


@router.post("/{form_id}/save", dependencies=[Depends(require_permissions("survey:submit"))])
async def save_survey_draft_route(form_id: UUID,answers: List[dict], db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """Save responses (NOT SUBMIT)"""
    try:
        submission = await save_survey_response(form_id, current_user.user_id, answers, db, is_draft=True)
        return {"message": "Draft saved successfully", "submission_id": str(submission.submission_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save draft")
