from sqlalchemy import select, and_, or_, func, cast, String, exists
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.db.models import (
    User, FormSubmission, ParticipantProfile, SurveyForm,
    HealthDataPoint, DataElement, UserRole, Role, FormDeployment, Group, GroupMember,
    FormField, FieldElementMap, SubmissionAnswer,
)
from sqlalchemy.orm import selectinload
from app.schemas.filter_data_schema import ParticipantFilter
from datetime import date, datetime, timedelta, timezone, time
import csv
import io
from typing import Optional, Set
from uuid import UUID
from starlette.responses import StreamingResponse


PROFILE_DEMOGRAPHIC_FIELDS = {
    "dob",
    "gender",
    "pronouns",
    "primary_language",
    "living_arrangement",
    "dependents",
    "occupation_status",
    "marital_status",
    "highest_education_level",
}


def _normalize_profile_field_fallback(profile_field: str, value):
    if value is None:
        return None

    if profile_field == "dob":
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        try:
            return date.fromisoformat(str(value)[:10])
        except (TypeError, ValueError):
            return None

    if profile_field == "dependents":
        if isinstance(value, str) and not value.lstrip("-").isdigit():
            if value.lower() in ("no", "false", "none", "0"):
                return 0
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    if isinstance(value, list):
        if profile_field == "primary_language":
            return str(value[0]).strip() if value else None
        joined = ", ".join(str(v).strip() for v in value if str(v).strip())
        return joined or None

    if isinstance(value, dict):
        return None

    text = str(value).strip()
    return text or None


def _resolve_profile_field_answer(field: FormField, answer: SubmissionAnswer):
    raw_value = (
        answer.value_json
        if answer.value_json is not None
        else answer.value_number
        if answer.value_number is not None
        else answer.value_date
        if answer.value_date is not None
        else answer.value_text
    )

    if field.options:
        option_map = {
            option.value: option.label
            for option in field.options
            if option.label is not None
        }
        if isinstance(raw_value, list):
            raw_value = [option_map.get(value, value) for value in raw_value]
        else:
            raw_value = option_map.get(raw_value, raw_value)

    return _normalize_profile_field_fallback(field.profile_field or "", raw_value)


async def _load_intake_profile_fallbacks(
    db: AsyncSession,
    participant_ids: list,
) -> dict[str, dict[str, object]]:
    if not participant_ids:
        return {}

    intake_form_id = await db.scalar(
        select(SurveyForm.form_id).where(SurveyForm.title == "Intake Form").limit(1)
    )
    if not intake_form_id:
        return {}

    fields_result = await db.execute(
        select(FormField)
        .where(FormField.form_id == intake_form_id)
        .where(FormField.profile_field.in_(PROFILE_DEMOGRAPHIC_FIELDS))
        .options(selectinload(FormField.options))
    )
    intake_fields = fields_result.scalars().all()
    if not intake_fields:
        return {}

    field_map = {field.field_id: field for field in intake_fields}

    submissions_result = await db.execute(
        select(FormSubmission)
        .where(FormSubmission.form_id == intake_form_id)
        .where(FormSubmission.participant_id.in_(participant_ids))
        .where(FormSubmission.submitted_at.is_not(None))
        .order_by(FormSubmission.participant_id, FormSubmission.submitted_at.desc())
    )
    latest_submissions = {}
    for submission in submissions_result.scalars().all():
        latest_submissions.setdefault(submission.participant_id, submission)

    if not latest_submissions:
        return {}

    submission_ids = [submission.submission_id for submission in latest_submissions.values()]
    answers_result = await db.execute(
        select(SubmissionAnswer).where(SubmissionAnswer.submission_id.in_(submission_ids))
    )

    answers_by_submission: dict = {}
    for answer in answers_result.scalars().all():
        answers_by_submission.setdefault(answer.submission_id, []).append(answer)

    fallback_map: dict[str, dict[str, object]] = {}
    for participant_id, submission in latest_submissions.items():
        participant_key = str(participant_id)
        fallback_values: dict[str, object] = {}
        for answer in answers_by_submission.get(submission.submission_id, []):
            field = field_map.get(answer.field_id)
            if not field or not field.profile_field:
                continue
            fallback_value = _resolve_profile_field_answer(field, answer)
            if fallback_value is not None:
                fallback_values[field.profile_field] = fallback_value
        if fallback_values:
            fallback_map[participant_key] = fallback_values

    return fallback_map


async def _ensure_survey_access(
    db: AsyncSession,
    survey_id: str | UUID | None,
    current_user_id: UUID | None,
) -> None:
    if not survey_id or current_user_id is None:
        return
    survey = await db.execute(
        select(SurveyForm.form_id).where(
            SurveyForm.form_id == survey_id,
            or_(
                SurveyForm.status.in_(["PUBLISHED", "ARCHIVED", "DELETED"]),
                SurveyForm.title == "Intake Form",
            ),
        )
    )
    if survey.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="You do not have access to this survey.")


async def _get_survey_family_form_ids(
    db: AsyncSession,
    survey_id: str | UUID | None,
) -> list[UUID]:
    if not survey_id:
        return []

    root_id = await db.scalar(
        select(func.coalesce(SurveyForm.parent_form_id, SurveyForm.form_id))
        .where(SurveyForm.form_id == survey_id)
        .limit(1)
    )
    if not root_id:
        return []

    result = await db.execute(
        select(SurveyForm.form_id)
        .where(
            func.coalesce(SurveyForm.parent_form_id, SurveyForm.form_id) == root_id,
            SurveyForm.status.in_(["PUBLISHED", "ARCHIVED", "DELETED"]),
        )
    )
    return list(result.scalars().all())


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def calculate_age(born):
    if not born:
        return None
    today = _utc_today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _normalized_source_types(filters: Optional[ParticipantFilter]) -> list[str]:
    source_types = getattr(filters, "source_types", None) or ["survey"]
    normalized = []
    for source_type in source_types:
        if not source_type:
            continue
        lowered = source_type.lower()
        if lowered not in normalized:
            normalized.append(lowered)
    return normalized or ["survey"]


def _observed_at_bounds(filters: Optional[ParticipantFilter]) -> tuple[Optional[datetime], Optional[datetime]]:
    # Date scoping: returns observations within the provided window
    # (observed_at between date_from and date_to), not the latest observation
    # overall where observed_at happens to fall in range. Intentional.
    start = None
    end = None
    if getattr(filters, "date_from", None):
        start = datetime.combine(filters.date_from, time.min).replace(tzinfo=timezone.utc)
    if getattr(filters, "date_to", None):
        end = datetime.combine(filters.date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc)
    return start, end


def _coerce_numeric_filter_value(raw_value: str, field: str) -> float:
    try:
        return float(raw_value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Value '{raw_value}' is not valid for numeric field '{field}'.",
        ) from exc


def _normalized_group_by(filters: Optional[ParticipantFilter]) -> Optional[dict]:
    group_by = getattr(filters, "group_by", None)
    if not group_by:
        return None
    if isinstance(group_by, dict):
        return group_by
    return {
        "type": getattr(group_by, "type", None),
        "field": getattr(group_by, "field", None),
        "element_id": getattr(group_by, "element_id", None),
    }


def _sort_direction(filters: Optional[ParticipantFilter]) -> str:
    return "desc" if str(getattr(filters, "sort_dir", "asc")).lower() == "desc" else "asc"


def _sort_rows(rows: list[dict], sort_by: Optional[str], sort_dir: str) -> list[dict]:
    if not sort_by:
        return rows

    reverse = sort_dir == "desc"

    def sort_key(row: dict):
        value = row.get(sort_by)
        if sort_by == "participant":
            value = row.get("_participant_id")
        elif sort_by == "group_value":
            value = row.get("group_value")

        missing = value in (None, "")
        if isinstance(value, str):
            return (missing, value.lower())
        return (missing, value)

    return sorted(rows, key=sort_key, reverse=reverse)


