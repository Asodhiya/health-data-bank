"""
Auth Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr,Field
from typing import Optional,Dict,Any


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
 

class LoginRequest(BaseModel):
    identifier: str  # email or username
    password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: Optional[datetime] = None


class MessageResponse(BaseModel):
    message: str

class UserSignup(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    password: str
    confirm_password: str
    phone: str

class SurveyRequest(BaseModel):
    # If empty, sets default value to a dictionary
    answers: Dict[str, Any] = Field(default_factory=dict)

class Role_schema(BaseModel):
    role_name: str

class Role_user_link(BaseModel):
    role_name : str
    username: str

class Permissions_schema(BaseModel):
    code: str
    description: str

class Userverify(BaseModel):
    username: str
class UpdatePersonalInfoPayload(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    old_password: Optional[str] = None
    new_password:Optional[str] = None

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

class Link_role_permission_schema(BaseModel):
    code: str
    role_name: str

class SignupInviteRequest(BaseModel):
    email: EmailStr
    target_role: str
    group_id: Optional[UUID] = None

class HealthDataPointPayload(BaseModel):
    element_id: UUID
    observed_at: Optional[datetime] = None
    source_type: Optional[str] = None
    value_text: Optional[str] = None
    value_number: Optional[float] = None
    value_date: Optional[datetime] = None
    value_json: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class GoalTemplateCreate(BaseModel):
    element_id: UUID
    name: str
    description: Optional[str] = None
    default_target: Optional[float] = None

class GoalTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_target: Optional[float] = None
    is_active: Optional[bool] = None

class HealthGoalPayload(BaseModel):
    template_id: UUID
    target_value: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class HealthGoalUpdate(BaseModel):
    target_value: Optional[float] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class GoalProgressLog(BaseModel):
    value: float
    notes: Optional[str] = None
    observed_at: Optional[datetime] = None


# ── Data Visualization ────────────────────────────────────────────────────────

class DataPointOut(BaseModel):
    """A single normalised health observation for charting."""
    data_id: UUID
    observed_at: Optional[datetime]
    source_type: Optional[str]          # "survey" | "goal" | "manual"
    value_number: Optional[float]
    value_text: Optional[str]
    value_json: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class ElementSeriesOut(BaseModel):
    """
    All observations for one DataElement, ready for a time-series chart.

    `observations` contains survey / manual data points.
    `goal_target`  is the participant's current target for this element
                   (None if no active goal exists).
    """
    element_id: UUID
    label: str                       
    unit: Optional[str]                
    datatype: Optional[str]             
    goal_target: Optional[float]
    observations: list[DataPointOut]


class ParticipantVisualizationOut(BaseModel):
    """
    Full visualisation payload for a participant's dashboard.

    Each entry in `series` is one element with its time-series observations
    and current goal target, so the frontend can render one chart per element.
    """
    participant_id: UUID
    series: list[ElementSeriesOut]


# ── Stats Summary ─────────────────────────────────────────────────────────────

class ParticipantSummaryOut(BaseModel):
    """
    High-level summary stats for the participant dashboard header cards.

    active_forms    — forms currently deployed/assigned to the participant.
    forms_filled    — how many of those they have submitted at least once.
    active_goals    — number of health goals the participant is tracking.
    goals_met       — goals where today's most recent goal data point for that
                      element meets or exceeds the target value.
    """
    active_forms: int
    forms_filled: int
    active_goals: int
    goals_met: int
    goal_remaining: int


class GroupComparisonElementOut(BaseModel):
    """
    Per-element comparison of the participant's latest value vs the group.
    """
    element_id: UUID
    label: str
    unit: Optional[str]
    participant_latest: Optional[float]   # most recent survey value_number
    group_mean: Optional[float]           # avg across all group members
    group_median: Optional[float]


class ParticipantVsGroupOut(BaseModel):
    """
    Full vs-group comparison payload — one entry per element the participant
    has data for, showing their latest value against the group aggregate.
    """
    participant_id: UUID
    comparisons: list[GroupComparisonElementOut]


