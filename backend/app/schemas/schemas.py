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

class Role_user_link(BaseModel):
    role_name : str
    username: str

class Permissions_schema(BaseModel):
    code: str
    description: str

class Userverify(BaseModel):
    username: str
class UpdatePersonalInfoPayload(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    old_password: Optional[str] = None
    new_password:Optional[str] = None

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class Link_role_permission_schema(BaseModel):
    code: str
    role_name: str

class SignupInviteRequest(BaseModel):
    email: EmailStr
    target_role: str

class HealthGoalPayload(BaseModel):
    goal_type: str
    target_value: float
    unit: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