def _apply_demographic_filters(stmt, filters: Optional[ParticipantFilter]):
    if not filters:
        return stmt

    enum_fields = {
        "gender": ParticipantProfile.gender,
        "pronouns": ParticipantProfile.pronouns,
        "occupation_status": ParticipantProfile.occupation_status,
        "living_arrangement": ParticipantProfile.living_arrangement,
        "highest_education_level": ParticipantProfile.highest_education_level,
        "marital_status": ParticipantProfile.marital_status,
    }
    free_text_fields = {
        "primary_language": ParticipantProfile.primary_language,
    }
    numeric_fields = {"dependents"}

    conditions = []
    for demographic_filter in getattr(filters, "demographic_filters", []) or []:
        field = demographic_filter.field
        operator = demographic_filter.operator

        if field in enum_fields:
            if operator != "eq":
                raise HTTPException(
                    status_code=400,
                    detail=f"Operator '{operator}' is not valid for field '{field}'.",
                )
            column = enum_fields[field]
            value = str(demographic_filter.value).strip().lower()
            conditions.append(func.lower(column) == value)
            continue

        if field in free_text_fields:
            if operator not in {"eq", "contains"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operator '{operator}' is not valid for field '{field}'.",
                )
            column = free_text_fields[field]
            value = str(demographic_filter.value).strip().lower()
            if operator == "eq":
                conditions.append(func.lower(column) == value)
            else:
                conditions.append(func.lower(column).contains(value))
            continue

        if field in numeric_fields:
            numeric_value = _coerce_numeric_filter_value(demographic_filter.value, field)
            column = ParticipantProfile.dependents
            if operator == "eq":
                conditions.append(column == numeric_value)
            elif operator == "gt":
                conditions.append(column > numeric_value)
            elif operator == "gte":
                conditions.append(column >= numeric_value)
            elif operator == "lt":
                conditions.append(column < numeric_value)
            elif operator == "lte":
                conditions.append(column <= numeric_value)
            elif operator == "between":
                numeric_value_max = _coerce_numeric_filter_value(demographic_filter.value_max, field)
                conditions.append(column.between(numeric_value, numeric_value_max))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operator '{operator}' is not valid for field '{field}'.",
                )
            continue

        if field == "status":
            if operator != "eq":
                raise HTTPException(
                    status_code=400,
                    detail=f"Operator '{operator}' is not valid for field '{field}'.",
                )
            normalized = str(demographic_filter.value).strip().lower()
            if normalized == "active":
                conditions.append(User.status.is_(True))
            elif normalized == "inactive":
                conditions.append(User.status.is_(False))
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Status must be 'active' or 'inactive'.",
                )
            continue

        if field == "age":
            numeric_value = _coerce_numeric_filter_value(demographic_filter.value, field)
            max_dob = _utc_today() - timedelta(days=numeric_value * 365.25)
            if operator == "eq":
                min_dob = _utc_today() - timedelta(days=(numeric_value + 1) * 365.25)
                conditions.append(and_(ParticipantProfile.dob <= max_dob, ParticipantProfile.dob >= min_dob))
            elif operator == "gt":
                conditions.append(ParticipantProfile.dob < max_dob)
            elif operator == "gte":
                conditions.append(ParticipantProfile.dob <= max_dob)
            elif operator == "lt":
                min_dob = _utc_today() - timedelta(days=(numeric_value + 1) * 365.25)
                conditions.append(ParticipantProfile.dob > min_dob)
            elif operator == "lte":
                min_dob = _utc_today() - timedelta(days=(numeric_value + 1) * 365.25)
                conditions.append(ParticipantProfile.dob >= min_dob)
            elif operator == "between":
                numeric_value_max = _coerce_numeric_filter_value(demographic_filter.value_max, field)
                lower_age = min(numeric_value, numeric_value_max)
                upper_age = max(numeric_value, numeric_value_max)
                max_age_dob = _utc_today() - timedelta(days=lower_age * 365.25)
                min_age_dob = _utc_today() - timedelta(days=(upper_age + 1) * 365.25)
                conditions.append(and_(ParticipantProfile.dob <= max_age_dob, ParticipantProfile.dob >= min_age_dob))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operator '{operator}' is not valid for field '{field}'.",
                )
            continue

    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt


def _coerce_display_value(row) -> Optional[str]:
    value = row.value_text or row.value_number or row.value_date or row.value_json
    if isinstance(value, list):
        return ", ".join(map(str, value))
    if value is not None:
        return str(value)
    return None


