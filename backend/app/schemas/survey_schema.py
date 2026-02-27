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

class FormFieldOut(BaseModel):
    field_id: UUID
    label: str
    field_type: str
    is_required: bool
    display_order: int
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
    status: str
    created_at: datetime
    fields: List[FormFieldOut] = []

    class Config:
        from_attributes = True

class SurveyListItem(BaseModel):
    form_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    due_date: Optional[datetime] = None
    deployment_id: Optional[UUID] = None
    fields: List[FormFieldOut] = []

    class Config:
        from_attributes = True
