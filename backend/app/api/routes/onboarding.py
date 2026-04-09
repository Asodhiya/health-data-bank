"""
Onboarding routes — intake form discovery and submission, consent, background info.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timezone
from typing import Any

from app.db.session import get_db
from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import ONBOARDING_READ, ONBOARDING_SUBMIT, ONBOARDING_EDIT
from app.db.models import (
    User, Role, UserRole, SurveyForm, FormField, FieldOption, FormSubmission,
    ParticipantProfile, FieldElementMap, HealthDataPoint
)
from app.services.participant_survey_service import _get_participant, _build_answer_records, _apply_transform
from app.services.onboarding_service import (
    get_active_consent_template,
    get_active_background_template,
    get_onboarding_status,
    mark_background_read,
    submit_consent,
    complete_onboarding,
    update_consent_template,
    update_background_template,
)
from app.schemas.onboarding_schema import (
    IntakeSubmission,
    ConsentSubmitIn,
    ConsentTemplateUpdateIn,
    BackgroundInfoUpdateIn,
    IntakeFormUpdateIn,
)
from app.services.notification_service import create_notifications_bulk

router = APIRouter()

INTAKE_FORM_TITLE = "Intake Form"
PROFILE_FIELD_NAMES = {
    "dob",
    "gender",
    "pronouns",
    "primary_language",
    "country_of_origin",
    "marital_status",
    "highest_education_level",
    "living_arrangement",
    "dependents",
    "occupation_status",
}


async def _get_intake_form(db: AsyncSession) -> SurveyForm:
    result = await db.execute(
        select(SurveyForm)
        .where(SurveyForm.title == INTAKE_FORM_TITLE)
        .options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found. Please contact an administrator.")
    return form


async def _find_intake_form(db: AsyncSession) -> SurveyForm | None:
    result = await db.execute(
        select(SurveyForm)
        .where(SurveyForm.title == INTAKE_FORM_TITLE)
        .options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    )
    return result.scalar_one_or_none()


async def _get_or_create_intake_form(db: AsyncSession, created_by) -> SurveyForm:
    form = await _find_intake_form(db)
    if form:
        return form

    form = SurveyForm(
        title=INTAKE_FORM_TITLE,
        description="Participant onboarding intake form",
        status="DRAFT",
        version=1,
        created_by=created_by,
    )
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return await _find_intake_form(db)


def _serialize_intake_field(field: FormField) -> dict[str, Any]:
    return {
        "field_id": str(field.field_id),
        "label": field.label,
        "field_type": field.field_type,
        "is_required": field.is_required,
        "display_order": field.display_order,
        "profile_field": field.profile_field,
        "options": [
            {
                "label": o.label,
                "value": o.value,
                "display_order": o.display_order,
            }
            for o in sorted(field.options, key=lambda x: x.display_order)
        ],
    }


def _minimum_adult_dob(today: date | None = None) -> date:
    today = today or date.today()
    try:
        return date(today.year - 18, today.month, today.day)
    except ValueError:
        return date(today.year - 18, today.month, today.day - 1)


def _normalize_profile_field_value(profile_field: str, value: Any) -> Any:
    if value is None:
        return None

    if profile_field == "dob":
        if isinstance(value, str):
            try:
                parsed = date.fromisoformat(value)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Date of birth must be a valid date.") from exc
        elif isinstance(value, date):
            parsed = value
        else:
            raise HTTPException(status_code=400, detail="Date of birth must be a valid date.")
        if parsed > date.today():
            raise HTTPException(status_code=400, detail="Date of birth cannot be in the future.")
        if parsed > _minimum_adult_dob():
            raise HTTPException(status_code=400, detail="Participant must be at least 18 years old.")
        return parsed

    if profile_field == "dependents":
        if value == "":
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Dependents must be a whole number.") from exc
        if parsed < 0:
            raise HTTPException(status_code=400, detail="Dependents cannot be negative.")
        return parsed

    if isinstance(value, list):
        return ", ".join(str(v).strip() for v in value if str(v).strip())

    if isinstance(value, dict):
        raise HTTPException(status_code=400, detail=f"{profile_field} cannot store a structured object.")

    text = str(value).strip()
    return text or None


def _resolve_profile_field_raw_value(field: FormField, raw_value: Any) -> Any:
    if not field.options:
        return raw_value

    option_map = {
        option.value: option.label
        for option in field.options
        if option.label is not None
    }

    if isinstance(raw_value, list):
        return [option_map.get(value, value) for value in raw_value]

    return option_map.get(raw_value, raw_value)


@router.get("/form")
async def get_intake_form(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the intake form structure (form_id + fields + options) so the frontend knows field IDs."""
    form = await _get_intake_form(db)
    return {
        "form_id": form.form_id,
        "title": form.title,
        "description": form.description,
        "fields": [
            _serialize_intake_field(f)
            for f in sorted(form.fields, key=lambda x: x.display_order)
        ],
    }


