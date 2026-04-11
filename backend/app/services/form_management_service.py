"""
researcher form service
"""
from collections import defaultdict
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete as sa_delete, func, case
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from typing import List, Optional
import asyncio
import math
from datetime import datetime, timezone

from app.db.models import (
    SurveyForm, FormField, FieldOption, FormDeployment, Group, FieldElementMap,
    FormSubmission, GroupMember, ParticipantProfile, CaretakerProfile
)
from app.schemas.survey_schema import SurveyDetailOut, SurveyListItem, SurveyCreate
from app.services.notification_service import create_notification, create_notifications_bulk
from app.services.survey_cadence import normalize_cadence

ONBOARDING_FORM_TITLES = {"Intake Form"}


async def _get_group_participant_user_ids(
    db: AsyncSession,
    group_ids: list[UUID],
) -> list[UUID]:
    if not group_ids:
        return []

    result = await db.execute(
        select(ParticipantProfile.user_id)
        .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
        .where(GroupMember.group_id.in_(group_ids))
        .where(GroupMember.left_at.is_(None))
        .where(ParticipantProfile.user_id.is_not(None))
    )
    return list({row[0] for row in result.all() if row[0] is not None})


async def _get_group_caretaker_user_ids(
    db: AsyncSession,
    group_ids: list[UUID],
) -> list[UUID]:
    if not group_ids:
        return []

    result = await db.execute(
        select(CaretakerProfile.user_id)
        .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
        .where(Group.group_id.in_(group_ids))
        .where(CaretakerProfile.user_id.isnot(None))
    )
    return list({row[0] for row in result.all() if row[0] is not None})


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

    query = (select(SurveyForm).where(SurveyForm.form_id == new_form.form_id).options(selectinload(SurveyForm.fields).selectinload(FormField.options)))
    result = await db.execute(query)
    full_form = result.scalar_one()

    return full_form


async def _attach_form_list_metadata(db: AsyncSession, forms: list[SurveyForm]) -> list[SurveyForm]:
    if not forms:
        return forms

    form_ids = [form.form_id for form in forms]

    field_count_result = await db.execute(
        select(FormField.form_id, func.count(FormField.field_id))
        .where(FormField.form_id.in_(form_ids))
        .group_by(FormField.form_id)
    )
    field_count_map = {form_id: count for form_id, count in field_count_result.all()}

    submission_count_result = await db.execute(
        select(FormSubmission.form_id, func.count(FormSubmission.submission_id))
        .where(FormSubmission.form_id.in_(form_ids))
        .where(FormSubmission.submitted_at.is_not(None))
        .group_by(FormSubmission.form_id)
    )
    submission_count_map = {form_id: count for form_id, count in submission_count_result.all()}

    dep_result = await db.execute(
        select(
            FormDeployment.form_id,
            FormDeployment.deployed_by,
            FormDeployment.deployed_at,
            Group.group_id,
            Group.name,
        )
        .join(Group, Group.group_id == FormDeployment.group_id)
        .where(FormDeployment.form_id.in_(form_ids))
    )
    group_map: dict = {}
    group_id_map: dict = {}
    deployer_map: dict = {}
    deployed_at_map: dict = {}
    for fid, deployed_by, deployed_at, gid, gname in dep_result.all():
        group_map.setdefault(fid, []).append(gname)
        group_id_map.setdefault(fid, []).append(gid)
        deployer_map.setdefault(fid, {})[str(gid)] = str(deployed_by) if deployed_by else None
        deployed_at_map.setdefault(fid, {})[str(gid)] = deployed_at

    for form in forms:
        form.field_count = int(field_count_map.get(form.form_id, 0) or 0)
        form.submission_count = int(submission_count_map.get(form.form_id, 0) or 0)
        form.deployed_groups = group_map.get(form.form_id, [])
        form.deployed_group_ids = group_id_map.get(form.form_id, [])
        form.deployed_group_deployers = deployer_map.get(form.form_id, {})
        form.deployed_group_deployed_at = deployed_at_map.get(form.form_id, {})

    return forms

