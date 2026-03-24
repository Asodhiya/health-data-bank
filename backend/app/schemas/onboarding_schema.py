from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class IntakeProfileData(BaseModel):
    dob: Optional[str] = None
    gender: Optional[str] = None            # frontend field is "sex"
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None  # frontend field is "language"
    address: Optional[str] = None           # Q1: where do you live
    dependents: Optional[bool] = None       # Q2
    occupation_status: Optional[str] = None # Q4


class IntakeSubmission(BaseModel):
    profile: IntakeProfileData
    answers: List[Dict[str, Any]]  # [{"field_id": "...", "value": ...}]