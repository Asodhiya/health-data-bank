from fastapi import APIRouter, HTTPException, status,Response,Depends
from app.core.dependency import check_current_user
from app.db.session import get_db
from app.schemas.schemas import UpdatePersonalInfoPayload
from app.services.user_update import update_user
from app.db.models import User
from sqlalchemy.ext.asyncio import AsyncSession
router = APIRouter()

@router.post("/update_user")
async def update_user_profile(Payload:UpdatePersonalInfoPayload ,user: User = Depends(check_current_user),db: AsyncSession = Depends(get_db)):
    await update_user(Payload,user,db)
    return "detail : User updated sucessfully"