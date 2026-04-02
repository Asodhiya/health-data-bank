from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID


class ResearcherProfileUpdate(BaseModel):
    title: Optional[str] = None
    credentials: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None


class ResearcherProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    researcher_id: UUID
    user_id: UUID
    title: Optional[str] = None
    credentials: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    onboarding_completed: bool
