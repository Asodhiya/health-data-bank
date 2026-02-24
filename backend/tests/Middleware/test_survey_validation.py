import pytest
from pydantic import ValidationError
from app.middleware.survey_validation import UserSignup


def valid_survey_data():
    return {
        "first_name": "Jane",
        "last_name": "Smith",
        "username": "jane_smith",
        "email": "jane@example.com",
        "password": "SurveyP@ss1",
        "confirm_password": "SurveyP@ss1",
        "phone": "555-123-4567",
    }


def test_valid_survey_signup_passes():
    user = UserSignup(**valid_survey_data())
    assert user.phone == "5551234567"


def test_survey_rejects_empty_last_name():
    data = valid_survey_data()
    data["last_name"] = ""
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_survey_rejects_invalid_email():
    data = valid_survey_data()
    data["email"] = "bad@email"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_survey_password_strength_enforced():
    data = valid_survey_data()
    data["password"] = "password"
    data["confirm_password"] = "password"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_survey_phone_must_have_10_digits():
    data = valid_survey_data()
    data["phone"] = "555"
    with pytest.raises(ValidationError):
        UserSignup(**data)
