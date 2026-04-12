"""
Onboarding routes — intake form discovery and submission, consent, background info.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete as sa_delete, func, or_
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timezone
from typing import Any

from app.core.dependency import check_current_user, get_rls_db, require_permissions, set_rls_context
from app.core.permissions import ONBOARDING_READ, ONBOARDING_SUBMIT, ONBOARDING_EDIT
from app.db.models import (
    User, Role, UserRole, SurveyForm, FormField, FieldOption, FormSubmission,
    ParticipantProfile, FieldElementMap, HealthDataPoint, SubmissionAnswer,
    DataElement
)
from app.services.participant_survey_service import (
    _get_participant,
    _build_answer_records,
    _apply_transform,
    _load_field_meta,
    _resolve_answer_value,
)
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
def _get_valid_profile_field_names() -> set[str]:
    """Return column names on ParticipantProfile that intake fields may write to."""
    return set(ParticipantProfile.__table__.columns.keys())


async def _get_intake_form(db: AsyncSession) -> SurveyForm:
    result = await db.execute(
        select(SurveyForm)
        .where(SurveyForm.title == INTAKE_FORM_TITLE)
        .options(
            selectinload(SurveyForm.fields).selectinload(FormField.options),
            selectinload(SurveyForm.fields).selectinload(FormField.element_maps),
        )
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found. Please contact an administrator.")
    return form


async def _find_intake_form(db: AsyncSession) -> SurveyForm | None:
    result = await db.execute(
        select(SurveyForm)
        .where(SurveyForm.title == INTAKE_FORM_TITLE)
        .options(
            selectinload(SurveyForm.fields).selectinload(FormField.options),
            selectinload(SurveyForm.fields).selectinload(FormField.element_maps),
        )
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
    element_id = None
    if field.element_maps:
        element_id = str(field.element_maps[0].element_id)
    return {
        "field_id": str(field.field_id),
        "label": field.label,
        "field_type": field.field_type,
        "is_required": field.is_required,
        "display_order": field.display_order,
        "profile_field": field.profile_field,
        "show_on_profile": bool(field.show_on_profile),
        "config": field.config,
        "element_id": element_id,
        "options": [
            {
                "label": o.label,
                "value": o.value,
                "display_order": o.display_order,
            }
            for o in sorted(field.options, key=lambda x: x.display_order)
        ],
    }


_VALID_CONFIG_KEYS = {"searchable", "creatable", "predefined_list", "conditional", "min", "max", "max_date_rule"}
_VALID_PREDEFINED_LISTS = {"languages", "countries", "pronouns"}
_VALID_DATE_RULES = {"adult_18"}

_FIELD_TYPE_CONFIG_KEYS: dict[str, set[str]] = {
    "text":          set(),
    "textarea":      set(),
    "number":        {"min", "max"},
    "date":          {"max_date_rule"},
    "single_select": {"conditional"},
    "multi_select":  {"searchable", "creatable", "predefined_list"},
    "dropdown":      {"searchable", "predefined_list"},
}


def _validate_field_config(field_type: str, config: dict | None) -> None:
    """Validate the config dict for a form field. Raises HTTPException on invalid config."""
    if not config:
        return

    # Type-aware key validation
    allowed = _FIELD_TYPE_CONFIG_KEYS.get(field_type, _VALID_CONFIG_KEYS)
    invalid_for_type = set(config.keys()) - allowed
    if invalid_for_type:
        unknown = invalid_for_type - _VALID_CONFIG_KEYS
        wrong_type = invalid_for_type - unknown
        parts = []
        if unknown:
            parts.append(f"Unknown config keys: {', '.join(sorted(unknown))}")
        if wrong_type:
            parts.append(f"Config keys not valid for {field_type}: {', '.join(sorted(wrong_type))}")
        raise HTTPException(status_code=400, detail=". ".join(parts))

    if "searchable" in config and not isinstance(config["searchable"], bool):
        raise HTTPException(status_code=400, detail="config.searchable must be a boolean.")

    if "creatable" in config and not isinstance(config["creatable"], bool):
        raise HTTPException(status_code=400, detail="config.creatable must be a boolean.")

    if "predefined_list" in config and config["predefined_list"] not in _VALID_PREDEFINED_LISTS:
        raise HTTPException(status_code=400, detail=f"config.predefined_list must be one of: {', '.join(sorted(_VALID_PREDEFINED_LISTS))}")

    if "min" in config and not isinstance(config["min"], (int, float)):
        raise HTTPException(status_code=400, detail="config.min must be a number.")

    if "max" in config and not isinstance(config["max"], (int, float)):
        raise HTTPException(status_code=400, detail="config.max must be a number.")

    if "max_date_rule" in config and config["max_date_rule"] not in _VALID_DATE_RULES:
        raise HTTPException(status_code=400, detail=f"config.max_date_rule must be one of: {', '.join(sorted(_VALID_DATE_RULES))}")

    if "conditional" in config:
        cond = config["conditional"]
        if not isinstance(cond, dict):
            raise HTTPException(status_code=400, detail="config.conditional must be an object.")
        if "trigger_value" not in cond or not isinstance(cond["trigger_value"], str):
            raise HTTPException(status_code=400, detail="config.conditional.trigger_value is required and must be a string.")
        if "sub_field_type" not in cond or cond["sub_field_type"] not in {"number"}:
            raise HTTPException(status_code=400, detail="config.conditional.sub_field_type is required and must be 'number'.")
        sub = cond.get("sub_config")
        if sub is not None:
            if not isinstance(sub, dict):
                raise HTTPException(status_code=400, detail="config.conditional.sub_config must be an object.")
            if "min" in sub and not isinstance(sub["min"], (int, float)):
                raise HTTPException(status_code=400, detail="config.conditional.sub_config.min must be a number.")
            if "max" in sub and not isinstance(sub["max"], (int, float)):
                raise HTTPException(status_code=400, detail="config.conditional.sub_config.max must be a number.")


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
        if value == "" or value is None:
            return None
        # If the value is a non-numeric string (e.g. option label "No" / "Yes"
        # from a single_select field), treat negative answers as 0 dependents
        # and ignore unresolvable labels so the intake submission isn't blocked.
        if isinstance(value, str) and not value.lstrip("-").isdigit():
            if value.lower() in ("no", "false", "none", "0"):
                return 0
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Dependents must be a whole number.") from exc
        if parsed < 0:
            raise HTTPException(status_code=400, detail="Dependents cannot be negative.")
        return parsed

    if isinstance(value, list):
        # For primary_language, store only the first selection in the profile column;
        # the full array is preserved in SubmissionAnswer and HealthDataPoint.
        if profile_field == "primary_language" and value:
            return str(value[0]).strip() or None
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
    db: AsyncSession = Depends(get_rls_db),
    current_user: User = Depends(check_current_user),
):
    """Return the intake form structure (form_id + fields + options) so the frontend knows field IDs.

    If the participant has a previous (possibly invalidated) submission, its
    answers are returned as ``previous_answers`` so the frontend can pre-fill
    unchanged fields instead of making the participant redo everything.
    """
    form = await _get_intake_form(db)

    # Look for previous answers to pre-fill the form
    previous_answers = None
    participant = await _get_participant(current_user.user_id, db)
    if participant:
        sub_result = await db.execute(
            select(FormSubmission)
            .where(
                FormSubmission.form_id == form.form_id,
                FormSubmission.participant_id == participant.participant_id,
            )
            .order_by(FormSubmission.submitted_at.desc().nulls_last())
            .limit(1)
        )
        submission = sub_result.scalar_one_or_none()
        if submission:
            ans_result = await db.execute(
                select(SubmissionAnswer).where(
                    SubmissionAnswer.submission_id == submission.submission_id,
                )
            )
            current_field_ids = {f.field_id for f in form.fields}
            prev = {}
            for answer in ans_result.scalars().all():
                if answer.field_id not in current_field_ids:
                    continue
                if answer.value_json is not None:
                    value = answer.value_json
                elif answer.value_number is not None:
                    num = answer.value_number
                    value = int(num) if num == int(num) else num
                else:
                    value = answer.value_text
                prev[str(answer.field_id)] = value
            if prev:
                previous_answers = prev

    return {
        "form_id": form.form_id,
        "title": form.title,
        "description": form.description,
        "fields": [
            _serialize_intake_field(f)
            for f in sorted(form.fields, key=lambda x: x.display_order)
        ],
        "previous_answers": previous_answers,
    }


@router.get("/profile-fields")
async def get_profile_intake_fields(
    db: AsyncSession = Depends(get_rls_db),
    current_user: User = Depends(check_current_user),
):
    """Return intake submission answers for fields marked show_on_profile=true."""
    participant = await _get_participant(current_user.user_id, db)
    if not participant:
        return {"fields": []}

    # Find the intake form
    form = await _find_intake_form(db)
    if not form:
        return {"fields": []}

    # Find the participant's submitted intake
    sub_result = await db.execute(
        select(FormSubmission).where(
            FormSubmission.form_id == form.form_id,
            FormSubmission.participant_id == participant.participant_id,
            FormSubmission.submitted_at.isnot(None),
        )
    )
    submission = sub_result.scalar_one_or_none()
    if not submission:
        return {"fields": []}

    # Fields with custom edit UIs in the frontend — kept hardcoded there,
    # so exclude them from the dynamic list to avoid duplication.
    _EDITABLE_PROFILE_COLUMNS = {"dob", "gender", "pronouns", "primary_language"}

    # Profile columns that map to ParticipantProfile table columns.
    # For these, read the current value from the profile record (may have
    # been edited after intake submission).
    _PROFILE_TABLE_COLUMNS = {
        "dob", "gender", "pronouns", "primary_language", "country_of_origin",
        "living_arrangement", "dependents", "occupation_status",
        "marital_status", "highest_education_level",
    }

    # Get fields marked show_on_profile with their options
    fields_result = await db.execute(
        select(FormField)
        .where(
            FormField.form_id == form.form_id,
            FormField.show_on_profile.is_(True),
            # Only exclude the fields with custom edit UIs
            or_(FormField.profile_field.notin_(_EDITABLE_PROFILE_COLUMNS), FormField.profile_field.is_(None)),
        )
        .options(selectinload(FormField.options))
        .order_by(FormField.display_order)
    )
    profile_fields = fields_result.scalars().all()
    if not profile_fields:
        return {"fields": []}

    # Get answers for those fields
    field_ids = [f.field_id for f in profile_fields]
    answers_result = await db.execute(
        select(SubmissionAnswer).where(
            SubmissionAnswer.submission_id == submission.submission_id,
            SubmissionAnswer.field_id.in_(field_ids),
        )
    )
    answers_by_field = {a.field_id: a for a in answers_result.scalars().all()}

    result_fields = []
    for field in profile_fields:
        # For fields mapped to profile table columns, read current value
        # from the profile record (it may have been updated after submission).
        if field.profile_field and field.profile_field in _PROFILE_TABLE_COLUMNS:
            raw_value = getattr(participant, field.profile_field, None)
            display_value = str(raw_value) if raw_value is not None else None
        else:
            answer = answers_by_field.get(field.field_id)
            if not answer:
                continue
            raw = answer.value_json if answer.value_json is not None else (
                answer.value_number if answer.value_number is not None else answer.value_text
            )
            display_value = _resolve_profile_field_raw_value(field, raw)
            if isinstance(display_value, list):
                display_value = ", ".join(str(v) for v in display_value)
            elif display_value is not None:
                display_value = str(display_value)

        # Determine if this field belongs to the demographics section
        # (mapped to a profile table column) or additional information
        is_demographic = field.profile_field in _PROFILE_TABLE_COLUMNS if field.profile_field else False

        result_fields.append({
            "label": field.label,
            "value": display_value,
            "field_type": field.field_type,
            "is_demographic": is_demographic,
        })

    return {"fields": result_fields}


@router.post("")
async def submit_intake(
    payload: IntakeSubmission,
    db: AsyncSession = Depends(get_rls_db),
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

    # 3. Remove old invalidated submissions (submitted_at IS NULL) so stale
    #    answers don't resurface during pre-fill after repeated admin resets.
    old_subs = await db.execute(
        select(FormSubmission.submission_id).where(
            FormSubmission.form_id == form.form_id,
            FormSubmission.participant_id == participant.participant_id,
            FormSubmission.submitted_at.is_(None),
        )
    )
    old_sub_ids = list(old_subs.scalars().all())
    if old_sub_ids:
        await db.execute(
            sa_delete(SubmissionAnswer).where(SubmissionAnswer.submission_id.in_(old_sub_ids))
        )
        await db.execute(
            sa_delete(FormSubmission).where(FormSubmission.submission_id.in_(old_sub_ids))
        )

    # 4. Create the form submission (no deployment check — intake is open to all participants)
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
    field_meta = await _load_field_meta([field_uuid for _, field_uuid, *_ in answer_records], db)
    valid_profile_fields = _get_valid_profile_field_names()
    profile_updates: dict[str, Any] = {
        "program_enrolled_at": datetime.now(timezone.utc),
    }
    for record, *_ in answer_records:
        db.add(record)

    for _, field_uuid, val_text, val_num, val_json in answer_records:
        field = form_fields.get(field_uuid)
        if not field or not field.profile_field:
            continue
        if field.profile_field not in valid_profile_fields:
            continue

        # Conditional single_select fields (e.g. dependents Yes/No + number)
        # store the actual numeric value, not an option index. Skip option-index
        # resolution so the number isn't misinterpreted as an option lookup.
        is_conditional = bool(field.config and field.config.get("conditional"))
        if not is_conditional:
            val_text, val_num, val_json = _resolve_answer_value(field_uuid, val_text, val_num, val_json, field_meta)
        raw_value = val_json if val_json is not None else val_num if val_num is not None else val_text
        if not is_conditional:
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
            field = form_fields.get(field_uuid)
            is_cond = bool(field and field.config and field.config.get("conditional"))
            if not is_cond:
                val_text, val_num, val_json = _resolve_answer_value(field_uuid, val_text, val_num, val_json, field_meta)
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
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
    current_user: User = Depends(check_current_user),
):
    """Return the current participant's onboarding status."""
    status = await get_onboarding_status(current_user.user_id, db)
    return {"onboarding_status": status}


