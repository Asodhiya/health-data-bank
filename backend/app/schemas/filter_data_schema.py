from pydantic import BaseModel
from typing import Optional, Dict, List
from uuid import UUID
from datetime import datetime


class AvailableSurvey(BaseModel):
    form_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    version: Optional[int] = 1
    parent_form_id: Optional[UUID] = None
    deployed_groups: list[str] = []

    class Config:
        from_attributes = True

class ParticipantProfileOut(BaseModel):
    dob: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None
    occupation_status: Optional[str] = None
    living_arrangement: Optional[str] = None
    highest_education_level: Optional[str] = None
    dependents: Optional[bool] = None
    marital_status: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ParticipantProfileUpdate(BaseModel):
    dob: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None
    occupation_status: Optional[str] = None
    living_arrangement: Optional[str] = None
    highest_education_level: Optional[str] = None
    dependents: Optional[bool] = None
    marital_status: Optional[str] = None
    address: Optional[str] = None


class ParticipantFilter(BaseModel):
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None
    occupation_status: Optional[str] = None
    living_arrangement: Optional[str] = None
    highest_education_level: Optional[str] = None
    dependents: Optional[bool] = None
    marital_status: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    status: Optional[str] = None
    group_ids: List[UUID] = []
    search: Optional[str] = None
    survey_id: Optional[str] = None

class ParticipantResponse(BaseModel):
    id: int
    # Name should not be included
    gender: Optional[str] = None
    age: Optional[int] = None
    #TODO: add some demographics like: education level, employment status, household composition (marital status, # of dependents), language.
    group_id: Optional[int] = None
    status: bool
    raw_score: Optional[float] = None

    class Config:
        from_attributes = True


class HealthDataPointOut(BaseModel):

    data_id: UUID
    participant_id: Optional[UUID] = None
    element_label: Optional[str] = None
    value_text: Optional[str] = None
    value_number: Optional[float] = None
    value_date: Optional[datetime] = None
    value_json: Optional[Dict] = None
    unit: Optional[str] = None
    observed_at: Optional[datetime] = None
    source_type: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True
