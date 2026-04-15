"""
Run with:
    pytest tests/Middleware/test_signup_validation.py -v
    pytest tests/Middleware/test_signup_validation.py -v --html=tests/Middleware/test1_signup_validation_report.html --self-contained-html 
"""

import pytest
from pydantic import ValidationError
from app.middleware.signup_validation import UserSignup


def valid_signup_data():
    return {
        "first_name": "John",
        "last_name": "Doe",
        "username": "john_doe",
        "email": "john@example.com",
        "password": "StrongP@ss1",
        "confirm_password": "StrongP@ss1",
        "phone": "+19025550147",
    }


def test_valid_signup_passes():
    user = UserSignup(**valid_signup_data())
    assert user.phone == "+19025550147"


def test_whitespace_is_stripped():
    data = valid_signup_data()
    data["first_name"] = "  John  "
    user = UserSignup(**data)
    assert user.first_name == "John"


def test_empty_field_fails():
    data = valid_signup_data()
    data["username"] = "   "
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_invalid_username_characters():
    data = valid_signup_data()
    data["username"] = "john@doe"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_invalid_email_format():
    data = valid_signup_data()
    data["email"] = "not-an-email"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_weak_password_fails():
    data = valid_signup_data()
    data["password"] = "weak"
    data["confirm_password"] = "weak"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_passwords_must_match():
    data = valid_signup_data()
    data["confirm_password"] = "DifferentP@ss1"
    with pytest.raises(ValidationError):
        UserSignup(**data)


def test_invalid_phone_number():
    data = valid_signup_data()
    data["phone"] = "123"
    with pytest.raises(ValidationError):
        UserSignup(**data)