async def list_researcher_forms(db: AsyncSession):
    """List all researcher forms"""
    query = (
        select(SurveyForm)
        .where(SurveyForm.status != "DELETED")
        .where(~SurveyForm.title.in_(ONBOARDING_FORM_TITLES))
        .order_by(desc(SurveyForm.created_at))
    )
    result = await db.execute(query)
    forms = result.scalars().all()
    return await _attach_form_list_metadata(db, forms)

async def list_researcher_forms_paged(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    status: str | None = None,
    sort: str = "edited",
    group_id: UUID | None = None,
    date_from=None,
    date_to=None,
    ownership_filter: str | None = None,
    current_user_id: UUID | None = None,
):
    root_expr = func.coalesce(SurveyForm.parent_form_id, SurveyForm.form_id)
    latest_rank = case(
        (SurveyForm.status.not_in(["DELETED", "ARCHIVED"]), 0),
        (SurveyForm.status == "ARCHIVED", 1),
        else_=2,
    )

    latest_stmt = (
        select(SurveyForm, root_expr.label("root_id"))
        .where(~SurveyForm.title.in_(ONBOARDING_FORM_TITLES))
        .order_by(
            root_expr,
            latest_rank.asc(),
            SurveyForm.version.desc(),
            SurveyForm.created_at.desc(),
        )
        .distinct(root_expr)
    )
    latest_result = await db.execute(latest_stmt)
    latest_rows = latest_result.all()
    latest_forms = [form for form, _ in latest_rows if form.status != "DELETED"]
    latest_forms = await _attach_form_list_metadata(db, latest_forms)

    latest_by_root = {
        str(form.parent_form_id or form.form_id): form
        for form in latest_forms
    }

    normalized_search = (search or "").strip().lower()
    normalized_status = (status or "ALL").upper()
    normalized_ownership = (ownership_filter or "ALL").upper()
    current_user_str = str(current_user_id or "")

    def matches(form):
        deployed_ids = [str(v or "") for v in (form.deployed_group_deployers or {}).values()]
        is_created_by_me = str(form.created_by or "") == current_user_str
        published_by_me = current_user_str and current_user_str in deployed_ids
        published_by_others = any(v and v != current_user_str for v in deployed_ids)
        match_search = not normalized_search or normalized_search in (form.title or "").lower()
        match_status = normalized_status == "ALL" or (form.status or "").upper() == normalized_status
        match_group = (
            group_id is None or (
                (form.status or "").upper() == "PUBLISHED"
                and any(str(gid) == str(group_id) for gid in (form.deployed_group_ids or []))
            )
        )
        created_at = form.created_at
        match_from = not date_from or (created_at and created_at >= date_from)
        match_to = not date_to or (created_at and created_at <= date_to)
        match_ownership = (
            normalized_ownership == "ALL"
            or (normalized_ownership == "CREATED_BY_ME" and is_created_by_me)
            or (normalized_ownership == "CREATED_BY_OTHERS" and not is_created_by_me)
            or (normalized_ownership == "PUBLISHED_BY_ME" and published_by_me)
            or (normalized_ownership == "PUBLISHED_BY_OTHERS" and published_by_others)
        )
        return match_search and match_status and match_group and match_from and match_to and match_ownership

    filtered_latest = [form for form in latest_forms if matches(form)]

    counts = {
        "ALL": len(latest_forms),
        "DRAFT": sum(1 for form in latest_forms if form.status == "DRAFT"),
        "PUBLISHED": sum(1 for form in latest_forms if form.status == "PUBLISHED"),
        "ARCHIVED": sum(1 for form in latest_forms if form.status == "ARCHIVED"),
    }

    def sort_key(form):
        if sort == "newest":
            return form.created_at or datetime.min
        if sort == "oldest":
            return form.created_at or datetime.min
        if sort == "alpha":
            return (form.title or "").lower()
        return form.modified_at or form.created_at or datetime.min

    reverse = sort != "oldest" and sort != "alpha"
    filtered_latest = sorted(filtered_latest, key=sort_key, reverse=reverse)

    total_count = len(filtered_latest)
    total_pages = max(1, math.ceil(total_count / page_size))
    page = max(1, min(page, total_pages))
    start = (page - 1) * page_size
    page_latest = filtered_latest[start:start + page_size]
    page_root_ids = [str(form.parent_form_id or form.form_id) for form in page_latest]

    history_stmt = (
        select(SurveyForm)
        .where(root_expr.in_(page_root_ids))
        .where(~SurveyForm.title.in_(ONBOARDING_FORM_TITLES))
        .order_by(root_expr, SurveyForm.version.desc(), SurveyForm.created_at.desc())
    )
    history_result = await db.execute(history_stmt)
    page_forms = await _attach_form_list_metadata(db, history_result.scalars().all())

    family_map = defaultdict(list)
    for form in page_forms:
        family_map[str(form.parent_form_id or form.form_id)].append(form)

    items = []
    for root_id in page_root_ids:
        family_forms = family_map.get(root_id, [])
        latest_form = latest_by_root.get(root_id)
        if not latest_form:
            continue
        items.append(latest_form)
        history_items = [
            form
            for form in family_forms
            if form.form_id != latest_form.form_id and matches(form)
        ]
        items.extend(history_items)

    return {
        "items": items,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "counts": counts,
    }

