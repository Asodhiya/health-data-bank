"""
Seed standard data elements for intake profile fields and auto-link existing
intake form fields to their corresponding data elements via FieldElementMap.
Runs at startup — skips any element whose code already exists.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import DataElement, SurveyForm, FormField, FieldElementMap

INTAKE_FORM_TITLE = "Intake Form"

PROFILE_DATA_ELEMENTS = [
    {"code": "dob",                     "label": "Date of Birth",           "datatype": "date",   "description": "Participant date of birth"},
    {"code": "gender",                  "label": "Gender",                  "datatype": "text",   "description": "Self-reported gender identity"},
    {"code": "pronouns",                "label": "Pronouns",                "datatype": "text",   "description": "Preferred pronouns"},
    {"code": "primary_language",        "label": "Primary Languages",       "datatype": "text",   "description": "Primary spoken languages"},
    {"code": "country_of_origin",       "label": "Country of Origin",       "datatype": "text",   "description": "Country of origin"},
    {"code": "marital_status",          "label": "Marital Status",          "datatype": "text",   "description": "Current marital status"},
    {"code": "highest_education_level", "label": "Highest Education Level", "datatype": "text",   "description": "Highest level of education attained"},
    {"code": "living_arrangement",      "label": "Living Arrangement",      "datatype": "text",   "description": "Current living arrangement"},
    {"code": "dependents",              "label": "Dependents",              "datatype": "number", "description": "Number of dependents"},
    {"code": "occupation_status",       "label": "Occupation Status",       "datatype": "text",   "description": "Current occupation or employment status"},
]


async def seed_profile_data_elements(db: AsyncSession) -> None:
    # 1. Seed data elements (idempotent)
    existing_result = await db.execute(
        select(DataElement.code).where(
            DataElement.code.in_([el["code"] for el in PROFILE_DATA_ELEMENTS])
        )
    )
    existing_codes = set(existing_result.scalars().all())

    for el in PROFILE_DATA_ELEMENTS:
        if el["code"] not in existing_codes:
            db.add(DataElement(**el))

    await db.flush()

    # 2. Auto-link existing intake fields to their data elements
    form_result = await db.execute(
        select(SurveyForm).where(SurveyForm.title == INTAKE_FORM_TITLE)
    )
    form = form_result.scalar_one_or_none()
    if not form:
        await db.commit()
        return

    fields_result = await db.execute(
        select(FormField).where(
            FormField.form_id == form.form_id,
            FormField.profile_field.isnot(None),
        )
    )
    profile_fields = fields_result.scalars().all()
    if not profile_fields:
        await db.commit()
        return

    # Load element lookup and existing mappings
    element_result = await db.execute(
        select(DataElement).where(
            DataElement.code.in_([f.profile_field for f in profile_fields])
        )
    )
    code_to_element = {el.code: el for el in element_result.scalars().all()}

    existing_maps_result = await db.execute(
        select(FieldElementMap.field_id).where(
            FieldElementMap.field_id.in_([f.field_id for f in profile_fields])
        )
    )
    already_mapped = set(existing_maps_result.scalars().all())

    for field in profile_fields:
        element = code_to_element.get(field.profile_field)
        if element and field.field_id not in already_mapped:
            db.add(FieldElementMap(
                field_id=field.field_id,
                element_id=element.element_id,
            ))

    await db.commit()
