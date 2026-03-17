from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class FieldOptionCreate(BaseModel):
    label: str
    value: int
    display_order: int

class FieldOptionOut(BaseModel):
    option_id: UUID
    label: str
    value: int
    display_order: int

    class Config:
        from_attributes = True

class FormFieldCreate(BaseModel):
    label: str
    field_type: str
    is_required: bool
    display_order: int
    options: List[FieldOptionCreate] = []
    element_id: Optional[UUID] = None  # maps this field to a DataElement on save

class FormFieldOut(BaseModel):
    field_id: UUID
    label: str
    field_type: str
    is_required: bool
    display_order: int
    element_id: Optional[UUID] = None  # populated from FieldElementMap
    options: List[FieldOptionOut] = []

    class Config:
        from_attributes = True

#survey
class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    fields: List[FormFieldCreate] = []

class SurveyDetailOut(BaseModel):
    form_id: UUID
    title: str
    description: Optional[str] = None
    version: int
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    fields: List[FormFieldOut] = []

    class Config:
        from_attributes = True

class SurveyListItem(BaseModel):
    form_id: UUID
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    deployment_id: Optional[UUID] = None
    fields: List[FormFieldOut] = []

    class Config:
        from_attributes = True

class ParticipantSurveyItem(BaseModel):
    form_id: UUID
    title: str
    description: Optional[str] = None
    status: str # NEW, IN_PROGRESS, COMPLETED
    deployed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    question_count: int = 0
    answered_count: int = 0

    class Config:
        from_attributes = True
