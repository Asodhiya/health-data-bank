from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date


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


# ── Admin Profile schemas ────────────────────────────────────────────────────

class AdminProfileUpdate(BaseModel):
    role_title: Optional[str] = None
    department: Optional[str] = None
    organization: Optional[str] = None
    bio: Optional[str] = None
    contact_preference: Optional[str] = None


class AdminProfileOut(BaseModel):
    admin_id: UUID
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
    joined_at: Optional[datetime] = None
    group_id: Optional[UUID] = None
    group: Optional[str] = None
    caretaker_id: Optional[UUID] = None
    caretaker: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: str  # "active" | "inactive"


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

    class Config:
        from_attributes = True
