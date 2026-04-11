from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class IntakeAnswerIn(BaseModel):
    field_id: str
    value: Any = None


class IntakeSubmission(BaseModel):
    answers: List[IntakeAnswerIn]


class IntakeFieldOptionOut(BaseModel):
    label: Optional[str] = None
    value: Optional[int] = None
    display_order: Optional[int] = None


class IntakeFieldOut(BaseModel):
    field_id: str
    label: str
    field_type: str
    is_required: Optional[bool] = None
    display_order: Optional[int] = None
    profile_field: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    options: List[IntakeFieldOptionOut] = []


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


class IntakeFormUpdateIn(BaseModel):
    fields: List[Dict[str, Any]]  # [{label, field_type, is_required, display_order, profile_field, options: [...]}]
