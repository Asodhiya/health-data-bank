"""
Authentication Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.core.config import settings
from app.core.security import create_access_token
from app.middleware.authentication_middleware import auth_middleware
from app.schemas.auth import LoginRequest, MessageResponse, RegisterRequest, UserResponse
from app.services.auth_service import authenticate_user, create_user, get_user_by_id

router = APIRouter()


def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path=settings.COOKIE_PATH,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: RegisterRequest, response: Response):
    user = await create_user(data)
    token = create_access_token({"sub": str(user["id"])})
    _set_cookie(response, token)
    return user


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, response: Response):
    user = await authenticate_user(data.email, data.password)
    token = create_access_token({"sub": str(user["id"])})
    _set_cookie(response, token)
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response, _=Depends(auth_middleware)):
    response.delete_cookie(key=settings.COOKIE_NAME, path=settings.COOKIE_PATH)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(payload: dict = Depends(auth_middleware)):
    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
