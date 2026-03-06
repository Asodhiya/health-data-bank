"""
Run with:
    pytest tests/Middleware/test_survey_validation.py -v
    pytest tests/Middleware/test_survey_validation.py -v --html=tests/Middleware/test_survey_validation_report.html --self-contained-html 
"""


import pytest
from pydantic import ValidationError
# from app.middleware.survey_validation import UserSignup
from app.middleware.survey_validation import SurveyRequest



def test_survey_request_with_valid_answers():
    survey = SurveyRequest(answers={"question_1": "a", "question_2": "b"})
    assert survey.answers == {"question_1": "a", "question_2": "b"}


def test_survey_request_with_empty_dict():
    survey = SurveyRequest(answers={})
    assert survey.answers == {}


def test_survey_request_rejects_none_value():
    data = {"question_1": "a", "question_2": None}
    with pytest.raises(ValidationError):
        SurveyRequest(answers=data)


def test_survey_request_rejects_empty_string():
    data = {"question_1": "a", "question_2": ""}
    with pytest.raises(ValidationError):
        SurveyRequest(answers=data)


def test_survey_request_rejects_whitespace_only():
    data = {"question_1": "a", "question_2": "   "}
    with pytest.raises(ValidationError):
        SurveyRequest(answers=data)


def test_survey_request_accepts_non_string_values():
    survey = SurveyRequest(answers={"question_1": 123, "question_2": True})
    assert survey.answers == {"question_1": 123, "question_2": True}

