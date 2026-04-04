"""
researcher form service
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete as sa_delete, func
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from typing import List, Optional
import time
import asyncio

from app.db.models import (
    SurveyForm, FormField, FieldOption, FormDeployment, Group, FieldElementMap,
    FormSubmission, GroupMember, ParticipantProfile
)
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate
from app.services.notification_service import create_notifications_bulk

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

    field_map = {}
    for field_in in form_data.fields:
        field_id = uuid4()
        db.add(FormField(
            field_id=field_id,
            form_id=new_form.form_id,
            label=field_in.label,
            field_type=field_in.field_type,
            is_required=field_in.is_required,
            display_order=field_in.display_order
        ))
        field_map[field_id] = field_in

    await db.flush()  # one flush — all fields now exist in DB

    for field_id, field_in in field_map.items():
        if field_in.element_id:
            db.add(FieldElementMap(field_id=field_id, element_id=field_in.element_id))
        for option_in in field_in.options:
            db.add(FieldOption(
                field_id=field_id,
                label=option_in.label,
                value=option_in.value,
                display_order=option_in.display_order
            ))

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
    submission_count_subq = (
        select(func.count(FormSubmission.submission_id))
        .where(
            FormSubmission.form_id == SurveyForm.form_id,
            FormSubmission.submitted_at.is_not(None),
        )
        .correlate(SurveyForm)
        .scalar_subquery()
    )
    query = (
        select(SurveyForm, field_count_subq.label("field_count"), submission_count_subq.label("submission_count"))
        .where(SurveyForm.status != "DELETED")
        .order_by(desc(SurveyForm.created_at))
    )
    result = await db.execute(query)
    rows = result.all()
    for form, count, sub_count in rows:
        form.field_count = count
        form.submission_count = sub_count
    forms = [form for form, _, __ in rows]

    # Attach deployed group names
    if forms:
        form_ids = [f.form_id for f in forms]
        dep_result = await db.execute(
            select(FormDeployment.form_id, Group.group_id, Group.name)
            .join(Group, Group.group_id == FormDeployment.group_id)
            .where(FormDeployment.form_id.in_(form_ids))
        )
        group_map: dict = {}
        group_id_map: dict = {}
        for fid, gid, gname in dep_result.all():
            group_map.setdefault(fid, []).append(gname)
            group_id_map.setdefault(fid, []).append(gid)
        for form in forms:
            form.deployed_groups = group_map.get(form.form_id, [])
            form.deployed_group_ids = group_id_map.get(form.form_id, [])

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

    # Run FieldElementMap + FormDeployment lookups in parallel
    field_ids = [f.field_id for f in form.fields]
    map_result, dep_result = await asyncio.gather(
        db.execute(select(FieldElementMap).where(FieldElementMap.field_id.in_(field_ids))),
        db.execute(select(FormDeployment.group_id).where(FormDeployment.form_id == form_id))
    )
    element_map = {row.field_id: row.element_id for row in map_result.scalars().all()}
    for field in form.fields:
        field.element_id = element_map.get(field.field_id)
    form.deployed_group_ids = list(dep_result.scalars().all())

    return form

async def update_survey_form(form_id: UUID, form_data: SurveyCreate, user_id: UUID, db: AsyncSession):
    """Update an existing form"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can edit it.")
    if form.status == "PUBLISHED":
        raise HTTPException(status_code=400, detail="Published forms cannot be edited. Unpublish the form first.")

    sub_check = await db.execute(
        select(FormSubmission.submission_id).where(
            FormSubmission.form_id == form_id,
            FormSubmission.submitted_at.is_not(None),
        ).limit(1)
    )
    if sub_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This form has existing submissions and cannot be edited.")

    # Get old field IDs in one query, delete dependents in bulk
    old_ids_result = await db.execute(select(FormField.field_id).where(FormField.form_id == form_id))
    old_field_ids = old_ids_result.scalars().all()
    if old_field_ids:
        await db.execute(sa_delete(FieldElementMap).where(FieldElementMap.field_id.in_(old_field_ids)))
        await db.execute(sa_delete(FieldOption).where(FieldOption.field_id.in_(old_field_ids)))
        await db.execute(sa_delete(FormField).where(FormField.form_id == form_id))

    # Insert all fields first, flush once to satisfy FK, then add maps and options
    field_map = {}  # field_id -> field_in
    for field_in in form_data.fields:
        field_id = uuid4()
        db.add(FormField(
            field_id=field_id,
            form_id=form_id,
            label=field_in.label,
            field_type=field_in.field_type,
            is_required=field_in.is_required,
            display_order=field_in.display_order
        ))
        field_map[field_id] = field_in

    await db.flush()  # one flush — all fields now exist in DB

    for field_id, field_in in field_map.items():
        if field_in.element_id:
            db.add(FieldElementMap(field_id=field_id, element_id=field_in.element_id))
        for option_in in field_in.options:
            db.add(FieldOption(
                field_id=field_id,
                label=option_in.label,
                value=option_in.value,
                display_order=option_in.display_order
            ))

    form.title = form_data.title
    form.description = form_data.description
    form.modified_at = func.now()

    await db.commit()
    invalidate_forms_cache()
    return {"msg": "form updated"}

