"""
researcher form service
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional

from app.db.models import SurveyForm, FormField, FieldOption, User
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate

async def create_survey_form(form_data: SurveyCreate, user_id: UUID, db: AsyncSession) -> SurveyForm:
    """Creates a new survey form with all its fields and options"""
    existing_form = await db.execute(
        select(SurveyForm).where(SurveyForm.title == form_data.title,SurveyForm.created_by == user_id)
    )
    if existing_form.scalar_one_or_none():
        raise ValueError(form_data.title + " already exists.")

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
    query = select(SurveyForm).order_by(desc(SurveyForm.created_at))
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
        return None
    
    if form.created_by != user_id:
        raise PermissionError("Not authorized to update this form")

    if form.status == "PUBLISHED" and form.status == "ARCHIVED":
        raise ValueError("Cannot edit a published/archived form")

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
        return {"msg": "form not found"}
        
    if form.created_by != user_id:
        raise PermissionError("Not authorized to delete this form")

    await db.delete(form)
    await db.commit()
    return {"msg": "form deleted"}


async def publish_survey_form(form_id: UUID,user_id: UUID,db: AsyncSession):
    """Publish form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        return {"msg": "form not found"}

    if form.created_by != user_id:
        raise PermissionError("Not authorized to publish this form")

    form.status = "PUBLISHED"
    await db.commit()
    return {"msg": "form has been published"}


async def unpublish_survey_form(form_id: UUID,user_id: UUID,db: AsyncSession):
    """unpublish form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        return {"msg": "form not found"}

    if form.created_by != user_id:
        raise PermissionError("Not authorized to publish this form")

    form.status = "DRAFT"
    await db.commit()
    return {"msg": "form has been unpublished, back to DRAFT status"}

