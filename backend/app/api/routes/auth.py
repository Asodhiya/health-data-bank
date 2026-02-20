"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status,Response,Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import PasswordHash,create_access_token
from app.schemas.schemas import UserSignup
from app.services.cookies import _set_cookie
from app.services.auth_service import authenticate_user,create_user
from app.schemas.schemas import LoginRequest,UserResponse   
from app.core.dependency import check_current_user
router = APIRouter()


@router.post("/login")

async def login(data: LoginRequest, response: Response,db: AsyncSession = Depends(get_db)):
    """authenticates user by checking email and hashed password in the dummy db"""
    user = await authenticate_user(data.email, data.password,db)
    token = create_access_token({"sub": str(user.user_id)})
    _set_cookie(response, token)
    return {"detail": "Login successful"}
    

#fix the queries over here
@router.post("/register",response_model=UserResponse)
async def register(payload: UserSignup, db: AsyncSession = Depends(get_db)):
    """User registration endpoint"""
    new_user = await create_user(payload,db)
    return {"id": str(new_user.user_id), "email": new_user.email, "created_at": new_user.created_at}

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



    