from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class ParticipantFilter(BaseModel):
    #should get from the user profiles
    gender: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    group_id: Optional[str] = None
    status: Optional[str] = None
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

class AvailableSurvey(BaseModel):
    form_id: UUID
    title: str

    class Config:
        from_attributes = True
