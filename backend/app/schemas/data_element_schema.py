"""
Data Element Schemas
"""
import re
from pydantic import BaseModel, field_validator, model_validator, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class DataElementCreate(BaseModel):
    code: str
    label: Optional[str] = None
    datatype: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned:
            raise ValueError("Code is required.")
        if not re.fullmatch(r"[a-z0-9_]+", cleaned):
            raise ValueError("Code must use lowercase letters, numbers, and underscores only.")
        return cleaned

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("datatype")
    @classmethod
    def normalize_datatype(cls, value: Optional[str]) -> str:
        normalized = (value or "number").strip().lower()
        aliases = {
            "numeric": "number",
            "int": "integer",
            "double": "float",
            "decimal": "float",
            "string": "text",
            "bool": "boolean",
        }
        normalized = aliases.get(normalized, normalized)
        if normalized not in {"number", "integer", "float", "text", "boolean", "date"}:
            raise ValueError("Datatype must be one of: number, integer, float, text, boolean, date.")
        return normalized

    @field_validator("unit")
    @classmethod
    def normalize_unit(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_unit_for_datatype(self):
        if self.datatype in {"text", "boolean", "date"} and self.unit:
            raise ValueError(
                f"{self.datatype.title()} data elements cannot have a unit. Leave the unit blank."
            )
        return self


class DataElementUpdate(BaseModel):
    label: Optional[str] = None
    datatype: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None

    @field_validator("label", "description")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("datatype")
    @classmethod
    def normalize_datatype(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        aliases = {
            "numeric": "number",
            "int": "integer",
            "double": "float",
            "decimal": "float",
            "string": "text",
            "bool": "boolean",
        }
        normalized = aliases.get(normalized, normalized)
        if normalized not in {"number", "integer", "float", "text", "boolean", "date"}:
            raise ValueError("Datatype must be one of: number, integer, float, text, boolean, date.")
        return normalized

    @field_validator("unit")
    @classmethod
    def normalize_unit(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_unit_for_datatype(self):
        if self.datatype in {"text", "boolean", "date"} and self.unit:
            raise ValueError(
                f"{self.datatype.title()} data elements cannot have a unit. Leave the unit blank."
            )
        return self


class FieldMapPayload(BaseModel):
    element_id: UUID
    transform_rule: Optional[dict] = None


class DataElementListItem(BaseModel):
    element_id: UUID
    code: str
    label: Optional[str] = None
    datatype: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DataElementListPage(BaseModel):
    items: List[DataElementListItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 1
    page_size: int = 15
    total_pages: int = 1
