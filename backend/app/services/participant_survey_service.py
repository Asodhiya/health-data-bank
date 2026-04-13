"""
Participant Survey Service
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.db.models import (
    SurveyForm, FormDeployment, GroupMember, FormSubmission,
    SubmissionAnswer, FormField, ParticipantProfile,
    FieldElementMap, HealthDataPoint, Group, CaretakerProfile, FieldOption, DataElement
)
from app.services.notification_service import create_notification, notification_exists_recent
from app.services.survey_cadence import as_utc, get_cycle_key, get_cycle_label, normalize_cadence

async def _get_participant(user_id: UUID, db: AsyncSession) -> Optional[ParticipantProfile]:
    """Resolve user_id to ParticipantProfile, or return None."""
    result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _get_deployed_forms(participant_id: UUID, db: AsyncSession):
    """Fetch all published, non-revoked forms deployed to the participant's groups."""
    result = await db.execute(
        select(SurveyForm, FormDeployment)
        .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                GroupMember.participant_id == participant_id,
                GroupMember.left_at.is_(None),
                SurveyForm.status == "PUBLISHED",
                FormDeployment.revoked_at.is_(None)
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    return result.all()


def _resolve_cycle_context(
    survey: SurveyForm,
    deployment: FormDeployment,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_time = as_utc(now) or datetime.now(timezone.utc)
    cadence = normalize_cadence(
        getattr(deployment, "cadence", None) or getattr(survey, "cadence", "once")
    )
    anchor = (
        as_utc(getattr(deployment, "cadence_anchor_at", None))
        or as_utc(getattr(deployment, "deployed_at", None))
        or as_utc(getattr(survey, "cadence_anchor_at", None))
        or as_utc(getattr(survey, "created_at", None))
        or current_time
    )
    return {
        "cadence": cadence,
        "anchor": anchor,
        "cycle_key": get_cycle_key(cadence, current_time, anchor),
        "cycle_label": get_cycle_label(cadence),
    }


async def _get_submissions_map(
    participant_id: UUID,
    deployment_rows: list,
    db: AsyncSession,
) -> dict:
    """Return {(form_id, cycle_key): FormSubmission} for the participant across deployed forms."""
    if not deployment_rows:
        return {}

    form_ids = list({survey.form_id for survey, _ in deployment_rows})
    result = await db.execute(
        select(FormSubmission)
        .where(
            and_(
                FormSubmission.participant_id == participant_id,
                FormSubmission.form_id.in_(form_ids),
            )
        )
        .order_by(desc(FormSubmission.submitted_at))
    )

    expected_cycle_keys = {
        (survey.form_id, _resolve_cycle_context(survey, deployment)["cycle_key"])
        for survey, deployment in deployment_rows
    }
    submissions = {}
    for sub in result.scalars().all():
        cycle_key = sub.cycle_key or "once"
        key = (sub.form_id, cycle_key)
        if key not in expected_cycle_keys or key in submissions:
            continue
        submissions[key] = sub
    return submissions


async def _get_answer_counts(sub_ids: list, db: AsyncSession) -> dict:
    """Return {submission_id: answer_count} for the given submission ids."""
    result = await db.execute(
        select(SubmissionAnswer.submission_id, func.count(SubmissionAnswer.field_id))
        .where(SubmissionAnswer.submission_id.in_(sub_ids))
        .group_by(SubmissionAnswer.submission_id)
    )
    return {sub_id: count for sub_id, count in result}


async def _get_question_counts(form_ids: list, db: AsyncSession) -> dict:
    """Return {form_id: question_count} for the given form ids."""
    result = await db.execute(
        select(FormField.form_id, func.count(FormField.field_id))
        .where(FormField.form_id.in_(form_ids))
        .group_by(FormField.form_id)
    )
    return {f_id: count for f_id, count in result}


def _build_survey_status(sub) -> tuple:
    """Derive (status, submitted_at) from a submission row (or None)."""
    if not sub:
        return "NEW", None
    if sub.submitted_at:
        return "COMPLETED", sub.submitted_at
    return "IN_PROGRESS", None


async def list_assigned_surveys(user_id: UUID, db: AsyncSession) -> List[Dict[str, Any]]:
    """List all surveys assigned to the participant (includes question/answer count)"""
    participant = await _get_participant(user_id, db)
    if not participant:
        return []

    rows = await _get_deployed_forms(participant.participant_id, db)
    if not rows:
        return []

    deduped_rows = []
    seen_form_ids = set()
    for survey, deployment in rows:
        if survey.form_id in seen_form_ids:
            continue
        seen_form_ids.add(survey.form_id)
        deduped_rows.append((survey, deployment))

    form_ids = [survey.form_id for survey, _ in deduped_rows]
    submissions_map = await _get_submissions_map(participant.participant_id, deduped_rows, db)

    sub_ids = [sub.submission_id for sub in submissions_map.values()]
    answer_counts = await _get_answer_counts(sub_ids, db) if sub_ids else {}
    question_counts = await _get_question_counts(form_ids, db)

    output = []
    for survey, deployment in deduped_rows:
        cycle_context = _resolve_cycle_context(survey, deployment)
        sub = submissions_map.get((survey.form_id, cycle_context["cycle_key"]))
        status, submitted_at = _build_survey_status(sub)
        answered = answer_counts.get(sub.submission_id, 0) if sub else 0

        output.append({
            "form_id": survey.form_id,
            "title": survey.title,
            "description": survey.description,
            "status": status,
            "cadence": cycle_context["cadence"],
            "cycle_key": cycle_context["cycle_key"],
            "cycle_label": cycle_context["cycle_label"],
            "version": survey.version or 1,
            "due_date": None,
            "deployed_at": deployment.deployed_at,
            "submitted_at": submitted_at,
            "question_count": question_counts.get(survey.form_id, 0),
            "answered_count": answered
        })

    return output

async def get_participant_survey_detail(form_id: UUID, user_id: UUID, db: AsyncSession) -> Optional[SurveyForm]:
    """Get survey details of selected survey"""
    participant = await _get_participant(user_id, db)
    if not participant:
        return None

    stmt = (
        select(FormDeployment)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                FormDeployment.form_id == form_id,
                GroupMember.participant_id == participant.participant_id,
                GroupMember.left_at.is_(None),
                FormDeployment.revoked_at.is_(None),
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    result = await db.execute(stmt)
    deployment = result.scalars().first()
    
    if not deployment:
        return None 

    stmt = (
        select(SurveyForm)
        .where(SurveyForm.form_id == form_id)
        .options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_participant_survey_response(form_id: UUID, user_id: UUID, db: AsyncSession) -> Optional[FormSubmission]:
    """Get existing submission (draft or completed)"""
    participant = await _get_participant(user_id, db)
    if not participant:
        return None

    deployment_stmt = (
        select(SurveyForm, FormDeployment)
        .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                SurveyForm.form_id == form_id,
                GroupMember.participant_id == participant.participant_id,
                GroupMember.left_at.is_(None),
                FormDeployment.revoked_at.is_(None),
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    deployment_result = await db.execute(deployment_stmt)
    deployment_row = deployment_result.first()
    if not deployment_row:
        return None

    survey, deployment = deployment_row
    cycle_context = _resolve_cycle_context(survey, deployment)

    stmt = (
        select(FormSubmission)
        .where(
            and_(
                FormSubmission.form_id == form_id,
                FormSubmission.participant_id == participant.participant_id,
                FormSubmission.cycle_key == cycle_context["cycle_key"],
            )
        )
        .order_by(desc(FormSubmission.submitted_at))
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()

    if not submission:
        return None

    stmt_answers = select(SubmissionAnswer).where(SubmissionAnswer.submission_id == submission.submission_id)
    result_answers = await db.execute(stmt_answers)
    answers = result_answers.scalars().all()

    submission.answers = answers
    return submission


async def _get_participant_and_submission(
    form_id: UUID, user_id: UUID, db: AsyncSession
):
    """Shared setup: resolve participant, verify deployment, get or create submission."""
    participant = await _get_participant(user_id, db)
    if not participant:
        raise ValueError("User is not a participant")

    stmt = (
        select(SurveyForm, FormDeployment)
        .join(SurveyForm, SurveyForm.form_id == FormDeployment.form_id)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                FormDeployment.form_id == form_id,
                GroupMember.participant_id == participant.participant_id,
                GroupMember.left_at.is_(None),
                FormDeployment.revoked_at.is_(None),
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    result = await db.execute(stmt)
    deployment_row = result.first()
    if not deployment_row:
        raise ValueError("Form not assigned to participant")
    form, deployment = deployment_row
    cycle_context = _resolve_cycle_context(form, deployment)

    stmt = select(FormSubmission).where(
        and_(
            FormSubmission.form_id == form_id,
            FormSubmission.participant_id == participant.participant_id,
            FormSubmission.cycle_key == cycle_context["cycle_key"],
        )
    )
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if submission:
        if submission.submitted_at is not None:
            raise ValueError("Cannot modify a completed submission")
        from sqlalchemy import delete
        await db.execute(delete(SubmissionAnswer).where(SubmissionAnswer.submission_id == submission.submission_id))
    else:
        submission = FormSubmission(
            form_id=form_id,
            participant_id=participant.participant_id,
            group_id=deployment.group_id,
            cycle_key=cycle_context["cycle_key"],
        )
        db.add(submission)
        await db.flush()

    return participant, submission


def _build_answer_records(answers: List[Dict[str, Any]], submission_id):
    """Convert raw answer dicts into (SubmissionAnswer, field_uuid, val_text, val_num, val_json) tuples."""
    records = []
    for ans in answers:
        field_id = ans.get('field_id')
        value = ans.get('value')

        if not field_id:
            continue

        val_text = None
        val_num = None
        val_json = None

        if value is None:
            pass
        elif isinstance(value, (int, float)):
            val_num = value
        elif isinstance(value, (dict, list)):
            val_json = value
        else:
            val_text = str(value)

        field_uuid = UUID(field_id) if isinstance(field_id, str) else field_id
        record = SubmissionAnswer(
            submission_id=submission_id,
            field_id=field_uuid,
            value_text=val_text,
            value_number=val_num,
            value_json=val_json
        )
        records.append((record, field_uuid, val_text, val_num, val_json))
    return records


async def _load_field_meta(field_ids: List[UUID], db: AsyncSession) -> Dict[UUID, Dict[str, Any]]:
    if not field_ids:
        return {}

    result = await db.execute(
        select(FormField, FieldOption)
        .outerjoin(FieldOption, FieldOption.field_id == FormField.field_id)
        .where(FormField.field_id.in_(field_ids))
    )

    field_meta: Dict[UUID, Dict[str, Any]] = {}
    for field, option in result.all():
        meta = field_meta.setdefault(
            field.field_id,
            {
                "field_type": field.field_type,
                "field_label": field.label,
                "options": {},
            },
        )
        if option is not None and option.value is not None and option.label is not None:
            meta["options"][int(option.value)] = str(option.label)

    return field_meta


def _is_caretaker_message_element(element: DataElement | None) -> bool:
    if element is None:
        return False
    haystack = " ".join(
        str(value or "") for value in (element.code, element.label, element.description)
    ).lower()
    audience_tokens = {"caretaker", "care team", "careteam"}
    if not any(token in haystack for token in audience_tokens):
        return False
    return any(token in haystack for token in {"note", "notes", "message", "messages"})


def _format_message_value(
    val_text: Optional[str],
    val_num: Optional[float],
    val_json: Optional[Any],
) -> str:
    if val_text is not None and str(val_text).strip():
        return str(val_text).strip()
    if val_num is not None:
        numeric = float(val_num)
        return str(int(numeric)) if numeric.is_integer() else str(numeric)
    if isinstance(val_json, list):
        return ", ".join(str(item) for item in val_json)
    if isinstance(val_json, dict):
        return ", ".join(f"{key}: {value}" for key, value in val_json.items())
    return ""


def _resolve_answer_value(
    field_uuid: UUID,
    val_text: Optional[str],
    val_num: Optional[float],
    val_json: Optional[Any],
    field_meta: Dict[UUID, Dict[str, Any]],
) -> tuple[Optional[str], Optional[float], Optional[Any]]:
    meta = field_meta.get(field_uuid)
    if not meta:
        return val_text, val_num, val_json

    field_type = str(meta.get("field_type") or "").lower()
    options = meta.get("options") or {}

    if field_type in {"single_select", "dropdown"} and val_num is not None:
        label = options.get(int(val_num))
        if label is None:
            return val_text, val_num, val_json
        return label, None, None

    if field_type == "multi_select" and isinstance(val_json, list):
        resolved = [
            options.get(int(value), value) if isinstance(value, (int, float)) else value
            for value in val_json
        ]
        return None, None, resolved

    if field_type == "likert" and val_num is not None:
        label = options.get(int(val_num))
        return (label or val_text), val_num, None

    return val_text, val_num, val_json


async def save_survey_response(form_id: UUID, user_id: UUID, answers: List[Dict[str, Any]], db: AsyncSession) -> FormSubmission:
    """Save survey answers as a draft (no submission timestamp, no health data projection)."""
    _, submission = await _get_participant_and_submission(form_id, user_id, db)
    submission.submitted_at = None

    for record, *_ in _build_answer_records(answers, submission.submission_id):
        db.add(record)

    await db.commit()
    return submission


def _apply_transform(
    val_text: Optional[str],
    val_num: Optional[float],
    val_json: Optional[Dict[str, Any]],
    transform_rule: Optional[Dict[str, Any]],
) -> tuple[Optional[str], Optional[float], Optional[Dict[str, Any]]]:
    """Normalise a raw answer value to the element's canonical unit.

    Rules are applied in order: offset → multiply → map → extract.
    Unknown keys are silently ignored (forward compatible).
    Mismatched rules (e.g. multiply on a text value) are silently skipped.

    Supported rule keys
    -------------------
    offset : int | float
        Added to val_num before multiply. Use with multiply for affine
        conversions (e.g. °F→°C: offset=-32, multiply=0.5556).
    multiply : int | float
        Scales val_num by this factor (e.g. lbs→kg: 0.453592).
    map : dict
        Remaps val_text (or str(val_num)) to another value.
        If the mapped value is numeric → stored as val_num, val_text cleared.
        If the mapped value is a string → replaces val_text.
    extract : str
        Pulls a sub-key from val_json (e.g. "systolic" from a BP object).
        Result is stored as val_num if numeric, else val_text.
    """
    if not transform_rule:
        return val_text, val_num, val_json

    # offset
    if "offset" in transform_rule and val_num is not None:
        val_num = val_num + transform_rule["offset"]

    # multiply
    if "multiply" in transform_rule and val_num is not None:
        val_num = val_num * transform_rule["multiply"]

    # map
    if "map" in transform_rule:
        key = val_text if val_text is not None else (str(int(val_num)) if val_num is not None else None)
        if key is not None:
            mapped = transform_rule["map"].get(key)
            if mapped is not None:
                if isinstance(mapped, (int, float)):
                    val_num = float(mapped)
                    val_text = None
                else:
                    val_text = str(mapped)

    # extract
    if "extract" in transform_rule and isinstance(val_json, dict):
        extracted = val_json.get(transform_rule["extract"])
        if extracted is not None:
            if isinstance(extracted, (int, float)):
                val_num = float(extracted)
                val_text = None
            else:
                val_text = str(extracted)
            val_json = None

    return val_text, val_num, val_json


async def submit_survey_response(form_id: UUID, user_id: UUID, answers: List[Dict[str, Any]], db: AsyncSession) -> FormSubmission:
    """Submit survey answers and project mapped fields into HealthDataPoint records."""
    participant, submission = await _get_participant_and_submission(form_id, user_id, db)
    submission.submitted_at = datetime.now(timezone.utc)

    answer_records = _build_answer_records(answers, submission.submission_id)
    for record, *_ in answer_records:
        db.add(record)

    field_ids = [field_uuid for _, field_uuid, *_ in answer_records]
    field_meta = await _load_field_meta(field_ids, db)
    map_stmt = (
        select(FieldElementMap, DataElement)
        .join(DataElement, DataElement.element_id == FieldElementMap.element_id)
        .where(FieldElementMap.field_id.in_(field_ids))
    )
    map_result = await db.execute(map_stmt)
    field_map: Dict[UUID, Dict[str, Any]] = {
        mapping.field_id: {"mapping": mapping, "element": element}
        for mapping, element in map_result.all()
    }

    caretaker_messages: list[dict[str, str]] = []

    for _, field_uuid, val_text, val_num, val_json in answer_records:
        mapping_meta = field_map.get(field_uuid)
        if not mapping_meta:
            continue
        mapping = mapping_meta["mapping"]
        element = mapping_meta["element"]
        val_text, val_num, val_json = _resolve_answer_value(field_uuid, val_text, val_num, val_json, field_meta)
        val_text, val_num, val_json = _apply_transform(val_text, val_num, val_json, mapping.transform_rule)

        if _is_caretaker_message_element(element):
            message_text = _format_message_value(val_text, val_num, val_json)
            if message_text:
                field_label = str((field_meta.get(field_uuid) or {}).get("field_label") or element.label or "Message")
                caretaker_messages.append({
                    "field_label": field_label,
                    "message": message_text,
                })
            continue

        dp = HealthDataPoint(
            participant_id=participant.participant_id,
            element_id=mapping.element_id,
            source_type="survey",
            source_submission_id=submission.submission_id,
            source_field_id=field_uuid,
            value_text=val_text,
            value_number=val_num,
            value_json=val_json,
            observed_at=datetime.now(timezone.utc)
        )
        db.add(dp)

    form = await db.scalar(select(SurveyForm).where(SurveyForm.form_id == form_id))
    if form and form.created_by:
        already_notified = await notification_exists_recent(
            db,
            user_id=form.created_by,
            notification_type="summary",
            source_type="form_submission",
            source_id=form.form_id,
            within_hours=1,
        )
        if not already_notified:
            await create_notification(
                db=db,
                user_id=form.created_by,
                notification_type="summary",
                title="New form submission",
                message=f"A participant submitted '{form.title}'.",
                link="/researcher",
                role_target="researcher",
                source_type="form_submission",
                source_id=form.form_id,
            )

    if submission.group_id:
        caretaker_user_id = await db.scalar(
            select(CaretakerProfile.user_id)
            .join(Group, Group.caretaker_id == CaretakerProfile.caretaker_id)
            .where(Group.group_id == submission.group_id)
        )
        if caretaker_user_id:
            if caretaker_messages:
                participant_name = " ".join(
                    part for part in [getattr(participant, "first_name", None), getattr(participant, "last_name", None)] if part
                ).strip() or "A participant"
                combined_message = "\n".join(
                    f"{entry['field_label']}: {entry['message']}" for entry in caretaker_messages
                )
                already_notified = await notification_exists_recent(
                    db,
                    user_id=caretaker_user_id,
                    notification_type="message",
                    source_type="participant_message",
                    source_id=submission.submission_id,
                    within_hours=24,
                )
                if not already_notified:
                    await create_notification(
                        db=db,
                        user_id=caretaker_user_id,
                        notification_type="message",
                        title="Participant message received",
                        message=f"{participant_name} sent a message from '{form.title if form else 'a survey'}'.\n{combined_message}",
                        link="/caretaker/participants",
                        role_target="caretaker",
                        source_type="participant_message",
                        source_id=submission.submission_id,
                    )

            already_notified = await notification_exists_recent(
                db,
                user_id=caretaker_user_id,
                notification_type="submission",
                source_type="group_submission",
                source_id=submission.group_id,
                within_hours=1,
            )
            if not already_notified:
                await create_notification(
                    db=db,
                    user_id=caretaker_user_id,
                    notification_type="submission",
                    title="Participant submitted a survey",
                    message=f"A participant in your group submitted '{form.title if form else 'a survey'}'.",
                    link="/caretaker/participants",
                    role_target="caretaker",
                    source_type="group_submission",
                    source_id=submission.group_id,
                )

    await db.commit()
    return submission
