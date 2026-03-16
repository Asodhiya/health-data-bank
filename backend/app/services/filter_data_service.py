from sqlalchemy import select, and_, or_, func, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, FormSubmission, SubmissionAnswer, FormField, ParticipantProfile, SurveyForm
from app.schemas.filter_data_schema import ParticipantFilter
from datetime import date, timedelta
import json

def calculate_age(born):
    """"calculate age from DOB"""""
    if not born:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

async def get_available_surveys(db: AsyncSession):
    """Fetches all published survey forms for dropdown"""
    stmt = select(SurveyForm).where(SurveyForm.status == 'published')
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_survey_results_pivoted(db: AsyncSession, survey_id: str = None, filters: ParticipantFilter = None):
    """Fetches and pivots survey results"""
    
    demographic_columns = [
        User.user_id.label("participant_id"),
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

    if survey_id:
        stmt = (
            select(
                *demographic_columns,
                FormField.field_id.label("question_id"),
                FormField.label.label("question_text"),
                SubmissionAnswer.value_text,
                SubmissionAnswer.value_number,
                SubmissionAnswer.value_date,
                SubmissionAnswer.value_json
            )
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
            .join(FormSubmission, ParticipantProfile.participant_id == FormSubmission.participant_id)
            .join(SubmissionAnswer, FormSubmission.submission_id == SubmissionAnswer.submission_id)
            .join(FormField, SubmissionAnswer.field_id == FormField.field_id)
        )
    else:
        stmt = (
            select(*demographic_columns)
            .select_from(User)
            .join(ParticipantProfile, User.user_id == ParticipantProfile.user_id)
        )

    conditions = []
    if survey_id:
        conditions.append(FormSubmission.form_id == survey_id)
        
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
            pass
        if filters.age_min:
            max_dob = date.today() - timedelta(days=filters.age_min * 365.25)
            conditions.append(ParticipantProfile.dob <= max_dob)
        if filters.age_max:
            min_dob = date.today() - timedelta(days=(filters.age_max + 1) * 365.25)
            conditions.append(ParticipantProfile.dob >= min_dob)
        if filters.search:
            search_term = f"%{filters.search}%"
            conditions.append(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )

    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    data = result.all()
    
    if not data:
        return {"columns": [], "data": []}

    pivoted_data = {}
    questions_meta = {}

    for row in data:
        participant_id = str(row.participant_id)
        
        if participant_id not in pivoted_data:
            pivoted_data[participant_id] = {
                "participant_id": participant_id,
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
            question_id = str(row.question_id)
            
            answer_value = row.value_text or row.value_number or row.value_date or row.value_json
            if isinstance(answer_value, list):
                answer_value = ", ".join(map(str, answer_value))
            elif answer_value is not None:
                answer_value = str(answer_value)
            
            pivoted_data[participant_id][question_id] = answer_value

            if question_id not in questions_meta:
                questions_meta[question_id] = row.question_text

    columns_list = [
        {"id": "participant_id",          "text": "Participant ID"},
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
    columns_list.extend([{"id": q_id, "text": text} for q_id, text in questions_meta.items()])

    return {
        "columns": columns_list,
        "data": list(pivoted_data.values())
    }
