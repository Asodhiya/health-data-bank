"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends, Response
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.services.auth_service import authenticate_user, create_user
from app.core.security import create_access_token
from app.core.config import settings
from app.middleware.authentication_middleware import auth_middleware
from app.middleware.signup_validation import UserSignup

router = APIRouter()

# --- Schemas ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: Optional[str] = None

# --- Helpers ---
def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False, # Set to True in production (HTTPS)
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

# --- Routes ---

@router.post("/register", response_model=UserResponse)
async def register(data: UserSignup):
    user = await create_user(data)
    return user


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, response: Response):
    """authenticates user by checking email and hashed password in the dummy db"""
    user = await authenticate_user(data.email, data.password)
    token = create_access_token({"sub": str(user["id"])})
    _set_cookie(response, token)
    return {k: v for k, v in user.items() if k != "password_hash"}

@router.post("/logout")
async def logout(response: Response):

    response.delete_cookie("token")
    return {"message": "Logged out successfully"}

@router.get("/me")
async def get_current_user(current_user: dict = Depends(auth_middleware)):
    return {
        "status": "success",
        "user": current_user
    }
