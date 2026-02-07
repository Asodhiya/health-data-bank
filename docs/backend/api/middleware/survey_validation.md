# Survey Validation Documentation

This document describes the validation logic used for survey submissions. The validation is implemented using Pydantic models in `app/middleware/survey_validation.py`.

## Dependencies & Imports

The validation logic relies on the following Python libraries and Pydantic components:

```python
from typing import Any, Dict
from pydantic import BaseModel, Field, field_validator
```

- **`pydantic`**: The core library for data validation.
  - `BaseModel`: The base class for creating data models.
  - `Field`: Used to define default values and metadata.
  - `field_validator`: A decorator used to define custom validation logic.

## Overview

The `SurveyRequest` model ensures that survey responses are properly formatted and that no required answers are left empty.

## Validation Rules

### 1. Answers Dictionary
The model accepts a dictionary of answers where keys are question identifiers and values are the user's responses.

```python
class SurveyRequest(BaseModel):
    # If empty, sets default value to a dictionary
    answers: Dict[str, Any] = Field(default_factory=dict)
```

### 2. Validate Answers Not Empty
Iterates through the provided answers and ensures that no value is `None` or an empty string (whitespace only).

```python
@field_validator('answers')
@classmethod
def validate_answers_not_empty(cls, v: Dict[str, Any]):
    for key, value in v.items():
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValueError(f"Field '{key}' cannot be empty")
    return v
```

## Usage Example

```python
from app.middleware.survey_validation import SurveyRequest

test_survey = {
    "question_1": "Yes",
    "question_2": "No",
    "question_3": "Maybe"
}

try:
    survey = SurveyRequest(answers=test_survey)
    print("Validation successful:", survey.model_dump())
except ValueError as e:
    print("Validation failed:", e)
```
