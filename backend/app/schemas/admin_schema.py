from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


# ── Admin Assign Caretaker schemas added by Job (SPRINT 6) ──────────────────

class CaretakerItem(BaseModel):
    caretaker_id: UUID
    user_id: UUID
    name: str
    email: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None


class AssignCaretakerRequest(BaseModel):
    user_id: UUID
    group_id: UUID


class AssignCaretakerResponse(BaseModel):
    group_id: UUID
    caretaker_id: UUID
    message: str


class UnassignCaretakerResponse(BaseModel):
    group_id: UUID
    message: str


class DeleteGroupResponse(BaseModel):
    group_id: UUID
    message: str
    ungrouped_participants: List[str]  # participant IDs that lost their group


# ── Admin Backup & Restore schemas added by Job (SPRINT 7) ──────────────────

class BackupMetaResponse(BaseModel):
    snapshot_name: str
    created_at: str
    table_row_counts: dict  # {"users": 10, "groups": 3, ...}


class RestoreResponse(BaseModel):
    restored_from: str   # snapshot_name from the file
    tables_restored: int
    message: str


class BackupPreviewResponse(BaseModel):
    snapshot_name: str
    created_at: Optional[datetime] = None
    table_count: int
    total_rows: int
    table_row_counts: dict
    auth_fields_sanitized: bool = False
    checksum: Optional[str] = None
    checksum_verified: bool = False
    matched_backup_id: Optional[UUID] = None
    can_inline_restore: bool = False


# ── Admin Profile schemas ────────────────────────────────────────────────────

class AdminProfileUpdate(BaseModel):
    title: Optional[str] = None
    role_title: Optional[str] = None
    department: Optional[str] = None
    organization: Optional[str] = None
    bio: Optional[str] = None
    contact_preference: Optional[str] = None


class AdminProfileOut(BaseModel):
    admin_id: UUID
    title: Optional[str] = None
    role_title: Optional[str] = None
    department: Optional[str] = None
    organization: Optional[str] = None
    bio: Optional[str] = None
    contact_preference: str
    onboarding_completed: bool

    class Config:
        from_attributes = True


# ── User Management schemas ──────────────────────────────────────────────────

class UserListItem(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    role: Optional[str] = None
    status: bool
    locked_until: Optional[datetime] = None
    joined_at: Optional[datetime] = None
    group_id: Optional[UUID] = None
    group: Optional[str] = None
    caretaker_id: Optional[UUID] = None
    caretaker: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    anonymized_from: Optional[str] = None
    self_deactivated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: str  # "active" | "inactive"


class UserReactivateRequest(BaseModel):
    email: Optional[str] = None


class UserDeleteRequest(BaseModel):
    mode: str = "anonymize"  # "anonymize" | "delete" | "permanent"


class MoveParticipantRequest(BaseModel):
    group_id: UUID | None = None


# ── Invite Management schemas ────────────────────────────────────────────────

class InviteListItem(BaseModel):
    invite_id: UUID
    email: str
    role: Optional[str] = None
    group_id: Optional[UUID] = None
    group_name: Optional[str] = None
    invited_by: UUID
    created_at: datetime
    expires_at: datetime
    used: bool
    status: str  # "accepted" | "expired" | "pending"

    class Config:
        from_attributes = True


# ── Backup History schemas ────────────────────────────────────────────────────

class BackupListItem(BaseModel):
    backup_id: UUID
    storage_path: str
    created_at: Optional[datetime] = None
    checksum: Optional[str] = None
    created_by: Optional[UUID] = None
    can_inline_restore: bool = False

    class Config:
        from_attributes = True


class BackupScheduleSettingsPayload(BaseModel):
    enabled: bool
    frequency: str
    time: str
    day_of_week: Optional[str] = None
    day_of_month: Optional[int] = None
    timezone: str
    scope: str = "full"
    retention_count: int = 5
    notify_on_success: bool = True
    notify_on_failure: bool = True

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str) -> str:
        allowed = {"daily", "weekly", "biweekly", "monthly"}
        normalized = value.strip().lower()
        if normalized not in allowed:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(allowed))}.")
        return normalized

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        parts = value.split(":")
        if len(parts) != 2:
            raise ValueError("Time must be in HH:MM format.")
        hour, minute = parts
        if not (hour.isdigit() and minute.isdigit()):
            raise ValueError("Time must be in HH:MM format.")
        hour_i = int(hour)
        minute_i = int(minute)
        if hour_i not in range(24) or minute_i not in range(60):
            raise ValueError("Time must be in HH:MM format.")
        return f"{hour_i:02d}:{minute_i:02d}"

    @field_validator("day_of_week")
    @classmethod
    def validate_day_of_week(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        allowed = {
            "sunday", "monday", "tuesday", "wednesday",
            "thursday", "friday", "saturday",
        }
        if normalized not in allowed:
            raise ValueError("Invalid day_of_week value.")
        return normalized

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Invalid timezone.") from exc
        return value

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"full", "health_data", "system_config"}
        if normalized not in allowed:
            raise ValueError("Invalid backup scope.")
        return normalized

    @field_validator("retention_count")
    @classmethod
    def validate_retention_count(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Retention count must be zero or greater.")
        return value

    @model_validator(mode="after")
    def validate_schedule_shape(self):
        if self.frequency in {"weekly", "biweekly"} and not self.day_of_week:
            raise ValueError("day_of_week is required for weekly and biweekly schedules.")
        if self.frequency == "monthly":
            if self.day_of_month is None:
                raise ValueError("day_of_month is required for monthly schedules.")
            if self.day_of_month < 1 or self.day_of_month > 28:
                raise ValueError("day_of_month must be between 1 and 28.")
        return self


class BackupScheduleSettingsOut(BackupScheduleSettingsPayload):
    schedule_id: Optional[UUID] = None
    next_run_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[UUID] = None

