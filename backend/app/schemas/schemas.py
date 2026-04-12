"""
Auth Schemas
"""
from datetime import datetime
from uuid import UUID
import re
from pydantic import BaseModel, EmailStr, Field, model_validator, field_validator
from typing import Optional, Dict, Any, Literal


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
    address: str

    @field_validator("first_name", "last_name", "username", "password", "confirm_password", "phone", "address")
    @classmethod
    def validate_not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be left empty or whitespace")
        return value.strip()

    @field_validator("username")
    @classmethod
    def validate_username_format(cls, value: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", value):
            raise ValueError("Username must contain only alphanumeric characters and underscores")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        errors = []
        if len(value) < 8:
            errors.append("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", value):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", value):
            errors.append("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            errors.append("Password must contain at least one special character.")
        if errors:
            raise ValueError(" ".join(errors))
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        digits_only = re.sub(r"\D", "", value)
        if len(digits_only) != 10:
            raise ValueError("phone number must contain exactly 10 digits")
        return digits_only

    @model_validator(mode="after")
    def validate_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

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
    identifier: str

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Username or email is required.")
        return cleaned

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


ProgressMode = Literal["incremental", "absolute"]
GoalDirection = Literal["at_least", "at_most"]
GoalWindow = Literal["daily", "weekly", "monthly", "none"]

class GoalTemplateCreate(BaseModel):
    element_id: UUID
    name: str
    description: Optional[str] = None
    default_target: Optional[float] = None
    progress_mode: ProgressMode = "incremental"
    direction: GoalDirection = "at_least"
    window: GoalWindow = "daily"

class GoalTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_target: Optional[float] = None
    progress_mode: Optional[ProgressMode] = None
    direction: Optional[GoalDirection] = None
    window: Optional[GoalWindow] = None
    is_active: Optional[bool] = None

class HealthGoalPayload(BaseModel):
    template_id: UUID
    target_value: float = Field(..., gt=0, le=10000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GoalFromTemplateCreate(BaseModel):
    target_value: Optional[float] = Field(None, gt=0, le=10000)
    window: GoalWindow = "daily"

class HealthGoalUpdate(BaseModel):
    target_value: Optional[float] = Field(None, gt=0, le=10000)
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    progress_mode: Optional[ProgressMode] = None
    direction: Optional[GoalDirection] = None
    window: Optional[GoalWindow] = None
    baseline_value: Optional[float] = None

class GoalProgressLog(BaseModel):
    # Legacy field kept for backward compatibility with existing frontend calls.
    value: Optional[float | str | bool] = None
    value_number: Optional[float] = Field(None, gt=0, le=10000)
    value_text: Optional[str] = None
    value_bool: Optional[bool] = None
    notes: Optional[str] = None
    observed_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_payload(self):
        if (
            self.value is None
            and self.value_number is None
            and self.value_text is None
            and self.value_bool is None
        ):
            raise ValueError(
                "Provide one of: value, value_number, value_text, or value_bool."
            )
        return self


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


FeedbackCategory = Literal[
    "general",
    "bug",
    "issue",
    "feature",
    "accessibility",
    "support",
    "account",
    "performance",
]
FeedbackStatus = Literal["new", "in_review", "in_progress", "resolved", "dismissed"]


class SystemFeedbackCreate(BaseModel):
    category: FeedbackCategory = "general"
    subject: Optional[str] = None
    message: str
    page_path: Optional[str] = None

    @field_validator("subject", "page_path")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 5:
            raise ValueError("Message must be at least 5 characters long.")
        if len(cleaned) > 5000:
            raise ValueError("Message must be 5000 characters or fewer.")
        return cleaned

    @model_validator(mode="after")
    def validate_issue_subject(self):
        if self.category in {"bug", "issue", "support", "account", "performance"}:
            if not self.subject:
                raise ValueError("Subject is required when reporting an issue.")
        return self


class SystemFeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus


class SystemFeedbackItem(BaseModel):
    feedback_id: UUID
    user_id: Optional[UUID]
    category: str
    subject: Optional[str]
    message: str
    page_path: Optional[str]
    status: str
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[UUID]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


