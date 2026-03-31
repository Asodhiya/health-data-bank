from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class IntakeProfileData(BaseModel):
    dob: Optional[str] = None
    gender: Optional[str] = None            # frontend field is "sex"
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None  # frontend field is "language"
    marital_status: Optional[str] = None
    highest_education_level: Optional[str] = None
    address: Optional[str] = None           # Q1: where do you live
    dependents: Optional[bool] = None       # Q2
    occupation_status: Optional[str] = None # Q4


class IntakeSubmission(BaseModel):
    profile: IntakeProfileData
    answers: List[Dict[str, Any]]  # [{"field_id": "...", "value": ...}]


class ConsentSubmitIn(BaseModel):
    answers: Dict[str, str]  # {item_id: "yes"/"no"}
    signature: str


class ConsentTemplateUpdateIn(BaseModel):
    title: str
    subtitle: Optional[str] = None
    items: List[Dict[str, Any]]


class BackgroundInfoUpdateIn(BaseModel):
    title: str
    subtitle: Optional[str] = None
    sections: List[Dict[str, Any]]
