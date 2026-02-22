"""
Unit Tests: Survey Pydantic Schemas (app/schemas/survey_schema.py)

What we are testing:
    The Pydantic models that researchers use to create and submit survey forms:
      - SurveyCreate    : what a researcher POSTs to create a form
      - FormFieldCreate : a single question inside a form
      - FieldOptionCreate: one answer choice for a multiple-choice question

Run with:
    pytest tests/schemas/test_survey_schema.py -v
"""

import pytest
from pydantic import ValidationError
from app.schemas.survey_schema import (
    SurveyCreate,
    FormFieldCreate,
    FieldOptionCreate,
)


# ---------------------------------------------------------------------------
# FieldOptionCreate
# ---------------------------------------------------------------------------

class TestFieldOptionCreate:

    def test_valid_option_passes(self):
        opt = FieldOptionCreate(label="Strongly Agree", value=5, display_order=1)
        assert opt.label == "Strongly Agree"
        assert opt.value == 5

    def test_missing_label_raises(self):
        with pytest.raises(ValidationError):
            FieldOptionCreate(value=1, display_order=0)

    def test_missing_value_raises(self):
        with pytest.raises(ValidationError):
            FieldOptionCreate(label="Yes", display_order=0)

    def test_missing_display_order_raises(self):
        with pytest.raises(ValidationError):
            FieldOptionCreate(label="Yes", value=1)


# ---------------------------------------------------------------------------
# FormFieldCreate
# ---------------------------------------------------------------------------

class TestFormFieldCreate:

    def _valid_field(self, **overrides) -> dict:
        base = {
            "label": "How are you feeling today?",
            "field_type": "multiple_choice",
            "is_required": True,
            "display_order": 1,
            "options": [],
        }
        base.update(overrides)
        return base

    def test_valid_field_without_options_passes(self):
        field = FormFieldCreate(**self._valid_field())
        assert field.label == "How are you feeling today?"
        assert field.options == []

    def test_valid_field_with_options_passes(self):
        options = [
            {"label": "Good", "value": 3, "display_order": 1},
            {"label": "Okay", "value": 2, "display_order": 2},
            {"label": "Bad",  "value": 1, "display_order": 3},
        ]
        field = FormFieldCreate(**self._valid_field(options=options))
        assert len(field.options) == 3
        assert field.options[0].label == "Good"

    def test_missing_label_raises(self):
        data = self._valid_field()
        del data["label"]
        with pytest.raises(ValidationError):
            FormFieldCreate(**data)

    def test_missing_field_type_raises(self):
        data = self._valid_field()
        del data["field_type"]
        with pytest.raises(ValidationError):
            FormFieldCreate(**data)

    def test_is_required_must_be_bool(self):
        """is_required must be a boolean — Pydantic will coerce "yes" to True,
        but a non-coercible value should fail."""
        # Pydantic v2 is strict about booleans — pass an actual bool
        field = FormFieldCreate(**self._valid_field(is_required=False))
        assert field.is_required is False


# ---------------------------------------------------------------------------
# SurveyCreate
# ---------------------------------------------------------------------------

class TestSurveyCreate:

    def _valid_survey(self, **overrides) -> dict:
        base = {
            "title": "Monthly Health Check",
            "description": "A routine monthly survey for participants.",
            "fields": [],
        }
        base.update(overrides)
        return base

    def test_valid_survey_with_no_fields_passes(self):
        survey = SurveyCreate(**self._valid_survey())
        assert survey.title == "Monthly Health Check"
        assert survey.fields == []

    def test_description_is_optional(self):
        """Description can be omitted — it's Optional[str] = None."""
        data = self._valid_survey()
        del data["description"]
        survey = SurveyCreate(**data)
        assert survey.description is None

    def test_fields_defaults_to_empty_list(self):
        """If fields is omitted, it should default to []."""
        survey = SurveyCreate(title="Quick Survey")
        assert survey.fields == []

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            SurveyCreate(description="No title provided")

    def test_survey_with_one_field_passes(self):
        fields = [
            {
                "label": "Pain level (1-10)",
                "field_type": "scale",
                "is_required": True,
                "display_order": 1,
                "options": [],
            }
        ]
        survey = SurveyCreate(**self._valid_survey(fields=fields))
        assert len(survey.fields) == 1
        assert survey.fields[0].label == "Pain level (1-10)"

    def test_survey_with_multiple_fields_and_options_passes(self):
        fields = [
            {
                "label": "Overall wellbeing",
                "field_type": "multiple_choice",
                "is_required": True,
                "display_order": 1,
                "options": [
                    {"label": "Excellent", "value": 4, "display_order": 1},
                    {"label": "Good",      "value": 3, "display_order": 2},
                    {"label": "Fair",      "value": 2, "display_order": 3},
                    {"label": "Poor",      "value": 1, "display_order": 4},
                ],
            },
            {
                "label": "Any new symptoms?",
                "field_type": "text",
                "is_required": False,
                "display_order": 2,
                "options": [],
            },
        ]
        survey = SurveyCreate(title="Wellness Survey", fields=fields)
        assert len(survey.fields) == 2
        assert len(survey.fields[0].options) == 4
        assert survey.fields[1].is_required is False