async def get_form_by_id(
    form_id: UUID,
    db: AsyncSession,
    user_id: UUID | None = None,
) -> Optional[SurveyForm]:
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
    if user_id is not None and str(form.created_by) != str(user_id):
        raise PermissionError("You do not have access to this form.")

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
    return {"msg": "form updated"}

async def delete_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Hard-delete DRAFT forms (never published, no submissions). Soft-delete published/archived versioned forms to preserve version history."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can delete it.")

    # DRAFT forms were never published and can never have submissions — always hard-delete.
    # This also resets the version counter so the next branch reuses the version number.
    if form.status == "DRAFT":
        root_id = form.parent_form_id  # None if this is a standalone draft
        await db.delete(form)
        # If this draft was part of a family, touch the previous version so
        # modified_at reflects the change and sort-by-last-modified stays correct
        if root_id:
            prev_result = await db.execute(
                select(SurveyForm)
                .where(
                    (SurveyForm.form_id == root_id) | (SurveyForm.parent_form_id == root_id),
                    SurveyForm.form_id != form_id,
                    SurveyForm.status != "DELETED",
                )
                .order_by(SurveyForm.version.desc())
                .limit(1)
            )
            prev = prev_result.scalar_one_or_none()
            if prev:
                prev.modified_at = func.now()
        await db.commit()
        return {"msg": "form deleted"}

    # For published/archived forms in a version family, soft-delete to preserve version history.
    is_versioned = form.parent_form_id is not None
    if not is_versioned:
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
        form.modified_at = func.now()
        await db.commit()
    else:
        await db.delete(form)
        await db.commit()

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
        f.modified_at = func.now()

    await db.commit()
    return {"msg": f"All {len(family)} version(s) deleted"}


