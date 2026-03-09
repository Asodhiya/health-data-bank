"""
Data Element Schemas
"""
from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class DataElementCreate(BaseModel):
    code: str
    label: Optional[str] = None
    datatype: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None


class FieldMapPayload(BaseModel):
    element_id: UUID
    transform_rule: Optional[dict] = None
