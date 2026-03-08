from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict,Literal
from datetime import datetime,date
from uuid import UUID
from datetime import date

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
    participant_id: int
    name: str
    status: Literal["active", "inactive"]
    group_id: Optional[int] = None
    last_submission_at: Optional[date] = None


class ParticipantDetail(BaseModel):
    participant_id: int
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
    goal_id: int
    title: str
    metric_name: str
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    status: Literal["active", "paused", "completed", "cancelled"]


class SubmissionListItem(BaseModel):
    submission_id: int
    participant_id: int
    form_id: int
    form_name: str
    submitted_at: date


class SubmissionDetail(BaseModel):
    submission_id: int
    participant_id: int
    form_id: int
    form_name: str
    submitted_at: date
    answers: dict[str, Any] = Field(default_factory=dict)


class NoteCreateRequest(BaseModel):
    text: str = Field(min_length=1)
    tag: Optional[str] = None
    relates_to_submission_id: Optional[int] = None
    relates_to_report_id: Optional[int] = None


class NoteItem(BaseModel):
    note_id: int
    participant_id: int
    text: str
    tag: Optional[str] = None
    created_at: date


class NoteUpdateRequest(BaseModel):
    text: Optional[str] = None
    tag: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    metrics: list[str] = Field(default_factory=list)
    report_type: Literal["numeric", "graph"] = "numeric"


class ReportResponse(BaseModel):
    report_id: int
    scope: Literal["participant", "group", "comparison"]
    created_at: date
    payload: dict[str, Any] = Field(default_factory=dict)


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None


class GroupItem(BaseModel):
    group_id: int
    name: str
    description: Optional[str] = None


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
    notification_id: int
    title: str
    message: str
    created_at: date
    is_read: bool


class NotificationReadRequest(BaseModel):
    is_read: bool = True
