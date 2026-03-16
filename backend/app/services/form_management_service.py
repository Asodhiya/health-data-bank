"""
researcher form service
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional

from app.db.models import SurveyForm, FormField, FieldOption, FormDeployment, Group
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate

async def create_survey_form(form_data: SurveyCreate, user_id: UUID, db: AsyncSession) -> SurveyForm:
    """Creates a new survey form with all its fields and options"""
    existing_form = await db.execute(
        select(SurveyForm).where(SurveyForm.title == form_data.title,SurveyForm.created_by == user_id)
    )
    if existing_form.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"You already have a form titled '{form_data.title}'. Use a different title.")

    new_form = SurveyForm(
        title=form_data.title,
        description=form_data.description,
        status="DRAFT",
        created_by=user_id
    )
    db.add(new_form)
    await db.flush()

    for field_in in form_data.fields:
        new_field = FormField(
            form_id=new_form.form_id,
            label=field_in.label,
            field_type=field_in.field_type,
            is_required=field_in.is_required,
            display_order=field_in.display_order
        )
        db.add(new_field)
        await db.flush()

        for option_in in field_in.options:
            new_option = FieldOption(
                field_id=new_field.field_id,
                label=option_in.label,
                value=option_in.value,
                display_order=option_in.display_order
            )
            db.add(new_option)

    await db.commit()


    query = (select(SurveyForm).where(SurveyForm.form_id == new_form.form_id).options(selectinload(SurveyForm.fields).selectinload(FormField.options)))
    result = await db.execute(query)
    full_form = result.scalar_one()

    return full_form

async def list_researcher_forms(db: AsyncSession):
    """List all researcher forms""" #the entire researcher forms
    query = select(SurveyForm).options(selectinload(SurveyForm.fields).selectinload(FormField.options)).order_by(desc(SurveyForm.created_at))
    result = await db.execute(query)
    return result.scalars().all()

async def get_form_by_id(form_id: UUID, db: AsyncSession) -> Optional[SurveyForm]:
    """Get forms by ID"""
    query = select(SurveyForm).where(SurveyForm.form_id == form_id).options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def update_survey_form(form_id: UUID,form_data: SurveyCreate,user_id: UUID,db: AsyncSession):
    """Update an existing form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.created_by != user_id:
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can edit it.")

    if form.status == "PUBLISHED":
        raise HTTPException(status_code=400, detail="Published forms cannot be edited. Unpublish the form first.")

    form.fields = []
    await db.flush()

    for field_in in form_data.fields:
        new_field = FormField(
            form_id=form.form_id,  # Link to existing form
            label=field_in.label,
            field_type=field_in.field_type,
            is_required=field_in.is_required,
            display_order=field_in.display_order
        )
        db.add(new_field)
        await db.flush()

        for option_in in field_in.options:
            new_option = FieldOption(
                field_id=new_field.field_id,
                label=option_in.label,
                value=option_in.value,
                display_order=option_in.display_order
            )
            db.add(new_option)

    form.title = form_data.title
    form.description = form_data.description

    await db.commit()
    return {"msg": "form updated"}

async def delete_survey_form(form_id: UUID,user_id: UUID,db: AsyncSession):
    """Delete form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.created_by != user_id:
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can delete it.")

    await db.delete(form)
    await db.commit()
    return {"msg": "form deleted"}


async def publish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Publish form and assign to a group"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.created_by != user_id:
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can publish it.")

    group_query = select(Group).where(Group.group_id == group_id)
    group_result = await db.execute(group_query)
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found. Make sure the group exists before publishing.")

    existing_deployment = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id, FormDeployment.group_id == group_id)
    )
    if existing_deployment.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This form is already deployed to that group.")

    deployment = FormDeployment(
        form_id=form_id,
        group_id=group_id,
        deployed_by=user_id
    )
    db.add(deployment)

    form.status = "PUBLISHED"
    await db.commit()
    return {"msg": "form has been published and assigned to group"}


async def unpublish_survey_form_all(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from all groups and revert to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.created_by != user_id:
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can unpublish it.")

    if form.status != "PUBLISHED":
        raise HTTPException(status_code=400, detail="This form is not currently published.")

    deployment_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id)
    )
    deployments = deployment_result.scalars().all()
    for deployment in deployments:
        await db.delete(deployment)

    form.status = "DRAFT"
    await db.commit()
    return {"msg": f"Form unpublished from all {len(deployments)} group(s) and reverted to DRAFT."}


async def unpublish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from a specific group. If no deployments remain, form reverts to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.created_by != user_id:
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can unpublish it.")

    deployment_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id, FormDeployment.group_id == group_id)
    )
    deployment = deployment_result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="This form is not deployed to that group.")

    await db.delete(deployment)

    # Check if any deployments remain — if none, revert form to DRAFT
    remaining_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id)
    )
    remaining = remaining_result.scalars().all()
    if not remaining:
        form.status = "DRAFT"

    await db.commit()

    if form.status == "DRAFT":
        return {"msg": "Form unpublished from group and reverted to DRAFT — no remaining deployments."}
    return {"msg": "Form unpublished from group. Still deployed to other groups."}
