from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


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
