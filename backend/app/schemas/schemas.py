"""
Auth Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr,Field
from typing import Optional,Dict,Any


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
 

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: Optional[datetime] = None


class MessageResponse(BaseModel):
    message: str

class UserSignup(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    password: str
    confirm_password: str
    phone: str

class SurveyRequest(BaseModel):
    # If empty, sets default value to a dictionary
    answers: Dict[str, Any] = Field(default_factory=dict)

class Role_schema(BaseModel):
    role_name: str

class Permissions_schema(BaseModel):
    code: str
    description: str

class Userverify(BaseModel):
    username: str