def _format_age_bucket(dob) -> str:
    age = calculate_age(dob)
    if age is None:
        return "Unknown"
    lower = max((age // 10) * 10, 0)
    upper = lower + 9
    return f"{lower}\u2013{upper}"


def _group_by_label(group_by: Optional[dict]) -> str:
    labels = {
        "gender": "Gender",
        "pronouns": "Pronouns",
        "primary_language": "Primary Language",
        "occupation_status": "Occupation",
        "living_arrangement": "Living Arrangement",
        "highest_education_level": "Education",
        "marital_status": "Marital Status",
        "age_bucket": "Age Range",
    }
    if not group_by:
        return "Group"
    if group_by.get("type") == "demographic":
        return labels.get(group_by.get("field") or "", "Group")
    return "Data Element"


CATEGORICAL_GROUP_COLUMNS = {
    "gender": ParticipantProfile.gender,
    "pronouns": ParticipantProfile.pronouns,
    "primary_language": ParticipantProfile.primary_language,
    "occupation_status": ParticipantProfile.occupation_status,
    "living_arrangement": ParticipantProfile.living_arrangement,
    "highest_education_level": ParticipantProfile.highest_education_level,
    "marital_status": ParticipantProfile.marital_status,
}


def _parse_group_by_element_id(group_by: Optional[dict]) -> Optional[UUID]:
    if not group_by or group_by.get("type") != "element":
        return None
    raw_value = group_by.get("element_id")
    if isinstance(raw_value, UUID):
        return raw_value
    try:
        return UUID(str(raw_value))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid element group_by value.") from exc


def _is_categorical_element_datatype(datatype: Optional[str]) -> bool:
    normalized = str(datatype or "").strip().lower()
    return normalized in {"text", "string", "boolean", "bool", "choice", "select", "option", "categorical"}


def _is_numeric_element_datatype(datatype: Optional[str]) -> bool:
    normalized = str(datatype or "number").strip().lower()
    return normalized in {"number", "int", "integer", "float", "double", "decimal", "numeric"}


def _resolve_group_value(group_by: dict, row) -> str:
    if group_by and group_by.get("type") == "demographic" and group_by.get("field") == "age_bucket":
        return _format_age_bucket(getattr(row, "group_dob", None))
    value = getattr(row, "group_value", None)
    if value is None or value == "":
        return "Unknown"
    return str(value)


def _normalized_categorical_value_expr(column):
    return func.lower(func.trim(cast(column, String)))


def _normalize_categorical_value(value) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    return normalized or None


def _display_categorical_value(value) -> str:
    normalized = _normalize_categorical_value(value)
    if not normalized:
        return "Unknown"
    return normalized.title()


def _element_filter_condition(health_data_point, element_filter):
    operator = element_filter.operator
    if operator == "eq":
        return health_data_point.value_number == element_filter.value
    if operator == "gt":
        return health_data_point.value_number > element_filter.value
    if operator == "gte":
        return health_data_point.value_number >= element_filter.value
    if operator == "lt":
        return health_data_point.value_number < element_filter.value
    if operator == "lte":
        return health_data_point.value_number <= element_filter.value
    if operator == "between":
        return health_data_point.value_number.between(
            element_filter.value,
            element_filter.value_max,
        )
    if operator == "has_value":
        return or_(
            health_data_point.value_number.is_not(None),
            health_data_point.value_text.is_not(None),
            health_data_point.value_json.is_not(None),
        )
    if operator == "is_empty":
        return and_(
            health_data_point.value_number.is_(None),
            health_data_point.value_text.is_(None),
            health_data_point.value_json.is_(None),
        )
    raise HTTPException(status_code=400, detail=f"Unsupported operator '{operator}'")


def _normalized_element_filter_source_types(element_filter) -> list[str]:
    normalized = []
    for source_type in getattr(element_filter, "source_types", None) or ["survey", "goal"]:
        lowered = str(source_type).lower()
        if lowered not in normalized:
            normalized.append(lowered)
    return normalized or ["survey", "goal"]


async def _resolve_required_element_ids_for_allow_null(
    db: AsyncSession,
    filters: Optional[ParticipantFilter],
    survey_id: Optional[str],
    explicit_element_ids: list,
    element_scope,
) -> list:
    if getattr(filters, "allow_null", True):
        return []

    required_ids = []
    for element_id in explicit_element_ids:
        if element_id and element_id not in required_ids:
            required_ids.append(element_id)

    if required_ids or survey_id:
        return required_ids

    element_scope_result = await db.execute(element_scope)
    return [
        element_id
        for element_id in element_scope_result.scalars().all()
        if element_id is not None
    ]


async def _filter_participant_ids_by_required_elements(
    db: AsyncSession,
    participant_ids: list,
    required_element_ids: list,
    source_types: list[str],
    observed_at_from: Optional[datetime] = None,
    observed_at_to: Optional[datetime] = None,
    survey_submission_ids=None,
) -> list:
    if not participant_ids or not required_element_ids:
        return participant_ids

    stmt = (
        select(
            HealthDataPoint.participant_id,
            func.count(func.distinct(HealthDataPoint.element_id)).label("present_count"),
        )
        .where(HealthDataPoint.participant_id.in_(participant_ids))
        .where(HealthDataPoint.element_id.in_(required_element_ids))
        .where(HealthDataPoint.source_type.in_(source_types))
    )

    if observed_at_from is not None:
        stmt = stmt.where(HealthDataPoint.observed_at >= observed_at_from)
    if observed_at_to is not None:
        stmt = stmt.where(HealthDataPoint.observed_at < observed_at_to)
    if survey_submission_ids is not None:
        stmt = stmt.where(
            or_(
                HealthDataPoint.source_type != "survey",
                HealthDataPoint.source_submission_id.in_(survey_submission_ids),
            )
        )

    stmt = (
        stmt.group_by(HealthDataPoint.participant_id)
        .having(func.count(func.distinct(HealthDataPoint.element_id)) == len(required_element_ids))
    )

    result = await db.execute(stmt)
    present_ids = set(result.scalars().all())
    return [participant_id for participant_id in participant_ids if participant_id in present_ids]


async def get_mapped_element_ids(survey_id, db: AsyncSession) -> list:
    family_form_ids = await _get_survey_family_form_ids(db, survey_id)
    if not family_form_ids:
        family_form_ids = [survey_id]

    result = await db.execute(
        select(FieldElementMap.element_id)
        .join(FormField, FormField.field_id == FieldElementMap.field_id)
        .where(FormField.form_id.in_(family_form_ids))
    )
    return list(result.scalars().all())


async def resolve_participant_ids(
    filters: ParticipantFilter,
    db: AsyncSession,
) -> list:
    participant_role_filter = (
        select(UserRole.user_id)
        .join(Role, UserRole.role_id == Role.role_id)
        .where(Role.role_name == "participant")
        .scalar_subquery()
    )

    stmt = (
        select(ParticipantProfile.participant_id)
        .select_from(User)
        .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
        .where(User.user_id.in_(participant_role_filter))
    )

    # group_ids is a narrowing filter only — not an access control mechanism.
    # Researchers have platform-wide access to all participants.
    # Empty list = all participants on platform.
    if filters.group_ids:
        stmt = (
            stmt.join(
                GroupMember,
                GroupMember.participant_id == ParticipantProfile.participant_id,
            )
            .where(GroupMember.group_id.in_(filters.group_ids))
        )

    stmt = _apply_demographic_filters(stmt, filters)

    if getattr(filters, "search", None):
        search_value = str(filters.search).strip().lower()
        if search_value:
            stmt = stmt.where(
                func.lower(cast(ParticipantProfile.participant_id, String)).contains(search_value)
            )

    result = await db.execute(stmt)
    base_participant_ids = list(result.scalars().all())

    if not filters.element_filters:
        return base_participant_ids

    base_id_set = set(base_participant_ids)
    if not base_id_set:
        return []

    for element_filter in filters.element_filters:
        element = await db.get(DataElement, element_filter.element_id)
        if element is None:
            raise HTTPException(
                status_code=400,
                detail=f"Element '{element_filter.element_id}' was not found.",
            )

        if element_filter.operator not in {"has_value", "is_empty"} and not _is_numeric_element_datatype(element.datatype):
            raise HTTPException(
                status_code=400,
                detail=f"Element '{element.label}' is not numeric and cannot be used in element_filters.",
            )

        source_types = _normalized_element_filter_source_types(element_filter)

        matched_stmt = (
            select(HealthDataPoint.participant_id)
            .where(HealthDataPoint.element_id == element_filter.element_id)
            .where(HealthDataPoint.source_type.in_(source_types or ["survey", "goal"]))
            .where(_element_filter_condition(HealthDataPoint, element_filter))
            .where(HealthDataPoint.participant_id.in_(base_id_set))
        )
        matched_result = await db.execute(matched_stmt)
        matched_ids = set(matched_result.scalars().all())

        if getattr(filters, "allow_null", True):
            present_stmt = (
                select(HealthDataPoint.participant_id)
                .where(HealthDataPoint.element_id == element_filter.element_id)
                .where(HealthDataPoint.participant_id.in_(base_id_set))
            )
            present_result = await db.execute(present_stmt)
            present_ids = set(present_result.scalars().all())
            matched_ids = matched_ids.union(base_id_set - present_ids)

        base_id_set &= matched_ids

    return [participant_id for participant_id in base_participant_ids if participant_id in base_id_set]


async def get_available_surveys(db: AsyncSession, current_user_id: UUID):
    """Fetch surveys available to researchers for dashboard filtering."""
    submitted_result = await db.execute(
        select(SurveyForm)
        .where(SurveyForm.status.in_(["PUBLISHED", "ARCHIVED", "DELETED"]))
        .where(SurveyForm.title != "Intake Form")
        .order_by(
            SurveyForm.title.asc(),
            SurveyForm.version.asc(),
            SurveyForm.created_at.desc(),
        )
    )
    forms = submitted_result.scalars().all()

    if not forms:
        return []

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

    return forms



async def get_survey_results_pivoted(
    db: AsyncSession,
    survey_id: str = None,
    filters: ParticipantFilter = None,
    current_user_id: UUID | None = None,
):
    """
    Returns participant demographics + health data points, pivoted by DataElement.

    Each column beyond the demographics represents one DataElement (e.g. "Blood Pressure (mmHg)").
    When survey_id is provided, only health data points that originated from
    submissions of that survey are included.
    """
    await _ensure_survey_access(db, survey_id, current_user_id)

    demographic_columns = [
        ParticipantProfile.participant_id.label("participant_id"),
        ParticipantProfile.gender,
        ParticipantProfile.pronouns,
        ParticipantProfile.primary_language,
        ParticipantProfile.occupation_status,
        ParticipantProfile.living_arrangement,
        ParticipantProfile.highest_education_level,
        ParticipantProfile.dependents,
        ParticipantProfile.marital_status,
        ParticipantProfile.dob,
    ]

    participant_role_filter = (
        select(UserRole.user_id)
        .join(Role, UserRole.role_id == Role.role_id)
        .where(Role.role_name == "participant")
        .scalar_subquery()
    )

    mode = getattr(filters, "mode", "aggregate") if filters else "aggregate"
    source_types = _normalized_source_types(filters)
    raw_source_types = getattr(filters, "source_types", None) if filters else None
    observed_at_from, observed_at_to = _observed_at_bounds(filters)
    limit = getattr(filters, "limit", None) if filters else None
    offset = max(getattr(filters, "offset", 0) or 0, 0) if filters else 0
    sort_by = getattr(filters, "sort_by", None) if filters else None
    sort_dir = _sort_direction(filters)
    base_filters = filters or ParticipantFilter()
    participant_ids = await resolve_participant_ids(base_filters, db)

    selected_elements = [
        selected_element
        for selected_element in getattr(base_filters, "selected_elements", []) or []
        if getattr(selected_element, "element_id", None) is not None
    ]
    selected_element_ids = [selected_element.element_id for selected_element in selected_elements]
    filtered_element_ids = [
        element_filter.element_id
        for element_filter in getattr(base_filters, "element_filters", [])
        if getattr(element_filter, "element_id", None)
    ]
    has_element_filters = bool(getattr(base_filters, "element_filters", []))
    has_selected_element_columns = bool(selected_element_ids)

    has_explicit_non_default_source_types = bool(survey_id) and bool(raw_source_types) and set(
        str(source_type).lower() for source_type in raw_source_types if source_type
    ) != {"survey"}

    if not survey_id and has_element_filters:
        element_filter_source_types = []
        for element_filter in getattr(base_filters, "element_filters", []):
            for source_type in element_filter.source_types or ["survey", "goal"]:
                lowered = str(source_type).lower()
                if lowered not in element_filter_source_types:
                    element_filter_source_types.append(lowered)
        if has_explicit_non_default_source_types:
            source_types = _normalized_source_types(base_filters)
        elif element_filter_source_types:
            source_types = element_filter_source_types
    elif not survey_id and has_selected_element_columns:
        if has_explicit_non_default_source_types:
            source_types = _normalized_source_types(base_filters)
        else:
            selected_element_source_types = []
            for selected_element in selected_elements:
                for source_type in selected_element.source_types or ["survey", "goal"]:
                    lowered = str(source_type).lower()
                    if lowered not in selected_element_source_types:
                        selected_element_source_types.append(lowered)
            source_types = selected_element_source_types or ["survey", "goal"]

    if (
        not survey_id
        and not has_element_filters
        and not has_selected_element_columns
        and not getattr(base_filters, "group_ids", None)
    ):
        if participant_ids and (observed_at_from is not None or observed_at_to is not None):
            dated_participant_stmt = (
                select(HealthDataPoint.participant_id)
                .distinct()
                .where(HealthDataPoint.participant_id.in_(participant_ids))
                .where(HealthDataPoint.source_type.in_(source_types))
            )
            if observed_at_from is not None:
                dated_participant_stmt = dated_participant_stmt.where(
                    HealthDataPoint.observed_at >= observed_at_from
                )
            if observed_at_to is not None:
                dated_participant_stmt = dated_participant_stmt.where(
                    HealthDataPoint.observed_at < observed_at_to
                )

            dated_participant_result = await db.execute(dated_participant_stmt)
            dated_participant_ids = set(dated_participant_result.scalars().all())
            participant_ids = [
                participant_id
                for participant_id in participant_ids
                if participant_id in dated_participant_ids
            ]

        sort_columns = {
            "participant": ParticipantProfile.participant_id,
            "gender": ParticipantProfile.gender,
            "pronouns": ParticipantProfile.pronouns,
            "primary_language": ParticipantProfile.primary_language,
            "occupation_status": ParticipantProfile.occupation_status,
            "living_arrangement": ParticipantProfile.living_arrangement,
            "highest_education_level": ParticipantProfile.highest_education_level,
            "dependents": ParticipantProfile.dependents,
            "marital_status": ParticipantProfile.marital_status,
            "age": func.date_part("year", func.age(func.current_date(), ParticipantProfile.dob)),
        }
        valid_sort_keys = set(sort_columns.keys())
        if sort_by and sort_by not in valid_sort_keys:
            raise HTTPException(status_code=400, detail=f"Unknown sort column: '{sort_by}'.")

        stmt = (
            select(*demographic_columns)
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .where(User.user_id.in_(participant_role_filter))
        )
        if participant_ids:
            stmt = stmt.where(ParticipantProfile.participant_id.in_(participant_ids))
        else:
            stmt = stmt.where(False)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_participants = int((await db.execute(count_stmt)).scalar() or 0)

        if sort_by:
            sort_expr = sort_columns[sort_by]
            stmt = stmt.order_by(
                sort_expr.is_(None).asc(),
                sort_expr.desc() if sort_dir == "desc" else sort_expr.asc(),
            )

        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)
        elif offset:
            stmt = stmt.offset(offset)

        result = await db.execute(stmt)
        data = result.all()
        intake_fallbacks = await _load_intake_profile_fallbacks(
            db,
            [row.participant_id for row in data],
        )

        columns_list = [
            {"id": "gender", "text": "Gender"},
            {"id": "pronouns", "text": "Pronouns"},
            {"id": "primary_language", "text": "Primary Language"},
            {"id": "occupation_status", "text": "Occupation / Status"},
            {"id": "living_arrangement", "text": "Living Arrangement"},
            {"id": "highest_education_level", "text": "Highest Education Level"},
            {"id": "dependents", "text": "Dependents"},
            {"id": "marital_status", "text": "Marital Status"},
            {"id": "age", "text": "Age"},
        ]
        paged_rows = [
            {
                "_participant_id": str(row.participant_id),
                "gender": row.gender or intake_fallbacks.get(str(row.participant_id), {}).get("gender"),
                "pronouns": row.pronouns or intake_fallbacks.get(str(row.participant_id), {}).get("pronouns"),
                "primary_language": row.primary_language or intake_fallbacks.get(str(row.participant_id), {}).get("primary_language"),
                "occupation_status": row.occupation_status or intake_fallbacks.get(str(row.participant_id), {}).get("occupation_status"),
                "living_arrangement": row.living_arrangement or intake_fallbacks.get(str(row.participant_id), {}).get("living_arrangement"),
                "highest_education_level": row.highest_education_level or intake_fallbacks.get(str(row.participant_id), {}).get("highest_education_level"),
                "dependents": row.dependents if row.dependents is not None else intake_fallbacks.get(str(row.participant_id), {}).get("dependents"),
                "marital_status": row.marital_status or intake_fallbacks.get(str(row.participant_id), {}).get("marital_status"),
                "age": calculate_age(row.dob or intake_fallbacks.get(str(row.participant_id), {}).get("dob")),
            }
            for row in data
        ]

        return {
            "columns": columns_list,
            "data": paged_rows,
            "pagination": {
                "offset": offset,
                "limit": limit,
                "returned_participants": len(paged_rows),
                "total_participants": total_participants,
                "has_more": (offset + len(paged_rows)) < total_participants,
                "next_offset": offset + len(paged_rows),
            },
        }

    if survey_id:
        survey_family_form_ids = await _get_survey_family_form_ids(db, survey_id)
        element_scope = (
            select(FieldElementMap.element_id)
            .join(FormField, FormField.field_id == FieldElementMap.field_id)
            .where(FormField.form_id.in_(survey_family_form_ids or [survey_id]))
        )
    else:
        scoped_element_ids = []
        for element_id in [*selected_element_ids, *filtered_element_ids]:
            if element_id not in scoped_element_ids:
                scoped_element_ids.append(element_id)

        if scoped_element_ids:
            element_scope = select(DataElement.element_id).where(
                DataElement.element_id.in_(scoped_element_ids)
            )
        else:
            element_scope = (
                select(HealthDataPoint.element_id)
                .distinct()
                .where(HealthDataPoint.source_type.in_(source_types))
            )
            if participant_ids is not None:
                element_scope = element_scope.where(HealthDataPoint.participant_id.in_(participant_ids))
            if observed_at_from is not None:
                element_scope = element_scope.where(HealthDataPoint.observed_at >= observed_at_from)
            if observed_at_to is not None:
                element_scope = element_scope.where(HealthDataPoint.observed_at < observed_at_to)

    survey_submission_ids = None
    if survey_id and "survey" in source_types:
        survey_family_form_ids = await _get_survey_family_form_ids(db, survey_id)
        survey_submission_ids = (
            select(FormSubmission.submission_id)
            .where(
                FormSubmission.form_id.in_(survey_family_form_ids or [survey_id]),
                FormSubmission.submitted_at.is_not(None),
            )
        )

    required_element_ids = await _resolve_required_element_ids_for_allow_null(
        db,
        base_filters,
        survey_id,
        [*selected_element_ids, *filtered_element_ids],
        element_scope,
    )
    participant_ids = await _filter_participant_ids_by_required_elements(
        db,
        participant_ids,
        required_element_ids,
        source_types,
        observed_at_from,
        observed_at_to,
        survey_submission_ids,
    )

    health_rows = (
        select(
            HealthDataPoint.data_id,
            HealthDataPoint.participant_id,
            HealthDataPoint.element_id,
            HealthDataPoint.value_text,
            HealthDataPoint.value_number,
            HealthDataPoint.value_date,
            HealthDataPoint.value_json,
            HealthDataPoint.source_type,
            HealthDataPoint.source_submission_id,
            HealthDataPoint.observed_at,
        )
        .where(HealthDataPoint.element_id.in_(element_scope))
        .where(HealthDataPoint.source_type.in_(source_types))
    )
    if survey_submission_ids is not None:
        # Survey mode is anchored to submissions for the selected survey:
        # aggregate = all completed submissions summarized per participant ×
        # element, longitudinal = all completed submissions as separate rows.
        # Goal rows continue to flow through separately.
        health_rows = health_rows.where(
            or_(
                HealthDataPoint.source_type != "survey",
                HealthDataPoint.source_submission_id.in_(survey_submission_ids),
            )
        )
    if participant_ids is not None:
        health_rows = health_rows.where(HealthDataPoint.participant_id.in_(participant_ids))
    if observed_at_from is not None:
        health_rows = health_rows.where(HealthDataPoint.observed_at >= observed_at_from)
    if observed_at_to is not None:
        health_rows = health_rows.where(HealthDataPoint.observed_at < observed_at_to)
    for element_filter in getattr(base_filters, "element_filters", []) or []:
        if not getattr(base_filters, "allow_null", True):
            health_rows = health_rows.where(
                or_(
                    HealthDataPoint.element_id != element_filter.element_id,
                    _element_filter_condition(HealthDataPoint, element_filter),
                )
            )

    if survey_id:
        health_rows_scope = health_rows.subquery()
        scoped_participant_result = await db.execute(
            select(health_rows_scope.c.participant_id).distinct()
        )
        scoped_participant_values = (
            scoped_participant_result.scalars().all()
            if hasattr(scoped_participant_result, "scalars")
            else [row[0] if isinstance(row, tuple) else getattr(row, "participant_id", row) for row in scoped_participant_result.all()]
        )
        scoped_participant_ids = {
            participant_id
            for participant_id in scoped_participant_values
            if participant_id is not None
        }
        participant_ids = [
            participant_id for participant_id in (participant_ids or []) if participant_id in scoped_participant_ids
        ]

    if mode == "aggregate":
        base_health_rows = health_rows.subquery()
        health_rows = (
            select(
                base_health_rows.c.participant_id,
                base_health_rows.c.element_id,
                func.avg(base_health_rows.c.value_number).label("value_mean"),
                func.min(base_health_rows.c.value_number).label("value_min"),
                func.max(base_health_rows.c.value_number).label("value_max"),
                func.count().label("obs_count"),
            )
            .group_by(
                base_health_rows.c.participant_id,
                base_health_rows.c.element_id,
            )
            .subquery()
        )
    else:
        health_rows = health_rows.subquery()

    participant_ids = list(participant_ids or [])
    ordered_participant_ids = sorted(participant_ids, key=lambda participant_id: str(participant_id))
    total_participants = len(ordered_participant_ids)
    paged_participant_ids = ordered_participant_ids[offset:]
    if limit is not None:
        paged_participant_ids = paged_participant_ids[:limit]

    if not paged_participant_ids:
        return {
            "columns": [],
            "data": [],
            "pagination": {
                "offset": offset,
                "limit": limit,
                "returned_participants": 0,
                "total_participants": total_participants,
                "has_more": False,
                "next_offset": offset,
            },
        }

    stmt = (
        select(
            *demographic_columns,
            DataElement.element_id.label("element_id"),
            DataElement.label.label("element_label"),
            DataElement.unit,
            *(
                [
                    health_rows.c.value_mean,
                    health_rows.c.value_min,
                    health_rows.c.value_max,
                    health_rows.c.obs_count,
                ]
                if mode == "aggregate"
                else [
                    health_rows.c.data_id,
                    health_rows.c.value_text,
                    health_rows.c.value_number,
                    health_rows.c.value_date,
                    health_rows.c.value_json,
                    health_rows.c.source_type,
                    health_rows.c.source_submission_id,
                    health_rows.c.observed_at,
                ]
            ),
        )
        .select_from(User)
        .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
        .outerjoin(health_rows, health_rows.c.participant_id == ParticipantProfile.participant_id)
        .outerjoin(DataElement, health_rows.c.element_id == DataElement.element_id)
        .where(User.user_id.in_(participant_role_filter))
    )
    stmt = stmt.where(ParticipantProfile.participant_id.in_(paged_participant_ids))

    result = await db.execute(stmt)
    data = result.all()
    intake_fallbacks = await _load_intake_profile_fallbacks(db, paged_participant_ids)

    element_meta_result = await db.execute(
        select(
            DataElement.element_id,
            DataElement.label,
            DataElement.unit,
        )
        .where(DataElement.element_id.in_(element_scope))
    )
    element_meta_rows = element_meta_result.all()

    if not data and not element_meta_rows:
        return {
            "columns": [],
            "data": [],
            "pagination": {
                "offset": offset,
                "limit": limit,
                "returned_participants": 0,
                "total_participants": total_participants,
                "has_more": False,
                "next_offset": offset,
            },
        }

    pivoted_data = {}
    elements_meta = {}  # element_id → display label

    for row in data:
        participant_id = str(row.participant_id)
        row_key = participant_id

        if mode == "longitudinal":
            if row.source_submission_id:
                row_key = f"{participant_id}:{row.source_submission_id}"
            else:
                row_key = f"{participant_id}:{row.data_id}"

        if row_key not in pivoted_data:
            fallback_values = intake_fallbacks.get(participant_id, {})
            base_row = {
                "_participant_id": participant_id,
                "gender": row.gender or fallback_values.get("gender"),
                "pronouns": row.pronouns or fallback_values.get("pronouns"),
                "primary_language": row.primary_language or fallback_values.get("primary_language"),
                "occupation_status": row.occupation_status or fallback_values.get("occupation_status"),
                "living_arrangement": row.living_arrangement or fallback_values.get("living_arrangement"),
                "highest_education_level": row.highest_education_level or fallback_values.get("highest_education_level"),
                "dependents": row.dependents if row.dependents is not None else fallback_values.get("dependents"),
                "marital_status": row.marital_status or fallback_values.get("marital_status"),
                "age": calculate_age(row.dob or fallback_values.get("dob")),
            }
            if mode == "longitudinal":
                base_row["observed_at"] = row.observed_at.isoformat() if row.observed_at else None
                base_row["source_type"] = row.source_type
                base_row["source_submission_id"] = (
                    str(row.source_submission_id) if row.source_submission_id else None
                )
            pivoted_data[row_key] = base_row

        if row.element_id is None:
            continue

        element_id = str(row.element_id)

        if mode == "aggregate":
            pivoted_data[row_key][f"{element_id}__mean"] = row.value_mean
            pivoted_data[row_key][f"{element_id}__min"] = row.value_min
            pivoted_data[row_key][f"{element_id}__max"] = row.value_max
            pivoted_data[row_key][f"{element_id}__n"] = row.obs_count

            if element_id not in elements_meta:
                unit_suffix = f" ({row.unit})" if row.unit else ""
                base_label = f"{row.element_label}{unit_suffix}"
                elements_meta[element_id] = {
                    f"{element_id}__mean": f"{base_label} - Mean",
                    f"{element_id}__min": f"{base_label} - Min",
                    f"{element_id}__max": f"{base_label} - Max",
                    f"{element_id}__n": f"{base_label} - Observations",
                }
        else:
            pivoted_data[row_key][element_id] = _coerce_display_value(row)

            if element_id not in elements_meta:
                unit_suffix = f" ({row.unit})" if row.unit else ""
                elements_meta[element_id] = f"{row.element_label}{unit_suffix}"

    columns_list = [
        {"id": "gender",                  "text": "Gender"},
        {"id": "pronouns",                "text": "Pronouns"},
        {"id": "primary_language",        "text": "Primary Language"},
        {"id": "occupation_status",       "text": "Occupation / Status"},
        {"id": "living_arrangement",      "text": "Living Arrangement"},
        {"id": "highest_education_level", "text": "Highest Education Level"},
        {"id": "dependents",              "text": "Dependents"},
        {"id": "marital_status",          "text": "Marital Status"},
        {"id": "age",                     "text": "Age"},
    ]
    if mode == "longitudinal":
        columns_list.extend(
            [
                {"id": "observed_at", "text": "Observed At"},
                {"id": "source_type", "text": "Source Type"},
                {"id": "source_submission_id", "text": "Submission ID"},
            ]
        )
    if mode == "aggregate":
        for element_row in element_meta_rows:
            element_id = str(element_row.element_id)
            if element_id in elements_meta:
                continue
            unit_suffix = f" ({element_row.unit})" if element_row.unit else ""
            base_label = f"{element_row.label}{unit_suffix}"
            elements_meta[element_id] = {
                f"{element_id}__mean": f"{base_label} - Mean",
                f"{element_id}__min": f"{base_label} - Min",
                f"{element_id}__max": f"{base_label} - Max",
                f"{element_id}__n": f"{base_label} - Observations",
            }
        for labels in elements_meta.values():
            columns_list.extend(
                [{"id": column_id, "text": label} for column_id, label in labels.items()]
            )
    else:
        for element_row in element_meta_rows:
            element_id = str(element_row.element_id)
            if element_id in elements_meta:
                continue
            unit_suffix = f" ({element_row.unit})" if element_row.unit else ""
            elements_meta[element_id] = f"{element_row.label}{unit_suffix}"
        columns_list.extend(
            [{"id": el_id, "text": label} for el_id, label in elements_meta.items()]
        )

    rows = list(pivoted_data.values())
    if rows and sort_by and sort_by not in {"participant", *rows[0].keys()}:
        raise HTTPException(status_code=400, detail=f"Unknown sort column: '{sort_by}'.")
    ordered_rows = _sort_rows(rows, sort_by, sort_dir)
    paged_rows = ordered_rows[offset:]
    if limit is not None:
        paged_rows = paged_rows[:limit]

    return {
        "columns": columns_list,
        "data": paged_rows,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "returned_participants": len(paged_rows),
            "total_participants": total_participants,
            "has_more": (offset + len(paged_rows)) < total_participants,
            "next_offset": offset + len(paged_rows),
        },
    }


