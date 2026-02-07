# Signup Validation Documentation

This document describes the validation logic used during user signup. The validation is implemented using Pydantic models in `app/middleware/signup_validation.py`.

## Dependencies & Imports

The validation logic relies on the following Python libraries and Pydantic components:

```python
import re
from typing import Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field, field_validator, ValidationInfo
```

- **`re`**: Python's built-in regular expression module, used for pattern matching (email, username, password strength, phone).
- **`pydantic`**: The core library for data validation and settings management.
  - `BaseModel`: The base class for creating data models.
  - `EmailStr`: A Pydantic type that automatically validates email formats.
  - `field_validator`: A decorator used to define custom validation logic for specific fields.
  - `ValidationInfo`: Used to access other fields during validation (e.g., comparing `confirm_password` with `password`).

## Overview

The `UserSignup` model enforces strict validation rules to ensure data integrity and security before processing user registration.

## Validation Rules

### 1. Strip Whitespace
Automatically strips leading and trailing whitespace from text fields before validation.

```python
@field_validator("first_name", "last_name", "username", "phone")
@classmethod
def strip_text(cls,v: str):
    if isinstance(v, str):
        return v.strip()
    return v
```

### 2. Required Fields
Ensures that fields are not empty or just whitespace.
- **Fields**: `first_name`, `last_name`, `username`, `password`, `confirm_password`, `phone`

```python
@field_validator('first_name', 'last_name', 'username', 'password', 'confirm_password', 'phone')
@classmethod
def validate_not_empty(cls, v: str):
    if not v or not v.strip():
        raise ValueError(v + 'Field cannot be left empty or whitespace')
    return v
```

### 3. Username Format
Enforces alphanumeric characters and underscores only.
- **Regex**: `^[a-zA-Z0-9_]+$`

```python
@field_validator('username')
@classmethod
def validate_username_format(cls, v: str):
    #alphanumeric and underscores only
    if not re.match(r'^[a-zA-Z0-9_]+$', v):
        raise ValueError('Username must contain only alphanumeric characters and underscores')
    return v
```

### 4. Email Format
Validates the email against a strict regex pattern, in addition to Pydantic's built-in `EmailStr` validation.
- **Regex**: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`

```python
@field_validator('email')
@classmethod
def validate_email_custom(cls, v: str):
    #test@test.test (MUST LOOK LIKE)
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, str(v)):
        raise ValueError('Invalid email format')
    return v
```

### 5. Password Strength
Checks for minimum length (8), uppercase, lowercase, digit, and special character.

```python
@field_validator('password')
@classmethod
def validate_password_strength(cls, v: str):
    min_length = 8
    errors = []
    if len(v) < min_length:
        errors.append(f"Password must be at least {min_length} characters long.")
    if not re.search(r"[A-Z]", v):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", v):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", v):
        errors.append("Password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
        errors.append("Password must contain at least one special character.")
    
    if errors:
        raise ValueError(" ".join(errors))
    return v
```

### 6. Password Confirmation
Ensures the confirmation password matches the original password.

```python
@field_validator('confirm_password')
@classmethod
def validate_passwords_match(cls, v: str, info: ValidationInfo) -> str:
    if 'password' in info.data and v != info.data['password']:
        raise ValueError('Passwords do not match')
    return v
```

### 7. Phone Number
Strips non-digit characters and ensures exactly 10 digits remain.

```python
@field_validator('phone')
@classmethod
def validate_phone(cls, v:str):
    # format from (555) 555-5555 to 5555555555
    digits_only = re.sub(r'\D', '', v)
    if not digits_only.isdigit() or len(digits_only) != 10:
            raise ValueError('phone number must contain exactly 10 digits')
    return digits_only
```

## Usage Example

```python
from app.middleware.signup_validation import UserSignup

try:
    user = UserSignup(
        first_name="John",
        last_name="Doe",
        username="johndoe_123",
        email="john.doe@example.com",
        password="StrongPassword1!",
        confirm_password="StrongPassword1!",
        phone="(555) 123-4567"
    )
    print("Validation successful:", user.model_dump())
except ValueError as e:
    print("Validation failed:", e)
```
