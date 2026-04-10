from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import List, Optional, Any, Dict, Literal
from datetime import datetime, date
from uuid import UUID

class DashboardStats(BaseModel):
    total_assigned_participants: int = 0
    active_participants: int = 0
    inactive_participants: int = 0
    new_submissions_this_week: int = 0
    participants_with_alerts: int = 0
    goals_near_deadline: int = 0


class DashboardActivityItem(BaseModel):
    type: str
    participant_id: Optional[int] = None
    participant_name: Optional[str] = None
    form_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    goal_title: Optional[str] = None
    target_date: Optional[datetime] = None


class DashboardAlertItem(BaseModel):
    participant_id: int
    participant_name: str
    alert_type: str
    message: str
    severity: Literal["low", "medium", "high"]


class SubmissionOverview(BaseModel):
    weekly_counts: list[dict[str, Any]] = Field(default_factory=list)


class GoalOverview(BaseModel):
    active_goals: int = 0
    completed_this_month: int = 0
    overdue_goals: int = 0
    average_progress: float = 0.0


class GroupSummary(BaseModel):
    total_groups: int = 0
    participants_per_group: list[dict[str, Any]] = Field(default_factory=list)
    group_health_score_average: Optional[float] = None


class CaretakerDashboardResponse(BaseModel):
    stats: DashboardStats
    recent_activity: list[DashboardActivityItem]
    alerts: list[DashboardAlertItem]
    submission_overview: SubmissionOverview
    goal_overview: GoalOverview
    group_summary: GroupSummary


class ParticipantListItem(BaseModel):
    participant_id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    status: Literal["highly_active", "moderately_active", "low_active", "inactive"]
    group_id: Optional[UUID] = None
    enrolled_at: Optional[datetime] = None
    survey_progress: Literal["not_started", "in_progress", "completed"]
    goal_progress: Literal["not_started", "in_progress", "completed"]
    survey_submitted_count: int = 0
    survey_deployed_count: int = 0
    goals_completed_count: int = 0
    goals_total_count: int = 0
    last_login_at: Optional[datetime] = None
    last_submission_at: Optional[date] = None


class PaginatedParticipants(BaseModel):
    """Response wrapper for /caretaker/participants.

    `total_count` is the total number of rows matching the SQL-level filters
    (q, status, gender, age, has_alerts, survey_progress, group_id), ignoring
    the goal_progress filter — that one is applied in Python after the SQL
    fetch (a known limitation tracked as B22). When goal_progress is set,
    `total_count` is therefore an upper bound on the real total.
    """
    items: List[ParticipantListItem]
    total_count: int = 0


class ParticipantActivityCounts(BaseModel):
    highly_active: int = 0
    moderately_active: int = 0
    low_active: int = 0
    inactive: int = 0


class ParticipantDetail(BaseModel):
    participant_id: UUID
    name: str
    status: Literal["active", "inactive"]
    groups: list[dict[str, Any]] = Field(default_factory=list)


class ParticipantSummary(BaseModel):
    participant_id: int
    latest_metrics: dict[str, Any] = Field(default_factory=dict)
    goal_progress: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)


class HealthTrendPoint(BaseModel):
    metric_name: str
    unit: Optional[str] = None
    points: list[dict[str, Any]] = Field(default_factory=list)  # [{date, value}, ...]


class HealthTrendsResponse(BaseModel):
    participant_id: int
    trends: list[HealthTrendPoint]


class GoalItem(BaseModel):
    goal_id: UUID
    title: str
    metric_name: str
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    status: Literal["active", "paused", "completed", "cancelled"]


class SubmissionListItem(BaseModel):
    submission_id: UUID
    participant_id: UUID
    form_id: UUID
    form_name: str
    submitted_at: Optional[datetime]


class GroupDeployedFormItem(BaseModel):
    deployment_id: UUID
    form_id: UUID
    group_id: UUID
    group_name: str
    form_title: str
    form_description: Optional[str] = None
    form_status: Optional[str] = None
    deployed_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    is_active: bool = True
    participant_count: int = 0
    submitted_count: int = 0
    completion_rate: float = 0.0


class SubmissionAnswerItem(BaseModel):
    field_id: Optional[UUID] = None
    field_label: Optional[str] = None
    value_text: Optional[str] = None
    value_number: Optional[float] = None
    value_date: Optional[str] = None
    value_json: Optional[Any] = None


class SubmissionDetailItem(BaseModel):
    submission_id: UUID
    participant_id: UUID
    form_id: UUID
    form_name: str
    submitted_at: Optional[datetime]
    answers: list[SubmissionAnswerItem] = Field(default_factory=list)