async def get_survey_results_grouped(
    db: AsyncSession,
    survey_id: str = None,
    filters: ParticipantFilter = None,
    current_user_id: UUID | None = None,
):
    await _ensure_survey_access(db, survey_id, current_user_id)
    base_filters = filters or ParticipantFilter()
    group_by = _normalized_group_by(base_filters)
    if not group_by:
        raise HTTPException(status_code=400, detail="group_by is required for this endpoint.")
    group_by_element_id = _parse_group_by_element_id(group_by)
    sort_by = getattr(base_filters, "sort_by", None)
    sort_dir = _sort_direction(base_filters)
    limit = getattr(base_filters, "limit", None)
    offset = max(getattr(base_filters, "offset", 0) or 0, 0)

    participant_ids = await resolve_participant_ids(base_filters, db)
    source_types = _normalized_source_types(base_filters)
    raw_source_types = getattr(base_filters, "source_types", None)
    observed_at_from, observed_at_to = _observed_at_bounds(base_filters)

    selected_elements = [
        selected_element
        for selected_element in getattr(base_filters, "selected_elements", []) or []
        if getattr(selected_element, "element_id", None) is not None
    ]
    selected_element_ids = [selected_element.element_id for selected_element in selected_elements]
    filtered_element_ids = [
        element_filter.element_id
        for element_filter in getattr(base_filters, "element_filters", [])
        if getattr(element_filter, "element_id", None)
    ]

    has_explicit_non_default_source_types = bool(survey_id) and bool(raw_source_types) and set(
        str(source_type).lower() for source_type in raw_source_types if source_type
    ) != {"survey"}

    if not survey_id and filtered_element_ids:
        element_filter_source_types = []
        for element_filter in getattr(base_filters, "element_filters", []):
            for source_type in element_filter.source_types or ["survey", "goal"]:
                lowered = str(source_type).lower()
                if lowered not in element_filter_source_types:
                    element_filter_source_types.append(lowered)
        if has_explicit_non_default_source_types:
            source_types = _normalized_source_types(base_filters)
        elif element_filter_source_types:
            source_types = element_filter_source_types
    elif not survey_id and selected_element_ids:
        if has_explicit_non_default_source_types:
            source_types = _normalized_source_types(base_filters)
        else:
            selected_element_source_types = []
            for selected_element in selected_elements:
                for source_type in selected_element.source_types or ["survey", "goal"]:
                    lowered = str(source_type).lower()
                    if lowered not in selected_element_source_types:
                        selected_element_source_types.append(lowered)
            source_types = selected_element_source_types or ["survey", "goal"]

    if survey_id:
        element_scope = (
            select(FieldElementMap.element_id)
            .join(FormField, FormField.field_id == FieldElementMap.field_id)
            .where(FormField.form_id == survey_id)
        )
    else:
        scoped_element_ids = []
        for element_id in [*selected_element_ids, *filtered_element_ids]:
            if element_id not in scoped_element_ids:
                scoped_element_ids.append(element_id)

        if scoped_element_ids:
            element_scope = select(DataElement.element_id).where(DataElement.element_id.in_(scoped_element_ids))
        else:
            element_scope = (
                select(HealthDataPoint.element_id)
                .distinct()
                .where(HealthDataPoint.source_type.in_(source_types))
            )
            if participant_ids is not None:
                element_scope = element_scope.where(HealthDataPoint.participant_id.in_(participant_ids))
            if observed_at_from is not None:
                element_scope = element_scope.where(HealthDataPoint.observed_at >= observed_at_from)
            if observed_at_to is not None:
                element_scope = element_scope.where(HealthDataPoint.observed_at < observed_at_to)

    survey_submission_ids = None
    if survey_id and "survey" in source_types:
        survey_family_form_ids = await _get_survey_family_form_ids(db, survey_id)
        survey_submission_ids = (
            select(FormSubmission.submission_id)
            .where(
                FormSubmission.form_id.in_(survey_family_form_ids or [survey_id]),
                FormSubmission.submitted_at.is_not(None),
            )
        )

    required_element_ids = await _resolve_required_element_ids_for_allow_null(
        db,
        base_filters,
        survey_id,
        [*selected_element_ids, *filtered_element_ids],
        element_scope,
    )
    participant_ids = await _filter_participant_ids_by_required_elements(
        db,
        participant_ids,
        required_element_ids,
        source_types,
        observed_at_from,
        observed_at_to,
        survey_submission_ids,
    )

    group_column_map = CATEGORICAL_GROUP_COLUMNS

    group_selects = []
    group_by_exprs = [HealthDataPoint.element_id, DataElement.label, DataElement.unit]
    categorical_group_by_exprs = []
    group_label = _group_by_label(group_by)
    group_value_source = None

    if group_by_element_id:
        group_element = await db.get(DataElement, group_by_element_id)
        if group_element is None:
            raise HTTPException(status_code=400, detail="Selected group_by data element was not found.")
        if not _is_categorical_element_datatype(getattr(group_element, "datatype", None)):
            raise HTTPException(
                status_code=400,
                detail="Selected group_by data element must be categorical.",
            )
        group_label = group_element.label

        latest_group_value_source = (
            select(
                HealthDataPoint.participant_id.label("participant_id"),
                func.coalesce(
                    HealthDataPoint.value_text,
                    cast(HealthDataPoint.value_date, String),
                    cast(HealthDataPoint.value_json, String),
                ).label("group_value"),
                func.row_number()
                .over(
                    partition_by=HealthDataPoint.participant_id,
                    order_by=HealthDataPoint.observed_at.desc(),
                )
                .label("rn"),
            )
            .where(HealthDataPoint.element_id == group_by_element_id)
            .where(HealthDataPoint.source_type.in_(source_types))
        )
        if participant_ids is not None:
            latest_group_value_source = latest_group_value_source.where(
                HealthDataPoint.participant_id.in_(participant_ids)
            )
        if observed_at_from is not None:
            latest_group_value_source = latest_group_value_source.where(
                HealthDataPoint.observed_at >= observed_at_from
            )
        if observed_at_to is not None:
            latest_group_value_source = latest_group_value_source.where(
                HealthDataPoint.observed_at < observed_at_to
            )
        if survey_submission_ids is not None:
            latest_group_value_source = latest_group_value_source.where(
                or_(
                    HealthDataPoint.source_type != "survey",
                    HealthDataPoint.source_submission_id.in_(survey_submission_ids),
                )
            )
        latest_group_value_source = latest_group_value_source.subquery()
        group_value_source = (
            select(
                latest_group_value_source.c.participant_id,
                latest_group_value_source.c.group_value,
            )
            .where(latest_group_value_source.c.rn == 1)
            .subquery()
        )
        group_selects.append(group_value_source.c.group_value)
        group_by_exprs.append(group_value_source.c.group_value)
        categorical_group_by_exprs.append(group_value_source.c.group_value)
    elif group_by.get("type") == "demographic" and group_by.get("field") == "age_bucket":
        group_selects.append(ParticipantProfile.dob.label("group_dob"))
        group_by_exprs.append(ParticipantProfile.dob)
        categorical_group_by_exprs.append(ParticipantProfile.dob)
    elif group_by.get("type") == "demographic" and group_by.get("field") in group_column_map:
        group_column = group_column_map[group_by.get("field")]
        normalized_group_column = _normalized_categorical_value_expr(group_column)
        group_selects.append(normalized_group_column.label("group_value"))
        group_by_exprs.append(normalized_group_column)
        categorical_group_by_exprs.append(normalized_group_column)
    else:
        raise HTTPException(status_code=400, detail="Unsupported group_by value.")

    stmt = (
        select(
            *group_selects,
            HealthDataPoint.element_id.label("element_id"),
            DataElement.label.label("element_label"),
            DataElement.unit,
            func.avg(HealthDataPoint.value_number).label("value_mean"),
            func.min(HealthDataPoint.value_number).label("value_min"),
            func.max(HealthDataPoint.value_number).label("value_max"),
            func.count().label("obs_count"),
        )
        .select_from(User)
        .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
        .join(HealthDataPoint, HealthDataPoint.participant_id == ParticipantProfile.participant_id)
        .outerjoin(DataElement, HealthDataPoint.element_id == DataElement.element_id)
        .where(HealthDataPoint.element_id.in_(element_scope))
        .where(HealthDataPoint.source_type.in_(source_types))
    )
    if group_value_source is not None:
        stmt = stmt.join(
            group_value_source,
            group_value_source.c.participant_id == ParticipantProfile.participant_id,
        )
    stmt = stmt.group_by(*group_by_exprs)

    participant_role_filter = (
        select(UserRole.user_id)
        .join(Role, UserRole.role_id == Role.role_id)
        .where(Role.role_name == "participant")
        .scalar_subquery()
    )
    stmt = stmt.where(User.user_id.in_(participant_role_filter))

    if survey_submission_ids is not None:
        stmt = stmt.where(
            or_(
                HealthDataPoint.source_type != "survey",
                HealthDataPoint.source_submission_id.in_(survey_submission_ids),
            )
        )
    if participant_ids is not None:
        stmt = stmt.where(ParticipantProfile.participant_id.in_(participant_ids))
    if observed_at_from is not None:
        stmt = stmt.where(HealthDataPoint.observed_at >= observed_at_from)
    if observed_at_to is not None:
        stmt = stmt.where(HealthDataPoint.observed_at < observed_at_to)

    # Discover categorical values to expand as count columns in grouped mode.
    excluded_group_field = (
        group_by.get("field")
        if group_by.get("type") == "demographic"
        else None
    )
    discovered_categorical_values: dict[str, list[str]] = {}
    categorical_metadata_suffix: dict[str, str] = {}

    for field_name, field_column in CATEGORICAL_GROUP_COLUMNS.items():
        if field_name == excluded_group_field:
            continue
        normalized_field_column = _normalized_categorical_value_expr(field_column)

        discovery_stmt = (
            select(
                normalized_field_column.label("value"),
                func.count().label("value_count"),
            )
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .where(User.user_id.in_(participant_role_filter))
            .where(field_column.is_not(None))
        )
        if participant_ids is not None:
            discovery_stmt = discovery_stmt.where(
                ParticipantProfile.participant_id.in_(participant_ids)
            )
        discovery_stmt = (
            discovery_stmt.group_by(normalized_field_column)
            .order_by(func.count().desc(), normalized_field_column.asc())
        )

        discovery_result = await db.execute(discovery_stmt)
        discovery_rows = discovery_result.all()
        if not discovery_rows:
            continue

        visible_rows = discovery_rows[:20]
        hidden_count = max(0, len(discovery_rows) - len(visible_rows))
        discovered_categorical_values[field_name] = [
            str(row.value) for row in visible_rows if row.value is not None and str(row.value) != ""
        ]
        if hidden_count:
            categorical_metadata_suffix[field_name] = f" (+{hidden_count} more hidden)"

    categorical_count_selects = []
    for field_name, values in discovered_categorical_values.items():
        field_column = CATEGORICAL_GROUP_COLUMNS[field_name]
        normalized_field_column = _normalized_categorical_value_expr(field_column)
        for value in values:
            categorical_count_selects.append(
                func.count()
                .filter(normalized_field_column == value)
                .label(f"{field_name}__{value}")
            )

    categorical_counts_stmt = (
        select(*group_selects, *categorical_count_selects)
        .select_from(User)
        .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
        .where(User.user_id.in_(participant_role_filter))
    )
    if group_value_source is not None:
        categorical_counts_stmt = categorical_counts_stmt.join(
            group_value_source,
            group_value_source.c.participant_id == ParticipantProfile.participant_id,
        )
    categorical_counts_stmt = categorical_counts_stmt.group_by(*categorical_group_by_exprs)

    if participant_ids is not None:
        categorical_counts_stmt = categorical_counts_stmt.where(
            ParticipantProfile.participant_id.in_(participant_ids)
        )

    categorical_counts_result = await db.execute(categorical_counts_stmt)
    categorical_counts_rows = categorical_counts_result.all()

    result = await db.execute(stmt)
    data = result.all()

    if not data:
        return {
            "columns": [{"id": "group_value", "text": group_label}],
            "data": [],
            "pagination": {
                "offset": offset,
                "limit": limit,
                "returned_participants": 0,
                "total_participants": 0,
                "has_more": False,
                "next_offset": offset,
            },
        }

    grouped_data = {}
    elements_meta = {}
    categorical_meta = {}

    field_labels = {
        "gender": "Gender",
        "pronouns": "Pronouns",
        "primary_language": "Primary Language",
        "occupation_status": "Occupation",
        "living_arrangement": "Living Arrangement",
        "highest_education_level": "Highest Education Level",
        "marital_status": "Marital Status",
    }

    for row in categorical_counts_rows:
        group_value = _resolve_group_value(group_by, row)
        if group_by.get("type") == "demographic" and group_by.get("field") != "age_bucket":
            group_value = _display_categorical_value(group_value)
        if group_value not in grouped_data:
            grouped_data[group_value] = {
                "group_value": group_value,
            }

        for field_name, values in discovered_categorical_values.items():
            for index, value in enumerate(values):
                column_id = f"{field_name}__{value}"
                grouped_data[group_value][column_id] = int(getattr(row, column_id, 0) or 0)
                if column_id not in categorical_meta:
                    suffix = categorical_metadata_suffix.get(field_name, "") if index == 0 else ""
                    categorical_meta[column_id] = f"{field_labels[field_name]}: {_display_categorical_value(value)}{suffix}"

    for row in data:
        group_value = _resolve_group_value(group_by, row)
        if group_by.get("type") == "demographic" and group_by.get("field") != "age_bucket":
            group_value = _display_categorical_value(group_value)
        if group_value not in grouped_data:
            grouped_data[group_value] = {
                "group_value": group_value,
            }

        element_id = str(row.element_id)
        grouped_data[group_value][f"{element_id}__mean"] = row.value_mean
        grouped_data[group_value][f"{element_id}__min"] = row.value_min
        grouped_data[group_value][f"{element_id}__max"] = row.value_max
        grouped_data[group_value][f"{element_id}__n"] = row.obs_count

        if element_id not in elements_meta:
            unit_suffix = f" ({row.unit})" if row.unit else ""
            base_label = f"{row.element_label or 'Deleted element'}{unit_suffix}"
            elements_meta[element_id] = {
                f"{element_id}__mean": f"{base_label} - Mean",
                f"{element_id}__min": f"{base_label} - Min",
                f"{element_id}__max": f"{base_label} - Max",
                f"{element_id}__n": f"{base_label} - Observations",
            }

    columns_list = [{"id": "group_value", "text": group_label}]
    columns_list.extend(
        [{"id": column_id, "text": label} for column_id, label in categorical_meta.items()]
    )
    for labels in elements_meta.values():
        columns_list.extend(
            [{"id": column_id, "text": label} for column_id, label in labels.items()]
        )

    rows = list(grouped_data.values())
    if rows and sort_by and sort_by not in {"group_value", *rows[0].keys()}:
        raise HTTPException(status_code=400, detail=f"Unknown sort column: '{sort_by}'.")
    ordered_rows = _sort_rows(rows, sort_by or "group_value", sort_dir)
    paged_rows = ordered_rows[offset:]
    if limit is not None:
        paged_rows = paged_rows[:limit]
    return {
        "columns": columns_list,
        "data": paged_rows,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "returned_participants": len(paged_rows),
            "total_participants": len(ordered_rows),
            "has_more": (offset + len(paged_rows)) < len(ordered_rows),
            "next_offset": offset + len(paged_rows),
        },
    }


