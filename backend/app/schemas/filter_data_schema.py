from pydantic import BaseModel, model_validator
from typing import Optional, Dict, List, Literal
from uuid import UUID
from datetime import date, datetime


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
    country_of_origin: Optional[str] = None
    occupation_status: Optional[str] = None
    living_arrangement: Optional[str] = None
    highest_education_level: Optional[str] = None
    dependents: Optional[int] = None
    marital_status: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ParticipantProfileUpdate(BaseModel):
    dob: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    primary_language: Optional[str] = None
    country_of_origin: Optional[str] = None
    occupation_status: Optional[str] = None
    living_arrangement: Optional[str] = None
    highest_education_level: Optional[str] = None
    dependents: Optional[int] = None
    marital_status: Optional[str] = None
    address: Optional[str] = None


class ElementValueFilter(BaseModel):
    element_id: UUID
    operator: Literal["eq", "gt", "gte", "lt", "lte", "between", "has_value", "is_empty"]
    value: Optional[float] = None
    value_max: Optional[float] = None
    source_types: List[str] = ["survey", "goal"]

    @model_validator(mode="after")
    def validate_between(self):
        if self.operator == "between" and self.value is None:
            raise ValueError("value is required when operator is 'between'")
        if self.operator == "between" and self.value_max is None:
            raise ValueError("value_max is required when operator is 'between'")
        if self.operator == "between" and self.value_max is not None and self.value_max <= self.value:
            raise ValueError("value_max must be greater than value")
        if self.operator in {"eq", "gt", "gte", "lt", "lte"} and self.value is None:
            raise ValueError(f"value is required when operator is '{self.operator}'")
        return self


class DemographicValueFilter(BaseModel):
    field: Literal[
        "gender", "pronouns", "primary_language",
        "occupation_status", "living_arrangement",
        "highest_education_level", "marital_status",
        "age", "dependents", "status"
    ]
    operator: Literal["eq", "gt", "gte", "lt", "lte", "between", "contains"]
    value: str
    value_max: Optional[str] = None

    @model_validator(mode="after")
    def validate_between(self):
        if self.operator == "between" and self.value_max is None:
            raise ValueError("value_max is required when operator is 'between'")
        return self


class SelectedElementFilter(BaseModel):
    element_id: UUID
    source_types: List[str] = ["survey", "goal"]


class GroupByField(BaseModel):
    type: Literal["demographic", "element"]
    field: Optional[
        Literal[
            "gender",
            "pronouns",
            "primary_language",
            "occupation_status",
            "living_arrangement",
            "highest_education_level",
            "marital_status",
            "age_bucket",
        ]
    ] = None
    element_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_group_by(self):
        if self.type == "demographic" and not self.field:
            raise ValueError("field is required when group_by.type is 'demographic'")
        if self.type == "element" and not self.element_id:
            raise ValueError("element_id is required when group_by.type is 'element'")
        return self


class ParticipantFilter(BaseModel):
    group_ids: List[UUID] = []
    survey_id: Optional[str] = None
    source_types: List[str] = ["survey", "goal"]
    allow_null: bool = True
    selected_elements: List[SelectedElementFilter] = []
    selected_element_ids: List[UUID] = []
    search: Optional[str] = None
    demographic_filters: List[DemographicValueFilter] = []
    element_filters: List[ElementValueFilter] = []
    group_by: Optional[GroupByField] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    mode: Literal["aggregate", "longitudinal"] = "aggregate"
    sort_by: Optional[str] = None
    sort_dir: Literal["asc", "desc"] = "asc"
    limit: Optional[int] = None
    offset: int = 0

    @model_validator(mode="before")
    @classmethod
    def _reject_null_bytes(cls, values):
        if not isinstance(values, dict):
            return values
        for k, v in values.items():
            if isinstance(v, str) and "\x00" in v:
                raise ValueError(f"Field '{k}' contains an invalid null byte character.")
            if isinstance(v, list) and any(isinstance(i, str) and "\x00" in i for i in v):
                raise ValueError(f"Field '{k}' contains an invalid null byte character.")
        return values

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


class TimeseriesFilter(ParticipantFilter):
    element_ids: List[UUID]
    survey_id: Optional[UUID] = None
    source_types: List[str] = ["survey", "goal"]
    mode: Literal["raw", "aggregate"] = "raw"


class ParticipantExportFilter(ParticipantFilter):
    exclude_columns: List[str] = []