async def branch_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Create a new draft version branched from an existing form.

    The new form gets version + 1, parent_form_id pointing to the original,
    and all fields copied over. The original form is untouched.
    """
    original = await get_form_by_id(form_id, db)
    if not original:
        raise HTTPException(status_code=404, detail="Form not found.")
    is_owner = str(original.created_by) == str(user_id)

    if is_owner:
        # Determine root form id — always point back to the original, not a chain
        root_id = original.parent_form_id or original.form_id

        # Find the highest version in this form family
        version_result = await db.execute(
            select(func.max(SurveyForm.version)).where(
                (SurveyForm.form_id == root_id) | (SurveyForm.parent_form_id == root_id)
            )
        )
        max_version = version_result.scalar() or original.version or 1
        new_version = max_version + 1
        parent_form_id = root_id
    else:
        # Duplicating another researcher's survey creates an independent draft copy
        # owned by the current user, not a new version inside the original family.
        new_version = 1
        parent_form_id = None

    new_form = SurveyForm(
        title=original.title,
        description=original.description,
        status="DRAFT",
        cadence=normalize_cadence(original.cadence),
        cadence_anchor_at=None,
        version=new_version,
        parent_form_id=parent_form_id,
        created_by=user_id,
    )
    db.add(new_form)
    await db.flush()  # get new_form.form_id

    # Copy all fields
    old_fields_result = await db.execute(
        select(FormField).where(FormField.form_id == form_id)
    )
    old_fields = old_fields_result.scalars().all()
    old_field_ids = [field.field_id for field in old_fields]

    option_map: dict = {}
    mapping_map: dict = {}
    if old_field_ids:
        options_result = await db.execute(
            select(FieldOption).where(FieldOption.field_id.in_(old_field_ids))
        )
        for option in options_result.scalars().all():
            option_map.setdefault(option.field_id, []).append(option)

        mappings_result = await db.execute(
            select(FieldElementMap).where(FieldElementMap.field_id.in_(old_field_ids))
        )
        for mapping in mappings_result.scalars().all():
            mapping_map.setdefault(mapping.field_id, []).append(mapping)

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

        for opt in option_map.get(old_field.field_id, []):
            db.add(FieldOption(
                field_id=new_field_id,
                label=opt.label,
                value=opt.value,
                display_order=opt.display_order,
            ))

        for m in mapping_map.get(old_field.field_id, []):
            db.add(FieldElementMap(field_id=new_field_id, element_id=m.element_id))

    await db.commit()
    return {
        "msg": "new version created" if is_owner else "survey duplicated",
        "form_id": str(new_form.form_id),
        "version": new_form.version,
        "duplicated": not is_owner,
    }


async def get_publish_preview(form_id: UUID, group_ids: List[UUID], db: AsyncSession) -> List[dict]:
    """
    Return in-progress submission counts across ALL groups that have an older version deployed,
    not just the target group. Publishing v2 supersedes v1 globally, so the UI must warn about
    every group that will lose access to older versions.
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
        return [{"group_id": str(gid), "in_progress_count": 0, "currently_deployed": False} for gid in group_ids]

    # Find all groups that currently have an older version deployed
    affected_groups_result = await db.execute(
        select(FormDeployment.group_id).where(
            FormDeployment.form_id.in_(sibling_ids)
        ).distinct()
    )
    affected_group_ids = {row[0] for row in affected_groups_result.all()}

    all_group_ids = list({*group_ids, *affected_group_ids})
    results = []
    for gid in all_group_ids:
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
        results.append({
            "group_id": str(gid),
            "in_progress_count": count_result.scalar() or 0,
            "currently_deployed": gid in affected_group_ids,
        })
    return results