async def export_survey_results_csv(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
    current_user_id: UUID | None = None,
) -> StreamingResponse:
    """Build and return a UTF-8 CSV StreamingResponse of survey results."""
    results = await get_survey_results_pivoted(db, survey_id, filters, current_user_id)

    if not results["data"]:
        return StreamingResponse(
            io.BytesIO(b"\xef\xbb\xbf"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=survey_results.csv"},
        )

    visible_columns, export_rows = _get_export_columns_and_rows(results, exclude_columns)

    output = io.StringIO(newline="")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow([col["text"] for col in visible_columns])
    for record in export_rows:
        writer.writerow([_export_cell_value(record.get(col["id"])) for col in visible_columns])

    csv_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=survey_results.csv"},
    )


def _get_visible_export_columns(results: dict, exclude_columns: Optional[Set[str]] = None) -> list[dict]:
    excluded = set(exclude_columns or set())
    excluded.update(
        {
            "participant_id",
            "user_id",
            "email",
            "phone",
            "username",
            "address",
            "source_submission_id",
        }
    )
    return [
        col
        for col in results["columns"]
        if col["id"] not in excluded or str(col["id"]).endswith("__n")
    ]


def _export_cell_value(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    return value


def _get_export_columns_and_rows(results: dict, exclude_columns: Optional[Set[str]] = None) -> tuple[list[dict], list[dict]]:
    visible_columns = _get_visible_export_columns(results, exclude_columns)
    rows = results["data"]

    if rows and "group_value" not in {col["id"] for col in visible_columns}:
        visible_columns = [{"id": "_participant_marker", "text": "Participant"}, *visible_columns]
        participant_numbers = {}
        next_number = 1
        export_rows = []
        for record in rows:
            participant_id = record.get("_participant_id")
            if participant_id:
                if participant_id not in participant_numbers:
                    participant_numbers[participant_id] = next_number
                    next_number += 1
                marker = f"Participant {participant_numbers[participant_id]}"
            else:
                marker = "Participant"
            export_rows.append(
                {
                    **record,
                    "_participant_marker": marker,
                }
            )
        rows = export_rows

    return visible_columns, rows


async def export_survey_results_excel(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
    current_user_id: UUID | None = None,
) -> StreamingResponse:
    """Build and return an XLSX StreamingResponse of survey results."""
    try:
        from openpyxl import Workbook
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Excel export is unavailable because openpyxl is not installed.",
        ) from exc

    results = await get_survey_results_pivoted(db, survey_id, filters, current_user_id)
    visible_columns, export_rows = _get_export_columns_and_rows(results, exclude_columns)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Survey Results"

    sheet.append([col["text"] for col in visible_columns])
    for record in export_rows:
        sheet.append([_export_cell_value(record.get(col["id"])) for col in visible_columns])

    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="survey_results.xlsx"'},
    )


