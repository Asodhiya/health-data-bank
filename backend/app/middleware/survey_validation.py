from typing import Any, Dict
from pydantic import BaseModel, Field, field_validator


class SurveyRequest(BaseModel):
    # If empty, sets default value to a dictionary
    answers: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('answers')
    @classmethod
    def validate_answers_not_empty(cls, v: Dict[str, Any]):
        for key, value in v.items():
            if value is None or (isinstance(value, str) and not value.strip()):
                raise ValueError(f"Field '{key}' cannot be empty")
        return v


if __name__ == "__main__":
    # Test
    test_survey = {
        "question_1": "a",
        "question_2": "b",
        "question_3": "c",
        "question_4": ""
    }

    # Test  Model
    print("Testing Pydantic Model Validation:")
    try:
        SurveyRequest(answers=test_survey)
        print("Validation successful!")
    except Exception as e:
        print(f"Validation Error: {e}")
