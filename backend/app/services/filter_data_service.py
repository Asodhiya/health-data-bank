from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    User, FormSubmission, ParticipantProfile, SurveyForm,
    HealthDataPoint, DataElement, UserRole, Role,
)
from app.schemas.filter_data_schema import ParticipantFilter
from datetime import date, timedelta


def calculate_age(born):
    if not born:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


async def get_available_surveys(db: AsyncSession):
    """Fetches all published survey forms for dropdown."""
    stmt = select(SurveyForm).where(SurveyForm.status == 'PUBLISHED')
    result = await db.execute(stmt)
    return result.scalars().all()


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
            .join(HealthDataPoint, ParticipantProfile.participant_id == HealthDataPoint.participant_id)
            .join(DataElement, HealthDataPoint.element_id == DataElement.element_id)
            .where(User.user_id.in_(participant_role_filter))
        )
    else:
        stmt = (
            select(*demographic_columns)
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .where(User.user_id.in_(participant_role_filter))
        )

    conditions = []

    if survey_id:
        # Only include health data points that came from this survey's submissions
        submission_ids = select(FormSubmission.submission_id).where(
            FormSubmission.form_id == survey_id
        )
        conditions.append(HealthDataPoint.source_submission_id.in_(submission_ids))

    if filters:
        if filters.gender:
            conditions.append(ParticipantProfile.gender == filters.gender)
        if filters.pronouns:
            conditions.append(ParticipantProfile.pronouns == filters.pronouns)
        if filters.primary_language:
            conditions.append(ParticipantProfile.primary_language == filters.primary_language)
        if filters.occupation_status:
            conditions.append(ParticipantProfile.occupation_status == filters.occupation_status)
        if filters.living_arrangement:
            conditions.append(ParticipantProfile.living_arrangement == filters.living_arrangement)
        if filters.highest_education_level:
            conditions.append(ParticipantProfile.highest_education_level == filters.highest_education_level)
        if filters.dependents is not None:
            conditions.append(ParticipantProfile.dependents == filters.dependents)
        if filters.marital_status:
            conditions.append(ParticipantProfile.marital_status == filters.marital_status)
        if filters.status:
            conditions.append(User.status == (filters.status.lower() == 'active'))
        if filters.group_id:
            pass  # TODO: join GroupMembership when group support is added
        if filters.age_min:
            max_dob = date.today() - timedelta(days=filters.age_min * 365.25)
            conditions.append(ParticipantProfile.dob <= max_dob)
        if filters.age_max:
            min_dob = date.today() - timedelta(days=(filters.age_max + 1) * 365.25)
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