async def publish_survey_form(
    form_id: UUID,
    group_id: UUID,
    cadence: str,
    user_id: UUID,
    db: AsyncSession,
):
    """Publish form and assign to a group"""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can publish it.")

    normalized_cadence = normalize_cadence(cadence)
    if normalized_cadence not in {"once", "daily", "weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Cadence must be once, daily, weekly, or monthly.")

    group_query = select(Group).where(Group.group_id == group_id)
    group_result = await db.execute(group_query)
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found. Make sure the group exists before publishing.")

    existing_deployment_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id, FormDeployment.group_id == group_id)
    )
    existing_deployment = existing_deployment_result.scalar_one_or_none()
    if existing_deployment:
        if existing_deployment.cadence != normalized_cadence:
            existing_deployment.cadence = normalized_cadence
            form.cadence = normalized_cadence

            # Notify participants in this group that the survey cadence changed
            participant_rows = await db.execute(
                select(ParticipantProfile.user_id)
                .join(GroupMember, GroupMember.participant_id == ParticipantProfile.participant_id)
                .where(GroupMember.group_id == group_id)
                .where(GroupMember.left_at.is_(None))
            )
            participant_user_ids = [row[0] for row in participant_rows.all()]
            if participant_user_ids:
                await create_notifications_bulk(
                    db=db,
                    user_ids=participant_user_ids,
                    notification_type="submission",
                    title="Survey schedule updated",
                    message=f"'{form.title}' is now available on a {normalized_cadence} basis.",
                    link="/participant/survey",
                    role_target="participant",
                    source_type="survey_cadence_changed",
                    source_id=form_id,
                    deployment_id=existing_deployment.deployment_id,
                )

            # Notify caretakers of this group
            caretaker_rows = await db.execute(
                select(CaretakerProfile.user_id)
                .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
                .where(Group.group_id == group_id)
            )
            caretaker_user_ids = [row[0] for row in caretaker_rows.all()]
            if caretaker_user_ids:
                await create_notifications_bulk(
                    db=db,
                    user_ids=caretaker_user_ids,
                    notification_type="summary",
                    title="Survey cadence changed",
                    message=f"'{form.title}' recurrence changed to {normalized_cadence} for your group.",
                    link="/caretaker/reports",
                    role_target="caretaker",
                    source_type="survey_cadence_changed",
                    source_id=form_id,
                    deployment_id=existing_deployment.deployment_id,
                )

            await db.commit()
        return {"msg": "cadence updated", "cadence": normalized_cadence}

    active_deployments_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id)
    )
    active_deployments = active_deployments_result.scalars().all()

    # Publishing a new version supersedes all older versions in the family globally:
    # remove their deployments from every group and archive them.
    root_id = form.parent_form_id or form.form_id
    sibling_result = await db.execute(
        select(SurveyForm).where(
            (SurveyForm.parent_form_id == root_id) | (SurveyForm.form_id == root_id),
            SurveyForm.form_id != form_id
        )
    )
    siblings = sibling_result.scalars().all()
    if siblings:
        sibling_ids = [s.form_id for s in siblings]
        old_deployments_result = await db.execute(
            select(FormDeployment).where(
                FormDeployment.form_id.in_(sibling_ids)
            )
        )
        for old_dep in old_deployments_result.scalars().all():
            await db.delete(old_dep)
        for sibling in siblings:
            if sibling.status == "PUBLISHED":
                sibling.status = "ARCHIVED"

    deployment = FormDeployment(
        form_id=form_id,
        group_id=group_id,
        deployed_by=user_id,
        cadence=normalized_cadence,
    )
    db.add(deployment)
    await db.flush()
    if deployment.cadence_anchor_at is None:
        deployment.cadence_anchor_at = deployment.deployed_at or datetime.now(timezone.utc)

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

    caretaker_user_row = await db.execute(
        select(CaretakerProfile.user_id)
        .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
        .where(Group.group_id == group_id)
    )
    caretaker_user_ids = [row[0] for row in caretaker_user_row.all()]
    if caretaker_user_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=caretaker_user_ids,
            notification_type="summary",
            title="New survey deployed to your group",
            message=f"A new survey '{form.title}' has been deployed to one of your assigned groups.",
            link="/caretaker",
            role_target="caretaker",
            source_type="form_deployment",
            source_id=deployment.deployment_id,
            deployment_id=deployment.deployment_id,
        )

    form.status = "PUBLISHED"
    form.cadence = normalized_cadence
    if not active_deployments or form.cadence_anchor_at is None:
        form.cadence_anchor_at = deployment.cadence_anchor_at or deployment.deployed_at or datetime.now(timezone.utc)
    form.modified_at = func.now()
    await db.commit()
    return {"msg": "form has been published and assigned to group", "cadence": normalized_cadence}