async def export_grouped_results_csv(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
    current_user_id: UUID | None = None,
) -> StreamingResponse:
    results = await get_survey_results_grouped(db, survey_id, filters, current_user_id)

    if not results["data"]:
        return StreamingResponse(
            io.BytesIO(b"\xef\xbb\xbf"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=grouped_results.csv"},
        )

    visible_columns, export_rows = _get_export_columns_and_rows(results, exclude_columns)

    output = io.StringIO(newline="")
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow([col["text"] for col in visible_columns])
    for record in export_rows:
        writer.writerow([_export_cell_value(record.get(col["id"])) for col in visible_columns])

    csv_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=grouped_results.csv"},
    )


async def export_grouped_results_excel(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
    current_user_id: UUID | None = None,
) -> StreamingResponse:
    try:
        from openpyxl import Workbook
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Excel export is unavailable because openpyxl is not installed.",
        ) from exc

    results = await get_survey_results_grouped(db, survey_id, filters, current_user_id)
    visible_columns, export_rows = _get_export_columns_and_rows(results, exclude_columns)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Grouped Results"
    sheet.append([col["text"] for col in visible_columns])
    for record in export_rows:
        sheet.append([_export_cell_value(record.get(col["id"])) for col in visible_columns])

    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="grouped_results.xlsx"'},
    )
