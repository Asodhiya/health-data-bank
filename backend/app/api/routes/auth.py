"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status,Response,Depends,BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from datetime import datetime, timezone
from app.db.session import get_db
from app.core.security import PasswordHash,create_access_token, generate_reset_token, hash_reset_token, reset_token_expiry
from app.schemas.schemas import UserSignup
from app.services.cookies import _set_cookie
from app.services.auth_service import authenticate_user,reset_forgot_password,create_user_with_role
from app.schemas.schemas import LoginRequest,UserResponse ,ForgotPasswordIn  
from app.core.dependency import check_current_user, require_permissions
from app.services.email_sender import send_reset_email
from app.core.security import InviteTokenGenerator
from app.schemas.schemas import SignupInviteRequest
from app.db.queries.Queries import RoleQuery


router = APIRouter()


@router.post("/login")

async def login(data: LoginRequest, response: Response,db: AsyncSession = Depends(get_db)):
    """authenticates user by checking email and hashed password in the dummy db"""
    user = await authenticate_user(data.email, data.password,db)
    token = create_access_token({"sub": str(user.user_id)})
    _set_cookie(response, token)
    return {"detail": "Login successful"}
    

@router.post("/register")
async def register(token: str, payload: UserSignup, db: AsyncSession = Depends(get_db)):
    """User registration via invite link"""
    queries = RoleQuery(db)

    invite = await queries.get_invite_by_token_hash(hash_reset_token(token))
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")
    if invite.email != payload.email:
        raise HTTPException(status_code=400, detail="Email does not match invite")

    role = await queries.get_role_by_id(invite.role_id)

    new_user = await create_user_with_role(payload, role.role_name, db)

    invite.used = True
    await db.commit()

    return new_user
     

@router.get("/validate-invite")
async def get_token(token:str, db: AsyncSession = Depends(get_db) ):
    queries = RoleQuery(db)
    invite = await queries.get_invite_by_token_hash(hash_reset_token(token))
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")

    role = await queries.get_role_by_id(invite.role_id)

    return {
        "email": invite.email,
        "role": role.role_name,
        "expires_at": invite.expires_at,
    }



@router.post("/logout")
async def logout(response: Response):
    """User logout endpoint - clears the auth cookie"""
    response.delete_cookie("token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user( db: AsyncSession = Depends(get_db),user: User = Depends(check_current_user)):
    queries = RoleQuery(db)
    user_roles = await queries.get_user_roles(user.user_id)
    """Get current authenticated user"""
    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "Role": user_roles}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn,background: BackgroundTasks,db: AsyncSession = Depends(get_db),):
    await reset_forgot_password(payload,background,db)
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/signup_invite")
async def signup_invite(Payload: SignupInviteRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_permissions("send:invite"))):
    queries = RoleQuery(db)
    user_roles = await queries.get_user_roles(current_user.user_id)
    target_role = Payload.target_role.lower()

    if "admin" in user_roles:
        pass
    elif "caretaker" in user_roles:
        if target_role != "participant":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caretakers can only invite participants")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to send invites")

    generator = InviteTokenGenerator(
        current_user_id=current_user.user_id,
        current_user_role=user_roles[0],
        target_role=target_role,
        target_email=Payload.email,
    )
    return await generator.save(db)