async def unpublish_survey_form_all(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from all groups and archive it."""
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

    affected_group_ids = [d.group_id for d in deployments if d.group_id]
    participant_user_ids = await _get_group_participant_user_ids(db, affected_group_ids)
    caretaker_user_ids = await _get_group_caretaker_user_ids(db, affected_group_ids)

    for deployment in deployments:
        await db.delete(deployment)

    form.status = "ARCHIVED"
    form.modified_at = func.now()

    if participant_user_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=participant_user_ids,
            notification_type="flag",
            title="Survey removed",
            message=f'The survey "{form.title}" has been removed from your group.',
            link="/participant/survey",
            role_target="participant",
            source_type="form_unpublished",
            source_id=form_id,
        )

    if caretaker_user_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=caretaker_user_ids,
            notification_type="flag",
            title="Form unpublished",
            message=f"The form \"{form.title}\" has been unpublished from your group(s) and archived.",
            link="/caretaker",
            role_target="caretaker",
            source_type="form_unpublished",
            source_id=form_id,
        )

    await db.commit()
    return {"msg": f"Form unpublished from all {len(deployments)} group(s) and archived."}


async def unpublish_survey_form(form_id: UUID, group_id: UUID, user_id: UUID, db: AsyncSession):
    """Unpublish a form from a specific group. If no deployments remain, form is archived."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    deployment_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id, FormDeployment.group_id == group_id)
    )
    deployment = deployment_result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="This form is not deployed to that group.")
    if str(form.created_by) != str(user_id) and str(deployment.deployed_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who deployed this form to this group can unpublish it.")

    participant_user_ids = await _get_group_participant_user_ids(db, [group_id])

    # Find the caretaker for this group before deleting the deployment
    ct_result = await db.execute(
        select(CaretakerProfile.user_id, Group.name)
        .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
        .where(Group.group_id == group_id)
    )
    ct_row = ct_result.one_or_none()

    await db.delete(deployment)

    # Check if any deployments remain — if none, archive the form
    remaining_result = await db.execute(
        select(FormDeployment).where(FormDeployment.form_id == form_id)
    )
    remaining = remaining_result.scalars().all()
    if not remaining:
        form.status = "ARCHIVED"
        form.modified_at = func.now()

    if participant_user_ids:
        group_name = ct_row.name if ct_row and ct_row.name else "your group"
        await create_notifications_bulk(
            db=db,
            user_ids=participant_user_ids,
            notification_type="flag",
            title="Survey removed",
            message=f'The survey "{form.title}" has been removed from {group_name}.',
            link="/participant/survey",
            role_target="participant",
            source_type="form_unpublished",
            source_id=form_id,
        )

    if ct_row and ct_row.user_id:
        group_name = ct_row.name or "your group"
        await create_notifications_bulk(
            db=db,
            user_ids=[ct_row.user_id],
            notification_type="flag",
            title="Form unpublished",
            message=f"The form \"{form.title}\" has been unpublished from {group_name}.",
            link="/caretaker",
            role_target="caretaker",
            source_type="form_unpublished",
            source_id=form_id,
        )

    await db.commit()

    if form.status == "ARCHIVED":
        return {"msg": "Form unpublished from group and archived — no remaining deployments."}
    return {"msg": "Form unpublished from group. Still deployed to other groups."}


async def archive_survey_form(form_id: UUID, user_id: UUID, db: AsyncSession):
    """Archive a form so it is hidden from active authoring workflows."""
    form = await get_form_by_id(form_id, db)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    if str(form.created_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the researcher who created this form can archive it.")
    affected_group_ids: list[UUID] = []
    if form.status == "PUBLISHED":
        deployments_result = await db.execute(
            select(FormDeployment).where(FormDeployment.form_id == form_id)
        )
        deployments = deployments_result.scalars().all()
        affected_group_ids = [dep.group_id for dep in deployments if dep.group_id]
        for dep in deployments:
            await db.delete(dep)
    if form.status == "DELETED":
        raise HTTPException(status_code=400, detail="Deleted forms cannot be archived.")
    if form.status == "ARCHIVED":
        return {"msg": "Form is already archived."}

    form.status = "ARCHIVED"
    form.modified_at = func.now()

    if affected_group_ids:
        participant_user_ids = await _get_group_participant_user_ids(db, affected_group_ids)
        caretaker_user_ids = await _get_group_caretaker_user_ids(db, affected_group_ids)

        if participant_user_ids:
            await create_notifications_bulk(
                db=db,
                user_ids=participant_user_ids,
                notification_type="flag",
                title="Survey archived",
                message=f'The survey "{form.title}" has been archived and removed from your group.',
                link="/participant/survey",
                role_target="participant",
                source_type="form_archived",
                source_id=form_id,
            )

        if caretaker_user_ids:
            await create_notifications_bulk(
                db=db,
                user_ids=caretaker_user_ids,
                notification_type="flag",
                title="Survey archived",
                message=f'The survey "{form.title}" has been archived and removed from one of your groups.',
                link="/caretaker",
                role_target="caretaker",
                source_type="form_archived",
                source_id=form_id,
            )

    await db.commit()
    return {"msg": "Form archived."}
