from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import User, ResearcherProfile
from app.core.dependency import require_permissions
from app.core.permissions import FORM_VIEW
from app.schemas.researcher_schema import ResearcherProfileUpdate, ResearcherProfileOut

router = APIRouter()


@router.get("/profile", response_model=ResearcherProfileOut)
async def get_researcher_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Researcher profile not found")
    return profile


@router.patch("/profile", response_model=ResearcherProfileOut)
async def update_researcher_profile(
    payload: ResearcherProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(FORM_VIEW)),
):
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Researcher profile not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    if not profile.onboarding_completed:
        profile.onboarding_completed = True

    await db.commit()
    await db.refresh(profile)
    return profile