async def delete_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Soft-delete versioned forms to preserve version numbers. Hard-delete standalone forms with no submissions."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can delete it.")

    # If this form is part of a version family, always soft-delete so the version
    # number is preserved for future branches (e.g. deleting v4 still lets next be v5)
    is_versioned = form.parent_form_id is not None
    if not is_versioned:
        # Check if any other form points to this one as its root
        has_children = (
            await db.scalar(
                select(SurveyForm.form_id).where(SurveyForm.parent_form_id == form_id).limit(1)
            )
        ) is not None
        is_versioned = has_children

    has_submissions = (
        await db.scalar(
            select(FormSubmission.submission_id).where(
                FormSubmission.form_id == form_id,
                FormSubmission.submitted_at.is_not(None),
            ).limit(1)
        )
    ) is not None

    if has_submissions or is_versioned:
        form.status = "DELETED"
        await db.commit()
    else:
        await db.delete(form)
        await db.commit()

    invalidate_forms_cache()
    return {"msg": "form deleted"}


async def delete_form_family(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Soft-delete all versions in a form family to preserve version number history."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can delete it.")

    root_id = form.parent_form_id or form.form_id
    family_result = await db.execute(
        select(SurveyForm).where(
            (SurveyForm.form_id == root_id) | (SurveyForm.parent_form_id == root_id)
        )
    )
    family = family_result.scalars().all()

    for f in family:
        # Always soft-delete family members — preserves version numbers so future
        # branches continue from the correct next version (e.g. after deleting v4,
        # the next branch is still v5, not v4)
        f.status = "DELETED"

    await db.commit()
    invalidate_forms_cache()
    return {"msg": f"All {len(family)} version(s) deleted"}


