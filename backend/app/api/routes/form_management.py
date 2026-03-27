"""
Form Management Routes (Researcher)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from sqlalchemy import select

from app.db.session import get_db
from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import FORM_VIEW, FORM_CREATE, FORM_GET, FORM_UPDATE, FORM_DELETE, FORM_PUBLISH, FORM_UNPUBLISH
from app.db.models import User, Group
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate
from app.services.form_management_service import list_researcher_forms, create_survey_form, get_form_by_id, update_survey_form, delete_survey_form, publish_survey_form, unpublish_survey_form, unpublish_survey_form_all

router = APIRouter()


@router.get("/list", response_model=List[SurveyListItem],dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_all_forms(db: AsyncSession = Depends(get_db)):
    """List all surveys created by all researcher""" #all survey forms made by any researcher.
    forms = await list_researcher_forms(db)
    if forms is None:
        return [] #empty
    return forms

@router.post("/create", response_model=SurveyDetailOut, dependencies=[Depends(require_permissions(FORM_CREATE))])
async def create_form(form_data: SurveyCreate, db: AsyncSession = Depends(get_db),current_user: User = Depends(check_current_user)):
    """Create new survey form"""
    try:
        new_form = await create_survey_form(form_data, current_user.user_id, db)
        return new_form
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail=str(e))

@router.get("/detail/{form_id}", response_model=SurveyDetailOut, dependencies=[Depends(require_permissions(FORM_GET))])
async def get_form_detail(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get full details of form (questions and choices, etc.)"""
    try:
        get_form = await get_form_by_id(form_id, db)
        if get_form is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
        return get_form
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=str(e))

@router.put("/update/{form_id}", dependencies=[Depends(require_permissions(FORM_UPDATE))])
async def update_form(form_id: UUID, form_data: SurveyCreate, db: AsyncSession = Depends(get_db)):
    """Update existing form"""
    try:
        updated_form = await update_survey_form(form_id, form_data, db)
        return updated_form
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=str(e))

@router.delete("/delete/{form_id}", status_code=status.HTTP_200_OK, dependencies=[Depends(require_permissions(FORM_DELETE))])
async def delete_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete form"""
    try:
        delete = await delete_survey_form(form_id, db)
        return delete
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=str(e))

@router.post("/{form_id}/publish", dependencies=[Depends(require_permissions(FORM_PUBLISH))])
async def publish_form(form_id: UUID, group_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(check_current_user)):
    """Publish a form (make it available to participants)"""
    try:
        publish = await publish_survey_form(form_id, group_id, current_user.user_id, db)
        return publish
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=str(e))

@router.post("/{form_id}/unpublish/{group_id}", dependencies=[Depends(require_permissions(FORM_UNPUBLISH))])
async def unpublish_form(form_id: UUID, group_id: UUID, db: AsyncSession = Depends(get_db)):
    """Unpublish a form from a specific group. Reverts to DRAFT if no deployments remain."""
    return await unpublish_survey_form(form_id, group_id, db)


@router.post("/{form_id}/unpublish-all", dependencies=[Depends(require_permissions(FORM_UNPUBLISH))])
async def unpublish_form_all(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """Unpublish a form from all groups and revert to DRAFT."""
    return await unpublish_survey_form_all(form_id, db)

@router.get("/groups", dependencies=[Depends(require_permissions(FORM_PUBLISH))])
async def list_groups_for_publish(db: AsyncSession = Depends(get_db)):
    """List all groups available for publishing"""
    result = await db.execute(select(Group))
    groups = result.scalars().all()
    return [{"group_id": str(g.group_id), "name": g.name} for g in groups]
