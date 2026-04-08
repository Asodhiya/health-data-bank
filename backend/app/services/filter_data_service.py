from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.db.models import (
    User, FormSubmission, ParticipantProfile, SurveyForm,
    HealthDataPoint, DataElement, UserRole, Role, FormDeployment, Group, GroupMember,
)
from app.schemas.filter_data_schema import ParticipantFilter
from datetime import date, datetime, timedelta, timezone
import csv
import io
from typing import Optional, Set
from starlette.responses import StreamingResponse


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def calculate_age(born):
    if not born:
        return None
    today = _utc_today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


async def get_available_surveys(db: AsyncSession):
    """Fetches forms (any status) that have at least one completed submission."""
    stmt = (
        select(SurveyForm)
        .where(SurveyForm.status.in_(['PUBLISHED', 'ARCHIVED', 'DELETED']))
        .where(
            select(func.count(FormSubmission.submission_id))
            .where(
                FormSubmission.form_id == SurveyForm.form_id,
                FormSubmission.submitted_at.is_not(None),
            )
            .correlate(SurveyForm)
            .scalar_subquery() > 0
        )
    )

    result = await db.execute(stmt)
    forms = result.scalars().all()

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

    return forms



async def get_survey_results_pivoted(db: AsyncSession, survey_id: str = None, filters: ParticipantFilter = None):
    """
    Returns participant demographics + health data points, pivoted by DataElement.

    Each column beyond the demographics represents one DataElement (e.g. "Blood Pressure (mmHg)").
    When survey_id is provided, only health data points that originated from
    submissions of that survey are included.
    """

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

    if survey_id:
        stmt = (
            select(
                *demographic_columns,
                DataElement.element_id.label("element_id"),
                DataElement.label.label("element_label"),
                DataElement.unit,
                HealthDataPoint.value_text,
                HealthDataPoint.value_number,
                HealthDataPoint.value_date,
                HealthDataPoint.value_json,
            )
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .join(
                FormSubmission,
                and_(
                    FormSubmission.participant_id == ParticipantProfile.participant_id,
                    FormSubmission.form_id == survey_id,
                    FormSubmission.submitted_at.is_not(None),
                )
            )
            .join(
                HealthDataPoint,
                and_(
                    HealthDataPoint.participant_id == ParticipantProfile.participant_id,
                    HealthDataPoint.source_submission_id == FormSubmission.submission_id,
                )
            )
            .join(DataElement, HealthDataPoint.element_id == DataElement.element_id)
            .where(User.user_id.in_(participant_role_filter))
        )
    else:
        has_submission = (
            select(FormSubmission.participant_id)
            .where(FormSubmission.submitted_at.is_not(None))
            .scalar_subquery()
        )
        stmt = (
            select(*demographic_columns)
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .where(User.user_id.in_(participant_role_filter))
            .where(ParticipantProfile.participant_id.in_(has_submission))
        )

    conditions = []

    if filters:
        if filters.gender:
            conditions.append(func.lower(ParticipantProfile.gender) == filters.gender.lower())
        if filters.pronouns:
            conditions.append(func.lower(ParticipantProfile.pronouns) == filters.pronouns.lower())
        if filters.primary_language:
            lang_conditions = [
                func.lower(ParticipantProfile.primary_language).contains(lang.lower())
                for lang in filters.primary_language
            ]
            conditions.append(or_(*lang_conditions))
        if filters.occupation_status:
            conditions.append(func.lower(ParticipantProfile.occupation_status) == filters.occupation_status.lower())
        if filters.living_arrangement:
            conditions.append(func.lower(ParticipantProfile.living_arrangement) == filters.living_arrangement.lower())
        if filters.highest_education_level:
            conditions.append(func.lower(ParticipantProfile.highest_education_level) == filters.highest_education_level.lower())
        if getattr(filters, "dependents_min", None) is not None:
            conditions.append(ParticipantProfile.dependents >= filters.dependents_min)
        if getattr(filters, "dependents_max", None) is not None:
            conditions.append(ParticipantProfile.dependents <= filters.dependents_max)
        if filters.marital_status:
            conditions.append(func.lower(ParticipantProfile.marital_status) == filters.marital_status.lower())
        if filters.status:
            conditions.append(User.status == (filters.status.lower() == 'active'))
        if filters.group_ids:
            conditions.append(
                ParticipantProfile.participant_id.in_(
                    select(GroupMember.participant_id).where(
                        GroupMember.group_id.in_(filters.group_ids)
                    )
                )
            )
        if filters.age_min:
            max_dob = _utc_today() - timedelta(days=filters.age_min * 365.25)
            conditions.append(ParticipantProfile.dob <= max_dob)
        if filters.age_max:
            min_dob = _utc_today() - timedelta(days=(filters.age_max + 1) * 365.25)
            conditions.append(ParticipantProfile.dob >= min_dob)
        # search by name/email intentionally excluded to preserve anonymity

    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    data = result.all()

    if not data:
        return {"columns": [], "data": []}

    pivoted_data = {}
    elements_meta = {}  # element_id → display label

    for row in data:
        participant_id = str(row.participant_id)

        if participant_id not in pivoted_data:
            pivoted_data[participant_id] = {
                "gender": row.gender,
                "pronouns": row.pronouns,
                "primary_language": row.primary_language,
                "occupation_status": row.occupation_status,
                "living_arrangement": row.living_arrangement,
                "highest_education_level": row.highest_education_level,
                "dependents": row.dependents,
                "marital_status": row.marital_status,
                "age": calculate_age(row.dob),
            }

        if survey_id:
            element_id = str(row.element_id)

            # Pick the first non-null value
            value = row.value_text or row.value_number or row.value_date or row.value_json
            if isinstance(value, list):
                value = ", ".join(map(str, value))
            elif value is not None:
                value = str(value)

            pivoted_data[participant_id][element_id] = value

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
    columns_list.extend(
        [{"id": el_id, "text": label} for el_id, label in elements_meta.items()]
    )

    return {
        "columns": columns_list,
        "data": list(pivoted_data.values()),
    }


