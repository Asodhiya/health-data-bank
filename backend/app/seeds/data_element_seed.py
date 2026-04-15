"""
Seed standard data elements for intake profile fields, create the Intake Form
with all its fields and options, and auto-link fields to data elements via
FieldElementMap.  Runs at startup — fully idempotent.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import DataElement, SurveyForm, FormField, FieldOption, FieldElementMap

INTAKE_FORM_TITLE = "Intake Form"

PROFILE_DATA_ELEMENTS = [
    {"code": "dob",                     "label": "Date of Birth",           "datatype": "date",    "description": "Participant date of birth"},
    {"code": "gender",                  "label": "Gender",                  "datatype": "text",    "description": "Self-reported gender identity"},
    {"code": "pronouns",                "label": "Pronouns",                "datatype": "text",    "description": "Preferred pronouns"},
    {"code": "primary_language",        "label": "Primary Languages",       "datatype": "text",    "description": "Primary spoken languages"},
    {"code": "country_of_origin",       "label": "Country of Origin",       "datatype": "text",    "description": "Country of origin"},
    {"code": "marital_status",          "label": "Marital Status",          "datatype": "text",    "description": "Current marital status"},
    {"code": "highest_education_level", "label": "Highest Education Level", "datatype": "text",    "description": "Highest level of education attained"},
    {"code": "living_arrangement",      "label": "Living Arrangement",      "datatype": "text",    "description": "Current living arrangement"},
    {"code": "dependents",              "label": "Dependents",              "datatype": "integer", "description": "Number of dependents"},
    {"code": "occupation_status",       "label": "Occupation Status",       "datatype": "text",    "description": "Current occupation or employment status"},
    {"code": "caretaker_notes",         "label": "Caretaker Notes",         "datatype": "text",    "description": "Participant-to-caretaker message field. Special handling routes responses to the assigned caretaker instead of health summaries."},
]

# Each entry: label, field_type, profile_field code, is_required, display_order, options list
# options is a list of label strings; value is assigned as 1-based index
INTAKE_FORM_FIELDS = [
    {
        "label": "Date of Birth",
        "field_type": "date",
        "profile_field": "dob",
        "is_required": True,
        "display_order": 1,
        "options": [],
    },
    {
        "label": "Gender",
        "field_type": "single_select",
        "profile_field": "gender",
        "is_required": False,
        "display_order": 2,
        "options": ["Male", "Female", "Non-binary", "Prefer not to say", "Other"],
    },
    {
        "label": "Pronouns",
        "field_type": "single_select",
        "profile_field": "pronouns",
        "is_required": False,
        "display_order": 3,
        "options": ["He/Him", "She/Her", "They/Them", "Prefer not to say"],
    },
    {
        "label": "Primary Language(s)",
        "field_type": "text",
        "profile_field": "primary_language",
        "is_required": False,
        "display_order": 4,
        "options": [],
    },
    {
        "label": "Country of Origin",
        "field_type": "text",
        "profile_field": "country_of_origin",
        "is_required": False,
        "display_order": 5,
        "options": [],
    },
    {
        "label": "Marital Status",
        "field_type": "single_select",
        "profile_field": "marital_status",
        "is_required": False,
        "display_order": 6,
        "options": ["Single", "Married", "Common-law", "Separated", "Divorced", "Widowed", "Prefer not to say"],
    },
    {
        "label": "Highest Education Level",
        "field_type": "single_select",
        "profile_field": "highest_education_level",
        "is_required": False,
        "display_order": 7,
        "options": [
            "Some high school",
            "High school diploma / GED",
            "Some college or university",
            "College diploma",
            "Bachelor's degree",
            "Master's degree",
            "Doctoral degree",
            "Prefer not to say",
        ],
    },
    {
        "label": "Living Arrangement",
        "field_type": "single_select",
        "profile_field": "living_arrangement",
        "is_required": False,
        "display_order": 8,
        "options": ["Alone", "With family", "With roommates", "With partner / spouse", "Other"],
    },
    {
        "label": "Number of Dependents",
        "field_type": "number",
        "profile_field": "dependents",
        "is_required": False,
        "display_order": 9,
        "options": [],
    },
    {
        "label": "Occupation / Employment Status",
        "field_type": "single_select",
        "profile_field": "occupation_status",
        "is_required": False,
        "display_order": 10,
        "options": [
            "Student",
            "Full-time employed",
            "Part-time employed",
            "Self-employed",
            "Unemployed",
            "Retired",
            "Unable to work",
            "Prefer not to say",
        ],
    },
]


async def seed_profile_data_elements(db: AsyncSession) -> None:
    # ── 1. Seed data elements (idempotent) ───────────────────────────────────
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

    # ── 2. Create Intake Form if it doesn't exist ────────────────────────────
    form_result = await db.execute(
        select(SurveyForm).where(SurveyForm.title == INTAKE_FORM_TITLE)
    )
    form = form_result.scalar_one_or_none()

    if not form:
        form = SurveyForm(
            title=INTAKE_FORM_TITLE,
            description="Standard participant intake and demographic information form.",
            status="published",
            cadence="once",
        )
        db.add(form)
        await db.flush()  # get form_id

        for field_def in INTAKE_FORM_FIELDS:
            field = FormField(
                form_id=form.form_id,
                label=field_def["label"],
                field_type=field_def["field_type"],
                profile_field=field_def["profile_field"],
                is_required=field_def["is_required"],
                display_order=field_def["display_order"],
            )
            db.add(field)
            await db.flush()  # get field_id

            for i, opt_label in enumerate(field_def["options"], start=1):
                db.add(FieldOption(
                    field_id=field.field_id,
                    value=i,
                    label=opt_label,
                    display_order=i,
                ))

        await db.flush()

    # ── 3. Auto-link intake fields to their data elements ────────────────────
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
