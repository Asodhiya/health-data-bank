"""
Onboarding routes — intake form discovery and submission, consent, background info.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime, date

from app.db.session import get_db
from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import ONBOARDING_READ, ONBOARDING_SUBMIT, ONBOARDING_EDIT
from app.db.models import (
    User, SurveyForm, FormField, FormSubmission,
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
)

router = APIRouter()

INTAKE_FORM_TITLE = "Intake Form"


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
            {
                "field_id": f.field_id,
                "label": f.label,
                "field_type": f.field_type,
                "is_required": f.is_required,
                "display_order": f.display_order,
                "options": [
                    {
                        "option_id": o.option_id,
                        "label": o.label,
                        "value": o.value,
                        "display_order": o.display_order,
                    }
                    for o in sorted(f.options, key=lambda x: x.display_order)
                ],
            }
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

    # 1. Update participant_profiles with profile fields
    profile_data = payload.profile.model_dump(exclude_none=True)
    if "dob" in profile_data and isinstance(profile_data["dob"], str):
        profile_data["dob"] = date.fromisoformat(profile_data["dob"])
    profile_data["program_enrolled_at"] = datetime.now()
    if profile_data:
        await db.execute(
            update(ParticipantProfile)
            .where(ParticipantProfile.participant_id == participant.participant_id)
            .values(**profile_data)
        )

    # 2. Find the intake form
    form = await _get_intake_form(db)

    # 3. Prevent duplicate intake submission
    existing = await db.execute(
        select(FormSubmission).where(
            FormSubmission.form_id == form.form_id,
            FormSubmission.participant_id == participant.participant_id,
            FormSubmission.submitted_at.isnot(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Intake questionnaire already submitted.")

    # 4. Create the form submission (no deployment check — intake is open to all participants)
    submission = FormSubmission(
        form_id=form.form_id,
        participant_id=participant.participant_id,
        group_id=None,
        submitted_at=datetime.now(),
    )
    db.add(submission)
    await db.flush()

    # 5. Save answers
    answer_records = _build_answer_records(payload.answers, submission.submission_id)
    for record, *_ in answer_records:
        db.add(record)

    # 6. Project mapped fields into HealthDataPoint (if any field has an element_id mapping)
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
                observed_at=datetime.now(),
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