class ReportListItem(BaseModel):
    report_id: UUID
    scope: str
    group_id: Optional[UUID] = None
    group_name: Optional[str] = None
    participant_id: Optional[UUID] = None
    created_at: datetime
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    participant_status: Optional[str] = None
    compare_with: Optional[str] = None
    element_count: int = 0
    element_labels: List[str] = Field(default_factory=list)


class NoteCreateRequest(BaseModel):
    text: str = Field(min_length=1)
    tag: Optional[str] = None
    relates_to_submission_id: Optional[UUID] = None
    relates_to_report_id: Optional[UUID] = None


class NoteItem(BaseModel):
    note_id: UUID
    participant_id: UUID
    text: str
    tag: Optional[str] = None
    created_at: datetime


class NoteUpdateRequest(BaseModel):
    text: Optional[str] = None
    tag: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    element_ids: list[UUID] = Field(default_factory=list)
    participant_status: Literal["all", "active", "inactive"] = "all"
    gender: Optional[str] = None
    age_min: Optional[int] = Field(default=None, ge=0, le=150)
    age_max: Optional[int] = Field(default=None, ge=0, le=150)


class ComparisonReportRequest(BaseModel):
    compare_with: Literal["participant", "group", "all"]
    compare_participant_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    element_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_required_fields(self) -> "ComparisonReportRequest":
        if self.compare_with == "participant" and not self.compare_participant_id:
            raise ValueError("compare_participant_id is required when compare_with is 'participant'")
        if self.compare_with == "group" and not self.group_id:
            raise ValueError("group_id is required when compare_with is 'group'")
        return self


class ReportResponse(BaseModel):
    report_id: UUID
    scope: Literal["participant", "group", "comparison"]
    created_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
    parameters: dict[str, Any] = Field(default_factory=dict)


class GroupDataElementItem(BaseModel):
    element_id: UUID
    code: Optional[str] = None
    label: Optional[str] = None
    unit: Optional[str] = None
    datatype: Optional[str] = None
    # Reports v2: richer metadata for the metric picker.
    description: Optional[str] = None
    form_names: List[str] = Field(default_factory=list)
    data_point_count: int = 0


class ParticipantDataElementItem(BaseModel):
    """Reports v2: data elements relevant to a single participant.

    Returned by GET /caretaker/participants/{id}/data-elements. Includes any
    element either currently deployed to one of the participant's groups OR
    with at least one HealthDataPoint for the participant — whichever applies.
    """
    element_id: UUID
    code: Optional[str] = None
    label: Optional[str] = None
    unit: Optional[str] = None
    datatype: Optional[str] = None
    description: Optional[str] = None
    form_names: List[str] = Field(default_factory=list)
    data_point_count: int = 0
    is_currently_deployed: bool = False


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None


class GroupItem(BaseModel):
    group_id: UUID
    name: str
    description: Optional[str] = None
    caretaker_id: Optional[UUID] = None
    member_count: int = 0


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GroupMemberAddRequest(BaseModel):
    participant_id: int


class GoalSuggestionRequest(BaseModel):
    # you can also accept {submission_id} here, but endpoint already can infer
    participant_id: int
    submission_id: Optional[int] = None


class NotificationItem(BaseModel):
    notification_id: UUID
    title: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    is_read: bool


class NotificationReadRequest(BaseModel):
    is_read: bool = True


class GroupMemberItem(BaseModel):
    participant_id: UUID
    name: str
    joined_at: Optional[datetime] = None


class FeedbackCreate(BaseModel):
    message: str = Field(min_length=1)


class FeedbackItem(BaseModel):
    feedback_id: UUID
    caretaker_id: UUID
    participant_id: UUID
    submission_id: Optional[UUID] = None
    message: str
    created_at: datetime


# ── Caretaker Profile schemas ─────────────────────────────────────────────────

class CaretakerProfileUpdate(BaseModel):
    title: Optional[str] = None
    credentials: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    contact_preference: Optional[str] = None
    available_days: Optional[List[str]] = None
    # B19: explicit signal from the onboarding page that the caretaker has
    # finished initial setup. Other profile-edit clients (e.g. ProfilePage)
    # should leave this unset so it preserves whatever value is in the DB.
    onboarding_completed: Optional[bool] = None


class CaretakerProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    caretaker_id: UUID
    user_id: UUID
    title: Optional[str] = None
    credentials: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    contact_preference: Optional[str] = None
    available_days: Optional[List[str]] = None
    onboarding_completed: bool