async def branch_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Create a new draft version branched from an existing form.

    The new form gets version + 1, parent_form_id pointing to the original,
    and all fields copied over. The original form is untouched.
    """
    original = await get_form_by_id(form_id, db)
    if not original:
        raise HTTPException(status_code=404, detail="Form not found.")

    # Determine root form id — always point back to the original, not a chain
    root_id = original.parent_form_id or original.form_id

    # Find the highest version in this form family
    version_result = await db.execute(
        select(func.max(SurveyForm.version)).where(
            (SurveyForm.form_id == root_id) | (SurveyForm.parent_form_id == root_id)
        )
    )
    max_version = version_result.scalar() or original.version or 1

    new_form = SurveyForm(
        title=original.title,
        description=original.description,
        status="DRAFT",
        version=max_version + 1,
        parent_form_id=root_id,
        created_by=user_id,
    )
    db.add(new_form)
    await db.flush()  # get new_form.form_id

    # Copy all fields
    old_fields_result = await db.execute(
        select(FormField).where(FormField.form_id == form_id)
    )
    old_fields = old_fields_result.scalars().all()

    for old_field in old_fields:
        new_field_id = uuid4()
        db.add(FormField(
            field_id=new_field_id,
            form_id=new_form.form_id,
            label=old_field.label,
            field_type=old_field.field_type,
            is_required=old_field.is_required,
            display_order=old_field.display_order,
        ))
        await db.flush()

        # Copy field options
        options_result = await db.execute(
            select(FieldOption).where(FieldOption.field_id == old_field.field_id)
        )
        for opt in options_result.scalars().all():
            db.add(FieldOption(
                field_id=new_field_id,
                label=opt.label,
                value=opt.value,
                display_order=opt.display_order,
            ))

        # Copy element mappings
        maps_result = await db.execute(
            select(FieldElementMap).where(FieldElementMap.field_id == old_field.field_id)
        )
        for m in maps_result.scalars().all():
            db.add(FieldElementMap(field_id=new_field_id, element_id=m.element_id))

    await db.commit()
    invalidate_forms_cache()
    return {"msg": "new version created", "form_id": str(new_form.form_id), "version": new_form.version}


async def get_publish_preview(form_id: UUID, group_ids: List[UUID], db: AsyncSession) -> List[dict]:
    """
    For each group, return how many participants have an IN_PROGRESS submission
    on any older version of this form family — so the UI can warn before publishing.
    """
    form = await get_form_by_id(form_id, db)
    if not form:
        return []

    root_id = form.parent_form_id or form.form_id
    sibling_result = await db.execute(
        select(SurveyForm.form_id).where(
            (SurveyForm.parent_form_id == root_id) | (SurveyForm.form_id == root_id),
            SurveyForm.form_id != form_id
        )
    )
    sibling_ids = [row[0] for row in sibling_result.all()]
    if not sibling_ids:
        return [{"group_id": str(gid), "in_progress_count": 0} for gid in group_ids]

    results = []
    for gid in group_ids:
        count_result = await db.execute(
            select(func.count(FormSubmission.submission_id))
            .join(GroupMember, GroupMember.participant_id == FormSubmission.participant_id)
            .where(
                FormSubmission.form_id.in_(sibling_ids),
                FormSubmission.submitted_at.is_(None),  # IN_PROGRESS = no submitted_at
                GroupMember.group_id == gid,
                GroupMember.left_at.is_(None),
            )
        )
        results.append({"group_id": str(gid), "in_progress_count": count_result.scalar() or 0})
    return results


async def publish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Publish form and assign to a group"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
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

    # If this is a newer version, remove older versions of the same family from this group
    root_id = form.parent_form_id or form.form_id
    sibling_result = await db.execute(
        select(SurveyForm.form_id).where(
            (SurveyForm.parent_form_id == root_id) | (SurveyForm.form_id == root_id),
            SurveyForm.form_id != form_id
        )
    )
    sibling_ids = [row[0] for row in sibling_result.all()]
    if sibling_ids:
        old_deployments_result = await db.execute(
            select(FormDeployment).where(
                FormDeployment.form_id.in_(sibling_ids),
                FormDeployment.group_id == group_id
            )
        )
        for old_dep in old_deployments_result.scalars().all():
            old_form_id = old_dep.form_id
            await db.delete(old_dep)
            # Revert older form to DRAFT if it has no remaining deployments
            remaining = await db.execute(
                select(FormDeployment).where(
                    FormDeployment.form_id == old_form_id,
                    FormDeployment.deployment_id != old_dep.deployment_id
                )
            )
            if not remaining.scalars().first():
                old_form = await db.get(SurveyForm, old_form_id)
                if old_form:
                    old_form.status = "ARCHIVED"

    deployment = FormDeployment(
        form_id=form_id,
        group_id=group_id,
        deployed_by=user_id
    )
    db.add(deployment)
    await db.flush()

    participant_user_rows = await db.execute(
        select(ParticipantProfile.user_id)
        .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
        .where(GroupMember.group_id == group_id)
        .where(GroupMember.left_at.is_(None))
    )
    participant_user_ids = [row[0] for row in participant_user_rows.all()]
    if participant_user_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=participant_user_ids,
            notification_type="submission",
            title="New survey available",
            message=f"A new survey '{form.title}' is now assigned to your group.",
            link="/participant/survey",
            role_target="participant",
            source_type="form_deployment",
            source_id=deployment.deployment_id,
            deployment_id=deployment.deployment_id,
        )

    form.status = "PUBLISHED"
    form.modified_at = func.now()
    await db.commit()
    invalidate_forms_cache()
    return {"msg": "form has been published and assigned to group"}


async def unpublish_survey_form_all(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from all groups and revert to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
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
    invalidate_forms_cache()
    return {"msg": f"Form unpublished from all {len(deployments)} group(s) and reverted to DRAFT."}


async def unpublish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from a specific group. If no deployments remain, form reverts to DRAFT."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
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
    invalidate_forms_cache()

    if form.status == "DRAFT":
        return {"msg": "Form unpublished from group and reverted to DRAFT — no remaining deployments."}
    return {"msg": "Form unpublished from group. Still deployed to other groups."}


async def archive_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Archive a form so it is hidden from active authoring workflows."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can archive it.")
    if form.status == "PUBLISHED":
        # Remove all deployments so participants lose access, then archive
        deployments_result = await db.execute(
            select(FormDeployment).where(FormDeployment.form_id == form_id)
        )
        for dep in deployments_result.scalars().all():
            await db.delete(dep)
    if form.status == "DELETED":
        raise HTTPException(status_code=400, detail="Deleted forms cannot be archived.")
    if form.status == "ARCHIVED":
        return {"msg": "Form is already archived."}

    form.status = "ARCHIVED"
    await db.commit()
    invalidate_forms_cache()
    return {"msg": "Form archived."}


async def unarchive_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Restore an archived form back to draft status."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can unarchive it.")
    if form.status != "ARCHIVED":
        raise HTTPException(status_code=400, detail="Only archived forms can be restored to draft.")

    form.status = "DRAFT"
    await db.commit()
    invalidate_forms_cache()
    return {"msg": "Form restored to draft."}
