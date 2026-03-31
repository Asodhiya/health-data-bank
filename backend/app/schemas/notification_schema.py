from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationItem(BaseModel):
    notification_id: UUID
    type: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None
    link: Optional[str] = None
    role_target: Optional[str] = None
    created_at: Optional[datetime] = None
    is_read: bool

    class Config:
        from_attributes = True