@router.post("")
async def submit_intake(
    payload: IntakeSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """
    Submit the intake questionnaire.
    - Profile fields are written directly to participant_profiles.
    - Form answers are saved as a FormSubmission against the Intake Form.
    """
    participant = await _get_participant(current_user.user_id, db)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant profile not found.")

    # 1. Find the intake form
    form = await _get_intake_form(db)
    form_fields = {field.field_id: field for field in form.fields}

    # 2. Check for existing intake submission — if already submitted, return success
    #    so the frontend can proceed to call /complete (handles crash-recovery gracefully)
    existing = await db.execute(
        select(FormSubmission).where(
            FormSubmission.form_id == form.form_id,
            FormSubmission.participant_id == participant.participant_id,
            FormSubmission.submitted_at.isnot(None),
        )
    )
    existing_sub = existing.scalar_one_or_none()
    if existing_sub:
        return {"message": "Intake already submitted.", "submission_id": str(existing_sub.submission_id)}

    # 3. Create the form submission (no deployment check — intake is open to all participants)
    submission = FormSubmission(
        form_id=form.form_id,
        participant_id=participant.participant_id,
        group_id=None,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    await db.flush()

    # 4. Save answers and collect mapped profile updates
    answer_records = _build_answer_records([answer.model_dump() for answer in payload.answers], submission.submission_id)
    profile_updates: dict[str, Any] = {
        "program_enrolled_at": datetime.now(timezone.utc),
    }
    for record, *_ in answer_records:
        db.add(record)

    for _, field_uuid, val_text, val_num, val_json in answer_records:
        field = form_fields.get(field_uuid)
        if not field or not field.profile_field:
            continue
        if field.profile_field not in PROFILE_FIELD_NAMES:
            continue

        raw_value = val_json if val_json is not None else val_num if val_num is not None else val_text
        raw_value = _resolve_profile_field_raw_value(field, raw_value)
        profile_updates[field.profile_field] = _normalize_profile_field_value(field.profile_field, raw_value)

    if profile_updates:
        await db.execute(
            update(ParticipantProfile)
            .where(ParticipantProfile.participant_id == participant.participant_id)
            .values(**profile_updates)
        )

    # 5. Project mapped fields into HealthDataPoint (if any field has an element_id mapping)
    field_ids = [field_uuid for _, field_uuid, *_ in answer_records]
    if field_ids:
        map_result = await db.execute(
            select(FieldElementMap).where(FieldElementMap.field_id.in_(field_ids))
        )
        field_map = {row.field_id: row for row in map_result.scalars().all()}

        for _, field_uuid, val_text, val_num, val_json in answer_records:
            mapping = field_map.get(field_uuid)
            if not mapping:
                continue
            val_text, val_num, val_json = _apply_transform(val_text, val_num, val_json, mapping.transform_rule)
            db.add(HealthDataPoint(
                participant_id=participant.participant_id,
                element_id=mapping.element_id,
                source_type="intake",
                source_submission_id=submission.submission_id,
                source_field_id=field_uuid,
                value_text=val_text,
                value_number=val_num,
                value_json=val_json,
                observed_at=datetime.now(timezone.utc),
            ))

    await db.commit()
    return {"message": "Intake submitted successfully.", "submission_id": str(submission.submission_id)}


# ── Consent & Background Info ──────────────────────────────────────────────────

@router.get("/consent-form", dependencies=[Depends(require_permissions(ONBOARDING_READ))])
async def get_consent_form(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the active consent form template."""
    template = await get_active_consent_template(db)
    if not template:
        raise HTTPException(status_code=404, detail="No active consent form template found.")
    return {
        "template_id": str(template.template_id),
        "version": template.version,
        "title": template.title,
        "subtitle": template.subtitle,
        "items": template.items,
        "is_active": template.is_active,
        "created_at": template.created_at,
    }


@router.get("/background-info", dependencies=[Depends(require_permissions(ONBOARDING_READ))])
async def get_background_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the active background info template."""
    template = await get_active_background_template(db)
    if not template:
        raise HTTPException(status_code=404, detail="No active background info template found.")
    return {
        "template_id": str(template.template_id),
        "version": template.version,
        "title": template.title,
        "subtitle": template.subtitle,
        "sections": template.sections,
        "is_active": template.is_active,
        "created_at": template.created_at,
    }


@router.get("/status", dependencies=[Depends(require_permissions(ONBOARDING_READ))])
async def get_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the current participant's onboarding status."""
    status = await get_onboarding_status(current_user.user_id, db)
    return {"onboarding_status": status}


@router.post("/background-read", dependencies=[Depends(require_permissions(ONBOARDING_SUBMIT))])
async def background_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Mark the background info as read (advances status from PENDING → BACKGROUND_READ)."""
    try:
        await mark_background_read(current_user.user_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Background info marked as read."}


@router.post("/consent", dependencies=[Depends(require_permissions(ONBOARDING_SUBMIT))])
async def submit_consent_route(
    payload: ConsentSubmitIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Submit consent form answers and signature (advances status → CONSENT_GIVEN)."""
    participant = await _get_participant(current_user.user_id, db)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant profile not found.")

    template = await get_active_consent_template(db)
    if not template:
        raise HTTPException(status_code=404, detail="No active consent form template found.")

    try:
        consent = await submit_consent(
            participant_id=participant.participant_id,
            template_id=template.template_id,
            answers=payload.answers,
            signature=payload.signature,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Consent submitted.", "consent_id": str(consent.consent_id)}


@router.post("/complete", dependencies=[Depends(require_permissions(ONBOARDING_SUBMIT))])
async def complete_onboarding_route(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Complete onboarding (advances status from CONSENT_GIVEN → COMPLETED)."""
    try:
        await complete_onboarding(current_user.user_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    admin_rows = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
    )
    admin_ids = [row[0] for row in admin_rows.all()]
    if admin_ids:
        display_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or "A participant"
        await create_notifications_bulk(
            db=db,
            user_ids=admin_ids,
            notification_type="summary",
            title="Participant completed onboarding",
            message=f"{display_name} completed onboarding.",
            link="/admin/system-insights",
            role_target="admin",
            source_type="onboarding_completed",
            source_id=current_user.user_id,
        )
    return {"message": "Onboarding completed."}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.put("/admin/consent-template", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def update_consent_template_route(
    payload: ConsentTemplateUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Create a new version of the consent form template (deactivates previous)."""
    template = await update_consent_template(
        items=payload.items,
        title=payload.title,
        subtitle=payload.subtitle,
        admin_user_id=current_user.user_id,
        db=db,
    )
    return {"message": "Consent template updated.", "version": template.version, "template_id": str(template.template_id)}


@router.put("/admin/background-template", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def update_background_template_route(
    payload: BackgroundInfoUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Create a new version of the background info template (deactivates previous)."""
    template = await update_background_template(
        sections=payload.sections,
        title=payload.title,
        subtitle=payload.subtitle,
        admin_user_id=current_user.user_id,
        db=db,
    )
    return {"message": "Background template updated.", "version": template.version, "template_id": str(template.template_id)}


@router.get("/admin/intake-form", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def get_admin_intake_form(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Return the intake form with all fields and options (admin view)."""
    form = await _find_intake_form(db)
    if not form:
        return {
            "form_id": None,
            "title": INTAKE_FORM_TITLE,
            "fields": [],
        }
    return {
        "form_id": str(form.form_id),
        "title": form.title,
        "fields": [
            _serialize_intake_field(f)
            for f in sorted(form.fields, key=lambda x: x.display_order)
        ],
    }


@router.put("/admin/intake-form", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def update_intake_form_route(
    payload: IntakeFormUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_current_user),
):
    """Update the intake form fields in-place (replaces all fields)."""
    form = await _get_or_create_intake_form(db, current_user.user_id)

    # Delete existing fields (cascades to options via FK)
    existing_fields = (await db.execute(
        select(FormField).where(FormField.form_id == form.form_id)
    )).scalars().all()
    for f in existing_fields:
        await db.delete(f)
    await db.flush()

    # Create new fields and options
    for i, field_data in enumerate(payload.fields):
        profile_field = field_data.get("profile_field") or None
        if profile_field is not None and profile_field not in PROFILE_FIELD_NAMES:
            raise HTTPException(status_code=400, detail=f"Unsupported profile field mapping: {profile_field}")
        new_field = FormField(
            form_id=form.form_id,
            label=field_data["label"],
            field_type=field_data["field_type"],
            profile_field=profile_field,
            is_required=field_data.get("is_required", False),
            display_order=field_data.get("display_order", i + 1),
        )
        db.add(new_field)
        await db.flush()

        for j, opt in enumerate(field_data.get("options") or []):
            db.add(FieldOption(
                field_id=new_field.field_id,
                label=opt.get("label", ""),
                value=opt.get("value", j),
                display_order=opt.get("display_order", j),
            ))

    await db.commit()
    return {"message": "Intake form updated."}
