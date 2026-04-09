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
    FieldElementMap, HealthDataPoint, Group, CaretakerProfile, FieldOption
)
from app.services.notification_service import create_notification, notification_exists_recent

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
                SurveyForm.status == "PUBLISHED",
                FormDeployment.revoked_at.is_(None)
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    return result.all()


async def _get_submissions_map(participant_id: UUID, form_ids: list, db: AsyncSession) -> dict:
    """Return {form_id: FormSubmission} for the participant across the given forms."""
    result = await db.execute(
        select(FormSubmission).where(
            and_(
                FormSubmission.participant_id == participant_id,
                FormSubmission.form_id.in_(form_ids)
            )
        )
    )
    return {sub.form_id: sub for sub in result.scalars()}


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

    form_ids = [row.SurveyForm.form_id for row in rows]
    submissions_map = await _get_submissions_map(participant.participant_id, form_ids, db)

    sub_ids = [sub.submission_id for sub in submissions_map.values()]
    answer_counts = await _get_answer_counts(sub_ids, db) if sub_ids else {}
    question_counts = await _get_question_counts(form_ids, db)

    output = []
    for survey, deployment in rows:
        sub = submissions_map.get(survey.form_id)
        status, submitted_at = _build_survey_status(sub)
        answered = answer_counts.get(sub.submission_id, 0) if sub else 0

        output.append({
            "form_id": survey.form_id,
            "title": survey.title,
            "description": survey.description,
            "status": status,
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
                FormDeployment.revoked_at.is_(None)
            )
        )
    )
    result = await db.execute(stmt)
    deployment = result.scalar_one_or_none()
    
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

    stmt = (
        select(FormSubmission)
        .where(
            and_(
                FormSubmission.form_id == form_id,
                FormSubmission.participant_id == participant.participant_id
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
        select(FormDeployment)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                FormDeployment.form_id == form_id,
                GroupMember.participant_id == participant.participant_id
            )
        )
    )
    result = await db.execute(stmt)
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise ValueError("Form not assigned to participant")

    stmt = select(FormSubmission).where(
        and_(
            FormSubmission.form_id == form_id,
            FormSubmission.participant_id == participant.participant_id
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
            group_id=deployment.group_id
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
                "options": {},
            },
        )
        if option is not None and option.value is not None and option.label is not None:
            meta["options"][int(option.value)] = str(option.label)

    return field_meta


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
    map_stmt = select(FieldElementMap).where(FieldElementMap.field_id.in_(field_ids))
    map_result = await db.execute(map_stmt)
    field_map: Dict[UUID, FieldElementMap] = {
        row.field_id: row for row in map_result.scalars().all()
    }

    for _, field_uuid, val_text, val_num, val_json in answer_records:
        mapping = field_map.get(field_uuid)
        if not mapping:
            continue
        val_text, val_num, val_json = _resolve_answer_value(field_uuid, val_text, val_num, val_json, field_meta)
        val_text, val_num, val_json = _apply_transform(val_text, val_num, val_json, mapping.transform_rule)
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
