"""
Auth Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    is_active: bool
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
