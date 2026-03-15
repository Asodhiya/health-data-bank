"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status, Response, Depends, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from datetime import datetime, timezone
from app.db.session import get_db
from app.core.security import PasswordHash, create_access_token, generate_reset_token, hash_reset_token, reset_token_expiry
from app.schemas.schemas import UserSignup
from app.services.cookies import _set_cookie
from app.services.auth_service import authenticate_user, reset_forgot_password, create_user_with_role, update_last_login
from app.schemas.schemas import LoginRequest, UserResponse, ForgotPasswordIn
from app.core.dependency import check_current_user, require_permissions
from app.core.permissions import SEND_INVITE
from app.services.email_sender import send_reset_email, send_invite_email
from app.core.security import InviteTokenGenerator
from app.schemas.schemas import SignupInviteRequest
from app.db.queries.Queries import RoleQuery, UserQuery, InviteQuery
from app.services.audit_service import write_audit_log


router = APIRouter()


def _get_client_ip(request: Request) -> str:
    """
    Extract the real client IP from the request.
    Checks X-Forwarded-For first (set by proxies/load balancers),
    then falls back to the direct connection IP.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login")
async def login(
    data: LoginRequest,
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Authenticates user by checking email and hashed password."""
    ip = _get_client_ip(request)

    try:
        user = await authenticate_user(data.email, data.password, db)
    except HTTPException:
        # Log the failed attempt — no user_id since we can't confirm the email exists
        await write_audit_log(
            db,
            action="LOGIN_FAILED",
            ip_address=ip,
            actor_user_id=None,
            entity_type="user",
            details={"email_attempted": data.email},
        )
        raise  # re-raise the original 401

    # Successful login
    await write_audit_log(
        db,
        action="LOGIN_SUCCESS",
        ip_address=ip,
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        details={"email": user.email},
    )

    background_tasks.add_task(update_last_login, user, db)
    token = create_access_token({"sub": str(user.user_id)})
    _set_cookie(response, token)
    return {"detail": "Login successful"}


@router.post("/register")
async def register(
    token: str,
    payload: UserSignup,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """User registration via invite link."""
    ip = _get_client_ip(request)
    invite_queries = InviteQuery(db)
    role_queries = RoleQuery(db)

    invite = await invite_queries.get_invite_by_token_hash(hash_reset_token(token))
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")
    if invite.email != payload.email:
        raise HTTPException(status_code=400, detail="Email does not match invite")

    role = await role_queries.get_role_by_id(invite.role_id)
    new_user = await create_user_with_role(payload, role.role_name, db)

    invite.used = True
    await db.commit()

    await write_audit_log(
        db,
        action="REGISTER_SUCCESS",
        ip_address=ip,
        actor_user_id=new_user.user_id,
        entity_type="user",
        entity_id=new_user.user_id,
        details={"email": new_user.email, "role": role.role_name},
    )

    return new_user


@router.get("/validate-invite")
async def get_token(token: str, db: AsyncSession = Depends(get_db)):
    invite_queries = InviteQuery(db)
    role_queries = RoleQuery(db)

    invite = await invite_queries.get_invite_by_token_hash(hash_reset_token(token))
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")

    role = await role_queries.get_role_by_id(invite.role_id)

    return {
        "email": invite.email,
        "role": role.role_name,
        "expires_at": invite.expires_at,
    }


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_current_user),
):
    """User logout endpoint - clears the auth cookie and logs the event."""
    ip = _get_client_ip(request)

    await write_audit_log(
        db,
        action="LOGOUT",
        ip_address=ip,
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        details={"email": user.email},
    )

    response.delete_cookie("token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_current_user),
):
    user_queries = UserQuery(db)
    user_roles = await user_queries.get_user_roles(user.user_id)
    """Get current authenticated user"""
    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "Role": user_roles,
    }


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    background: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = _get_client_ip(request)

    await reset_forgot_password(payload, background, db)

    await write_audit_log(
        db,
        action="PASSWORD_RESET_REQUESTED",
        ip_address=ip,
        actor_user_id=None,
        entity_type="user",
        details={"email_attempted": payload.email},
    )

    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/signup_invite")
async def signup_invite(
    Payload: SignupInviteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(SEND_INVITE)),
):
    ip = _get_client_ip(request)
    user_queries = UserQuery(db)
    user_roles = await user_queries.get_user_roles(current_user.user_id)
    target_role = Payload.target_role.lower()

    if "admin" in user_roles:
        pass
    elif "caretaker" in user_roles:
        if target_role != "participant":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Caretakers can only invite participants",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to send invites",
        )

    generator = InviteTokenGenerator(
        current_user_id=current_user.user_id,
        current_user_role=user_roles[0],
        target_role=target_role,
        target_email=Payload.email,
    )
    result = await generator.save(db)
    send_invite_email(Payload.email, result["invite_url"])

    # Log the invite being sent
    await write_audit_log(
        db,
        action="INVITE_SENT",
        ip_address=ip,
        actor_user_id=current_user.user_id,
        entity_type="invite",
        details={
            "invited_email": Payload.email,
            "target_role": target_role,
            "sent_by_role": user_roles[0],
        },
    )

    return result