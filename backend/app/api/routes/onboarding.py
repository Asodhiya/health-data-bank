"""
Onboarding routes — intake form discovery and submission.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime, date

from app.db.session import get_db
from app.core.dependency import check_current_user
from app.db.models import (
    User, SurveyForm, FormField, FormSubmission,
    ParticipantProfile, FieldElementMap, HealthDataPoint
)
from app.services.participant_survey_service import _get_participant, _build_answer_records, _apply_transform
from app.schemas.onboarding_schema import IntakeSubmission

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