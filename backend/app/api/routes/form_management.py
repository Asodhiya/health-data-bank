"""
Form Management Routes (Researcher)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from sqlalchemy import select
from datetime import datetime

from app.db.session import get_db
from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import FORM_VIEW, FORM_CREATE, FORM_GET, FORM_UPDATE, FORM_DELETE, FORM_PUBLISH, FORM_UNPUBLISH
from app.db.models import User, Group, FormDeployment, SurveyForm
from sqlalchemy import func
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate, SurveyListPage
from app.services.form_management_service import (
    list_researcher_forms,
    list_researcher_forms_paged,
    create_survey_form,
    get_form_by_id,
    update_survey_form,
    delete_survey_form,
    delete_form_family,
    branch_survey_form,
    publish_survey_form,
    get_publish_preview,
    unpublish_survey_form,
    unpublish_survey_form_all,
    archive_survey_form,
)
from typing import List as TypingList

router = APIRouter()


@router.get("/list", response_model=List[SurveyListItem],dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_all_forms(db: AsyncSession = Depends(get_db)):
    """List all surveys created by all researcher""" #all survey forms made by any researcher.
    forms = await list_researcher_forms(db)
    if forms is None:
        return [] #empty
    return forms

@router.get("/list-paged", response_model=SurveyListPage, dependencies=[Depends(require_permissions(FORM_VIEW))])
async def list_forms_paged(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default="ALL"),
    sort: str = Query(default="edited"),
    group_id: UUID | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    ownership_filter: str | None = Query(default="ALL"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    parsed_from = None
    parsed_to = None
    if date_from:
        parsed_from = datetime.fromisoformat(date_from)
    if date_to:
        parsed_to = datetime.fromisoformat(f"{date_to}T23:59:59.999999")

    return await list_researcher_forms_paged(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        sort=sort,
        group_id=group_id,
        date_from=parsed_from,
        date_to=parsed_to,
        ownership_filter=ownership_filter,
        current_user_id=current_user.user_id,
    )

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
async def update_form(
    form_id: UUID,
    form_data: SurveyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Update existing form"""
    try:
        updated_form = await update_survey_form(form_id, form_data, current_user.user_id, db)
        return updated_form
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=str(e))

@router.delete("/delete/{form_id}", status_code=status.HTTP_200_OK, dependencies=[Depends(require_permissions(FORM_DELETE))])
async def delete_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Delete a single form version"""
    try:
        return await delete_survey_form(form_id, current_user.user_id, db)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

@router.delete("/delete/{form_id}/family", status_code=status.HTTP_200_OK, dependencies=[Depends(require_permissions(FORM_DELETE))])
async def delete_form_family_route(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Delete all versions in a form family"""
    try:
        return await delete_form_family(form_id, current_user.user_id, db)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

@router.get("/{form_id}/publish-preview", dependencies=[Depends(require_permissions(FORM_PUBLISH))])
async def publish_preview(form_id: UUID, group_ids: str, db: AsyncSession = Depends(get_db)):
    """Return in-progress participant counts per group before publishing a new version."""
    parsed_ids = [UUID(gid.strip()) for gid in group_ids.split(",") if gid.strip()]
    return await get_publish_preview(form_id, parsed_ids, db)


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
async def unpublish_form(
    form_id: UUID,
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Unpublish a form from a specific group. Archives it if no deployments remain."""
    return await unpublish_survey_form(form_id, group_id, current_user.user_id, db)


@router.post("/{form_id}/unpublish-all", dependencies=[Depends(require_permissions(FORM_UNPUBLISH))])
async def unpublish_form_all(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Unpublish a form from all groups and archive it."""
    return await unpublish_survey_form_all(form_id, current_user.user_id, db)


@router.post("/{form_id}/branch", dependencies=[Depends(require_permissions(FORM_CREATE))])
async def branch_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Create a new draft version branched from an existing form."""
    return await branch_survey_form(form_id, current_user.user_id, db)


@router.post("/{form_id}/archive", dependencies=[Depends(require_permissions(FORM_UPDATE))])
async def archive_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Archive a draft form so it no longer appears as active work."""
    return await archive_survey_form(form_id, current_user.user_id, db)



@router.get("/groups", dependencies=[Depends(require_permissions(FORM_PUBLISH))])
async def list_groups_for_publish(db: AsyncSession = Depends(get_db)):
    """List all groups with description and active member count."""
    from app.db.models import GroupMember
    from sqlalchemy import func, outerjoin
    result = await db.execute(
        select(
            Group.group_id,
            Group.name,
            Group.description,
            func.count(GroupMember.participant_id).filter(GroupMember.left_at == None).label("member_count"),
        )
        .outerjoin(GroupMember, GroupMember.group_id == Group.group_id)
        .group_by(Group.group_id, Group.name, Group.description)
        .order_by(Group.name)
    )
    return [
        {
            "group_id": str(row.group_id),
            "name": row.name,
            "description": row.description or "",
            "member_count": row.member_count,
        }
        for row in result.all()
    ]


@router.get("/groups/{group_id}/surveys", dependencies=[Depends(require_permissions(FORM_PUBLISH))])
async def list_surveys_for_group(group_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all survey forms deployed to a specific group."""
    from app.db.models import FormSubmission
    result = await db.execute(
        select(
            SurveyForm.form_id,
            SurveyForm.title,
            SurveyForm.status,
            SurveyForm.version,
            FormDeployment.deployed_at,
            FormDeployment.revoked_at,
            func.count(FormSubmission.submission_id).label("submission_count"),
        )
        .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
        .outerjoin(
            FormSubmission,
            (FormSubmission.form_id == SurveyForm.form_id) & (FormSubmission.group_id == group_id),
        )
        .where(FormDeployment.group_id == group_id)
        .group_by(
            SurveyForm.form_id,
            SurveyForm.title,
            SurveyForm.status,
            SurveyForm.version,
            FormDeployment.deployed_at,
            FormDeployment.revoked_at,
        )
        .order_by(FormDeployment.deployed_at.desc())
    )
    return [
        {
            "form_id": str(row.form_id),
            "title": row.title,
            "status": "UNPUBLISHED" if row.revoked_at else row.status,
            "version": row.version,
            "deployed_at": row.deployed_at.isoformat() if row.deployed_at else None,
            "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
            "submission_count": row.submission_count,
        }
        for row in result.all()
    ]
