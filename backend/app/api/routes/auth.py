"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status,Response,Depends,BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import PasswordHash,create_access_token, generate_reset_token, hash_reset_token, reset_token_expiry
from app.schemas.schemas import UserSignup
from app.services.cookies import _set_cookie
from app.services.auth_service import authenticate_user,reset_forgot_password,create_user_with_role
from app.schemas.schemas import LoginRequest,UserResponse ,ForgotPasswordIn  
from app.core.dependency import check_current_user
from app.services.email_sender import send_reset_email


router = APIRouter()


@router.post("/login")

async def login(data: LoginRequest, response: Response,db: AsyncSession = Depends(get_db)):
    """authenticates user by checking email and hashed password in the dummy db"""
    user = await authenticate_user(data.email, data.password,db)
    token = create_access_token({"sub": str(user.user_id)})
    _set_cookie(response, token)
    return {"detail": "Login successful"}
    

#fix the queries over here
@router.post("/register_participant/{role_name}")
async def register(role_name: str,payload: UserSignup, db: AsyncSession = Depends(get_db)):
    """User registration endpoint"""
    role_map = {
        "participant": "participant",
        "caretaker": "caretaker",
        "researcher": "researcher",
    }

    key = role_name.lower()
    if key not in role_map:
        raise HTTPException(status_code=400, detail="Invalid role")
    


    new_user = await create_user_with_role(payload, role_map[key], db)
    return new_user
    

@router.post("/logout")
async def logout(response: Response):
    """User logout endpoint - clears the auth cookie"""
    response.delete_cookie("token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user(user: User = Depends(check_current_user)):
    """Get current authenticated user"""
    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn,background: BackgroundTasks,db: AsyncSession = Depends(get_db),):
    await reset_forgot_password(payload,background,db)
    return {"message": "If the email exists, a reset link has been sent."}