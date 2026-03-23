"""
researcher form service
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete as sa_delete, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional
import time

from app.db.models import SurveyForm, FormField, FieldOption, FormDeployment, Group, FieldElementMap
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate

# Simple in-memory cache for the forms list
_forms_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 30  # seconds

def invalidate_forms_cache():
    _forms_cache["data"] = None
    _forms_cache["ts"] = 0.0

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

        if field_in.element_id:
            db.add(FieldElementMap(field_id=new_field.field_id, element_id=field_in.element_id))

        for option_in in field_in.options:
            new_option = FieldOption(
                field_id=new_field.field_id,
                label=option_in.label,
                value=option_in.value,
                display_order=option_in.display_order
            )
            db.add(new_option)

    await db.commit()
    invalidate_forms_cache()

    query = (select(SurveyForm).where(SurveyForm.form_id == new_form.form_id).options(selectinload(SurveyForm.fields).selectinload(FormField.options)))
    result = await db.execute(query)
    full_form = result.scalar_one()

    return full_form

async def list_researcher_forms(db: AsyncSession):
    """List all researcher forms""" #the entire researcher forms
    if _forms_cache["data"] is not None and (time.time() - _forms_cache["ts"]) < _CACHE_TTL:
        return _forms_cache["data"]

    field_count_subq = (
        select(func.count(FormField.field_id))
        .where(FormField.form_id == SurveyForm.form_id)
        .correlate(SurveyForm)
        .scalar_subquery()
    )
    query = select(SurveyForm, field_count_subq.label("field_count")).where(SurveyForm.status != "DELETED").order_by(desc(SurveyForm.created_at))
    result = await db.execute(query)
    rows = result.all()
    for form, count in rows:
        form.field_count = count
    forms = [form for form, _ in rows]

    # Attach deployed group names
    if forms:
        form_ids = [f.form_id for f in forms]
        dep_result = await db.execute(
            select(FormDeployment.form_id, Group.name)
            .join(Group, Group.group_id == FormDeployment.group_id)
            .where(FormDeployment.form_id.in_(form_ids))
        )
        group_map: dict = {}
        for fid, gname in dep_result.all():
            group_map.setdefault(fid, []).append(gname)
        for form in forms:
            form.deployed_groups = group_map.get(form.form_id, [])

    _forms_cache["data"] = forms
    _forms_cache["ts"] = time.time()
    return forms

async def get_form_by_id(form_id: UUID, db: AsyncSession) -> Optional[SurveyForm]:
    """Get forms by ID, with element_id attached to each field."""
    query = (
        select(SurveyForm)
        .where(SurveyForm.form_id == form_id, SurveyForm.status != "DELETED")
        .options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    )
    result = await db.execute(query)
    form = result.scalar_one_or_none()
    if not form:
        return None

    # Attach element_id to each field from FieldElementMap
    field_ids = [f.field_id for f in form.fields]
    if field_ids:
        map_result = await db.execute(
            select(FieldElementMap).where(FieldElementMap.field_id.in_(field_ids))
        )
        element_map = {row.field_id: row.element_id for row in map_result.scalars().all()}
        for field in form.fields:
            field.element_id = element_map.get(field.field_id)

    # Attach deployed group IDs
    dep_result = await db.execute(
        select(FormDeployment.group_id).where(FormDeployment.form_id == form_id)
    )
    form.deployed_group_ids = [row for row in dep_result.scalars().all()]

    return form

async def update_survey_form(form_id: UUID, form_data: SurveyCreate, db: AsyncSession):
    """Update an existing form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    if form.status == "PUBLISHED":
        raise HTTPException(status_code=400, detail="Published forms cannot be edited. Unpublish the form first.")

    # Delete FieldElementMap rows before clearing fields to avoid FK violations
    old_field_ids = [f.field_id for f in form.fields]
    if old_field_ids:
        await db.execute(
            sa_delete(FieldElementMap).where(FieldElementMap.field_id.in_(old_field_ids))
        )

    form.fields = []
    await db.flush()

    for field_in in form_data.fields:
        new_field = FormField(
            form_id=form.form_id,
            label=field_in.label,
            field_type=field_in.field_type,
            is_required=field_in.is_required,
            display_order=field_in.display_order
        )
        db.add(new_field)
        await db.flush()

        if field_in.element_id:
            db.add(FieldElementMap(field_id=new_field.field_id, element_id=field_in.element_id))

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
    invalidate_forms_cache()
    return {"msg": "form updated"}

async def delete_survey_form(form_id: UUID, db: AsyncSession):
    """Soft-delete a form by marking it DELETED. Data is preserved for query reports."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    form.status = "DELETED"
    await db.commit()
    invalidate_forms_cache()
    return {"msg": "form deleted"}


async def publish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Publish form and assign to a group"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

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
    invalidate_forms_cache()
    return {"msg": "form has been published and assigned to group"}


async def unpublish_survey_form_all(form_id: UUID, db: AsyncSession):
    """Unpublish a form from all groups and revert to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

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
    invalidate_forms_cache()
    return {"msg": f"Form unpublished from all {len(deployments)} group(s) and reverted to DRAFT."}


async def unpublish_survey_form(form_id: UUID, group_id: UUID, db: AsyncSession):
    """Unpublish a form from a specific group. If no deployments remain, form reverts to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

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
    invalidate_forms_cache()

    if form.status == "DRAFT":
        return {"msg": "Form unpublished from group and reverted to DRAFT — no remaining deployments."}
    return {"msg": "Form unpublished from group. Still deployed to other groups."}