@router.post("/background-read", dependencies=[Depends(require_permissions(ONBOARDING_SUBMIT))])
async def background_read(
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
    current_user: User = Depends(check_current_user),
):
    """Complete onboarding (advances status from CONSENT_GIVEN → COMPLETED)."""
    try:
        await complete_onboarding(current_user.user_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await set_rls_context(db, role="system")
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
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
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
    db: AsyncSession = Depends(get_rls_db),
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


@router.get("/admin/intake-form/affected-count", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def get_affected_participant_count(
    db: AsyncSession = Depends(get_rls_db),
    _current_user: User = Depends(check_current_user),
):
    """Return count of completed participants who would need to redo intake if the form changes."""
    result = await db.execute(
        select(func.count()).select_from(ParticipantProfile)
        .where(ParticipantProfile.onboarding_status == "COMPLETED")
    )
    return {"count": result.scalar() or 0}


@router.put("/admin/intake-form", dependencies=[Depends(require_permissions(ONBOARDING_EDIT))])
async def update_intake_form_route(
    payload: IntakeFormUpdateIn,
    db: AsyncSession = Depends(get_rls_db),
    current_user: User = Depends(check_current_user),
):
    """Update intake fields in-place, auto-link to data elements, reset participants if changed."""
    form = await _get_or_create_intake_form(db, current_user.user_id)

    # Load current fields/options once so we can update in place.
    existing_fields = (await db.execute(
        select(FormField)
        .where(FormField.form_id == form.form_id)
        .options(selectinload(FormField.options))
    )).scalars().all()
    existing_by_id = {field.field_id: field for field in existing_fields}
    incoming_ids: set[uuid.UUID] = set()

    # Validate incoming field IDs up front to avoid partial mutations.
    for i, field_data in enumerate(payload.fields):
        raw_field_id = field_data.get("field_id")
        if raw_field_id in (None, ""):
            continue
        try:
            field_uuid = uuid.UUID(str(raw_field_id))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid field_id at index {i}.") from exc

        if field_uuid in incoming_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate field_id at index {i}.")
        if field_uuid not in existing_by_id:
            raise HTTPException(status_code=400, detail=f"field_id at index {i} does not belong to intake form.")

        incoming_ids.add(field_uuid)

    # Fields omitted from payload are removal requests. Clean up their
    # submission answers so the FK doesn't block deletion, then delete.
    to_remove = [field for field in existing_fields if field.field_id not in incoming_ids]
    to_remove_ids = [field.field_id for field in to_remove]
    if to_remove_ids:
        # Delete submission answers that reference the removed fields.
        # The FormSubmission record and answers for other fields are preserved.
        await db.execute(
            sa_delete(SubmissionAnswer)
            .where(SubmissionAnswer.field_id.in_(to_remove_ids))
        )

    # ── Change detection ──────────────────────────────────────────────────
    form_changed = bool(to_remove) or len(payload.fields) != len(existing_fields)

    # Track all saved fields for auto-linking after the loop.
    saved_fields: list[FormField] = []

    # Update existing fields in place, create only new fields, and replace options.
    valid_profile_fields = _get_valid_profile_field_names()
    for i, field_data in enumerate(payload.fields):
        profile_field = field_data.get("profile_field") or None
        if profile_field is not None and profile_field not in valid_profile_fields:
            raise HTTPException(status_code=400, detail=f"Unsupported profile field mapping: {profile_field}")
        field_config = field_data.get("config") or None
        _validate_field_config(field_data["field_type"], field_config)

        raw_field_id = field_data.get("field_id")
        if raw_field_id not in (None, ""):
            field_uuid = uuid.UUID(str(raw_field_id))
            target_field = existing_by_id[field_uuid]

            # Detect property changes on existing field
            if not form_changed:
                existing_opts = sorted(target_field.options, key=lambda o: o.display_order)
                incoming_opts = field_data.get("options") or []
                opts_changed = len(existing_opts) != len(incoming_opts) or any(
                    eo.label != io.get("label", "")
                    for eo, io in zip(existing_opts, incoming_opts)
                )
                if (target_field.label != field_data["label"]
                        or target_field.field_type != field_data["field_type"]
                        or target_field.is_required != field_data.get("is_required", False)
                        or target_field.profile_field != profile_field
                        or target_field.config != field_config
                        or opts_changed):
                    form_changed = True

            target_field.label = field_data["label"]
            target_field.field_type = field_data["field_type"]
            target_field.profile_field = profile_field
            target_field.is_required = field_data.get("is_required", False)
            target_field.display_order = field_data.get("display_order", i + 1)
            target_field.config = field_config
            target_field.show_on_profile = field_data.get("show_on_profile", False)
        else:
            form_changed = True  # New field = form changed
            target_field = FormField(
                form_id=form.form_id,
                label=field_data["label"],
                field_type=field_data["field_type"],
                profile_field=profile_field,
                is_required=field_data.get("is_required", False),
                display_order=field_data.get("display_order", i + 1),
                config=field_config,
                show_on_profile=field_data.get("show_on_profile", False),
            )
            db.add(target_field)
            await db.flush()

        saved_fields.append(target_field)

        await db.execute(
            sa_delete(FieldOption).where(FieldOption.field_id == target_field.field_id)
        )

        for j, opt in enumerate(field_data.get("options") or []):
            db.add(FieldOption(
                field_id=target_field.field_id,
                label=opt.get("label", ""),
                value=opt.get("value", j),
                display_order=opt.get("display_order", j),
            ))

    # Delete fields omitted from payload (submission answers already cleaned up above).
    for field in to_remove:
        await db.execute(
            sa_delete(FieldElementMap).where(FieldElementMap.field_id == field.field_id)
        )
        await db.execute(
            sa_delete(FieldOption).where(FieldOption.field_id == field.field_id)
        )
        await db.delete(field)

    # ── Auto-link profile fields to data elements ─────────────────────────
    profile_field_codes = [
        f.profile_field for f in saved_fields if f.profile_field
    ]
    if profile_field_codes:
        el_result = await db.execute(
            select(DataElement).where(DataElement.code.in_(profile_field_codes))
        )
        code_to_element = {el.code: el for el in el_result.scalars().all()}
    else:
        code_to_element = {}

    all_saved_ids = [f.field_id for f in saved_fields]
    if all_saved_ids:
        await db.execute(
            sa_delete(FieldElementMap).where(FieldElementMap.field_id.in_(all_saved_ids))
        )

    for field in saved_fields:
        if field.profile_field:
            element = code_to_element.get(field.profile_field)
            if element:
                db.add(FieldElementMap(
                    field_id=field.field_id,
                    element_id=element.element_id,
                ))

    await db.flush()

    # ── Reset participants if form actually changed ───────────────────────
    participants_reset = 0
    if form_changed:
        reset_result = await db.execute(
            update(ParticipantProfile)
            .where(ParticipantProfile.onboarding_status == "COMPLETED")
            .values(onboarding_status="CONSENT_GIVEN")
        )
        participants_reset = reset_result.rowcount

        # Null out submitted_at so participants can re-submit intake
        await db.execute(
            update(FormSubmission)
            .where(
                FormSubmission.form_id == form.form_id,
                FormSubmission.submitted_at.isnot(None),
            )
            .values(submitted_at=None)
        )

    await db.commit()
    return {
        "message": "Intake form published.",
        "participants_reset": participants_reset,
    }