async def export_survey_results_csv(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
) -> StreamingResponse:
    """Build and return a UTF-8 CSV StreamingResponse of survey results."""
    results = await get_survey_results_pivoted(db, survey_id, filters)

    if not results["data"]:
        return StreamingResponse(
            io.BytesIO(b"\xef\xbb\xbf"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=survey_results.csv"},
        )

    visible_columns = _get_visible_export_columns(results, exclude_columns)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([col["text"] for col in visible_columns])
    for record in results["data"]:
        writer.writerow([record.get(col["id"]) or "" for col in visible_columns])

    csv_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=survey_results.csv"},
    )


def _get_visible_export_columns(results: dict, exclude_columns: Optional[Set[str]] = None) -> list[dict]:
    excluded = set(exclude_columns or set())
    excluded.update({"participant_id", "user_id", "email", "phone", "username", "address"})
    return [col for col in results["columns"] if col["id"] not in excluded]


async def export_survey_results_excel(
    db: AsyncSession,
    survey_id: Optional[str] = None,
    filters: Optional[ParticipantFilter] = None,
    exclude_columns: Optional[Set[str]] = None,
) -> StreamingResponse:
    """Build and return an XLSX StreamingResponse of survey results."""
    try:
        from openpyxl import Workbook
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Excel export is unavailable because openpyxl is not installed.",
        ) from exc

    results = await get_survey_results_pivoted(db, survey_id, filters)
    visible_columns = _get_visible_export_columns(results, exclude_columns)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Survey Results"

    sheet.append([col["text"] for col in visible_columns])
    for record in results["data"]:
        sheet.append([record.get(col["id"]) or "" for col in visible_columns])

    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="survey_results.xlsx"'},
    )
