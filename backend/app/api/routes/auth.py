"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status, Response, Depends, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, GroupMember, ParticipantProfile, ResearcherProfile, CaretakerProfile, Group, Role, UserRole, AuditLog
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
import secrets
from app.db.session import get_db
from app.core.security import PasswordHash, create_access_token, generate_reset_token, hash_reset_token, reset_token_expiry
from app.schemas.schemas import UserSignup
from app.services.cookies import _set_cookie
from app.services.auth_service import (
    authenticate_user,
    reset_forgot_password,
    reset_password,
    register_user_from_invite,
    validate_signup_invite_token,
)
from app.schemas.schemas import LoginRequest, UserResponse, ForgotPasswordIn, ResetPasswordIn
from app.core.dependency import check_current_user, require_permissions, set_rls_context
from app.core.permissions import SEND_INVITE
from app.services.email_sender import send_reset_email, send_invite_email
from app.core.security import InviteTokenGenerator
from app.schemas.schemas import SignupInviteRequest
from app.db.queries.Queries import UserQuery
from app.services.audit_service import write_audit_log
from app.services.notification_service import create_notifications_bulk, create_notification, notification_exists_recent
from app.core.rate_limit import rate_limit
from app.services.session_service import (
    create_user_session,
    revoke_session,
    get_session_token_expiry_minutes,
)


router = APIRouter()


async def _login_identifier_key(request: Request) -> str:
    try:
        body = await request.json()
    except Exception:
        body = {}
    identifier = str(body.get("identifier", "")).strip().lower()
    return identifier or "unknown-identifier"


async def _email_key(request: Request) -> str:
    try:
        body = await request.json()
    except Exception:
        body = {}
    email = str(body.get("email", "")).strip().lower()
    return email or "unknown-email"


login_ip_rate_limit = rate_limit(
    scope="auth:login:ip",
    limit=5,
    window_seconds=60,
    key_kind="ip",
)
login_identifier_rate_limit = rate_limit(
    scope="auth:login:identifier",
    limit=5,
    window_seconds=300,
    key_func=_login_identifier_key,
    key_kind="identifier",
)
register_rate_limit = rate_limit(scope="auth:register", limit=10, window_seconds=3600)
forgot_password_rate_limit = rate_limit(
    scope="auth:forgot-password:ip",
    limit=5,
    window_seconds=300,
    key_kind="ip",
)
forgot_password_email_rate_limit = rate_limit(
    scope="auth:forgot-password:email",
    limit=5,
    window_seconds=1800,
    key_func=_email_key,
    key_kind="email",
)
reset_password_rate_limit = rate_limit(scope="auth:reset-password", limit=10, window_seconds=300)
invite_rate_limit = rate_limit(scope="auth:signup_invite", limit=20, window_seconds=3600)


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


async def _notify_admins_about_locked_account(
    db: AsyncSession,
    *,
    identifier: str,
    user_id,
) -> None:
    admin_rows = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
    )
    admin_ids = [row[0] for row in admin_rows.all()]
    if not admin_ids:
        return

    source_type = "locked_account"
    source_id = user_id
    message = f"An account was temporarily locked after repeated failed sign-in attempts for '{identifier}'."
    for admin_id in admin_ids:
        exists = await notification_exists_recent(
            db,
            user_id=admin_id,
            notification_type="flag",
            source_type=source_type,
            source_id=source_id,
            within_hours=1,
        )
        if not exists:
            await create_notification(
                db=db,
                user_id=admin_id,
                notification_type="flag",
                title="Account lock detected",
                message=message,
                link="/audit-logs",
                role_target="admin",
                source_type=source_type,
                source_id=source_id,
            )


@router.post(
    "/login",
    dependencies=[Depends(login_ip_rate_limit), Depends(login_identifier_rate_limit)],
)
async def login(
    data: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticates user by checking email and hashed password."""
    ip = _get_client_ip(request)
    await set_rls_context(db, role="system")

    try:
        user = await authenticate_user(data.identifier, data.password, db)
    except HTTPException as exc:
        await write_audit_log(
            db,
            action="LOGIN_FAILED",
            ip_address=ip,
            actor_user_id=None,
            entity_type="user",
            details={"identifier_attempted": data.identifier, "user_agent": request.headers.get("User-Agent")},
        )

        if exc.status_code == status.HTTP_423_LOCKED:
            locked_user = await db.scalar(
                select(User).where(
                    (User.email == data.identifier) | (User.username == data.identifier)
                )
            )
            await write_audit_log(
                db,
                action="ACCOUNT_LOCKED",
                ip_address=ip,
                actor_user_id=None,
                entity_type="user",
                entity_id=locked_user.user_id if locked_user else None,
                details={"identifier_attempted": data.identifier},
            )
            await _notify_admins_about_locked_account(
                db,
                identifier=data.identifier,
                user_id=locked_user.user_id if locked_user else None,
            )

        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        failed_count = await db.scalar(
            select(func.count(AuditLog.audit_id))
            .where(AuditLog.action == "LOGIN_FAILED")
            .where(AuditLog.created_at >= one_hour_ago)
        )
        if (failed_count or 0) >= 5:
            admin_rows = await db.execute(
                select(User.user_id)
                .join(UserRole, UserRole.user_id == User.user_id)
                .join(Role, Role.role_id == UserRole.role_id)
                .where(Role.role_name == "admin")
            )
            admin_ids = [row[0] for row in admin_rows.all()]
            for admin_id in admin_ids:
                exists = await notification_exists_recent(
                    db,
                    user_id=admin_id,
                    notification_type="flag",
                    source_type="login_failed_spike",
                    source_id=None,
                    within_hours=1,
                )
                if not exists:
                    await create_notification(
                        db=db,
                        user_id=admin_id,
                        notification_type="flag",
                        title="Login failure spike detected",
                        message=f"{failed_count} failed login attempts were recorded in the last hour.",
                        link="/audit-logs",
                        role_target="admin",
                        source_type="login_failed_spike",
                        source_id=None,
                    )
        raise exc

    # Successful login
    await write_audit_log(
        db,
        action="LOGIN_SUCCESS",
        ip_address=ip,
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        details={"email": user.email, "user_agent": request.headers.get("User-Agent")},
    )

    session = await create_user_session(user.user_id, db)
    token = create_access_token(
        {"sub": str(user.user_id), "session_id": str(session.session_id)},
        expires_minutes=get_session_token_expiry_minutes(),
    )
    _set_cookie(
        response,
        token,
        max_age_seconds=get_session_token_expiry_minutes() * 60,
    )
    return {"detail": "Login successful"}


@router.post("/register", dependencies=[Depends(register_rate_limit)])
async def register(
    token: str,
    payload: UserSignup,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """User registration via invite link."""
    ip = _get_client_ip(request)
    await set_rls_context(db, role="system")
    return await register_user_from_invite(token, payload, ip, db)


@router.get("/validate-invite")
async def get_token(token: str, db: AsyncSession = Depends(get_db)):
    invite_context = await validate_signup_invite_token(token, db)
    role = invite_context["role"]

    return {
        "email": invite_context["email"],
        "role": role.role_name,
        "expires_at": invite_context["expires_at"],
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
    current_session = getattr(request.state, "session", None)

    if current_session:
        await revoke_session(current_session.session_id, db)

    await write_audit_log(
        db,
        action="LOGOUT",
        ip_address=ip,
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        details={"email": user.email, "user_agent": request.headers.get("User-Agent")},
    )

    response.delete_cookie("token")
    return {"message": "Logged out successfully"}


@router.post("/self-deactivate")
async def self_deactivate_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_current_user),
):
    """
    Self-deactivate flow for any signed-in user:
    - Account is deactivated (not hard-deleted)
    - Participant memberships are closed
    - Caretaker group assignments are cleared
    - Admins are notified
    """
    ip = _get_client_ip(request)
    user_queries = UserQuery(db)
    roles = await user_queries.get_user_roles(user.user_id)
    allowed_roles = {"participant", "researcher", "caretaker", "admin"}
    if not any(r in allowed_roles for r in roles):
        raise HTTPException(status_code=403, detail="This account type cannot self-deactivate.")

    role_label = next((r for r in roles if r in allowed_roles), roles[0] if roles else "unknown")

    user.status = False
    user.failed_login_attempts = 0
    user.locked_until = None
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    user.password_hash = PasswordHash.from_password(secrets.token_urlsafe(32)).to_str()

    if role_label == "participant":
        participant_id = await db.scalar(
            select(ParticipantProfile.participant_id).where(ParticipantProfile.user_id == user.user_id)
        )
        if participant_id:
            active_memberships = (
                await db.execute(
                    select(GroupMember)
                    .where(GroupMember.participant_id == participant_id)
                    .where(GroupMember.left_at.is_(None))
                )
            ).scalars().all()
            now = datetime.now(timezone.utc)
            for membership in active_memberships:
                membership.left_at = now
    elif role_label == "caretaker":
        caretaker_id = await db.scalar(
            select(CaretakerProfile.caretaker_id).where(CaretakerProfile.user_id == user.user_id)
        )
        if caretaker_id:
            groups = (
                await db.execute(
                    select(Group).where(Group.caretaker_id == caretaker_id)
                )
            ).scalars().all()
            for group in groups:
                group.caretaker_id = None

    await set_rls_context(db, role="system")
    admin_rows = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
        .where(User.user_id != user.user_id)
    )
    admin_ids = [row[0] for row in admin_rows.all()]

    if admin_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=admin_ids,
            notification_type="flag",
            title="User self-deactivated",
            message=f"A {role_label} account was deactivated.",
            link="/users",
            role_target="admin",
                source_type="user_self_deactivated",
            source_id=user.user_id,
        )

    await write_audit_log(
        db,
        action="USER_SELF_DEACTIVATED",
        ip_address=ip,
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        details={
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": role_label,
        },
        commit=False,
    )
    await db.commit()

    return {"detail": "Account deactivated successfully."}


@router.get("/me")
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_current_user),
):
    """Get current authenticated user"""
    from app.services.onboarding_service import check_intake_completed, get_onboarding_status

    user_queries = UserQuery(db)
    user_roles = await user_queries.get_user_roles(user.user_id)

    intake_completed = None
    onboarding_status = None
    if any(r == "participant" for r in user_roles):
        intake_completed = await check_intake_completed(user.user_id, db)
        onboarding_status = await get_onboarding_status(user.user_id, db)

    onboarding_completed = None
    if any(r == "admin" for r in user_roles):
        onboarding_completed = user.admin_profile.onboarding_completed if user.admin_profile else False
    elif any(r == "caretaker" for r in user_roles):
        onboarding_completed = user.caretaker_profile.onboarding_completed if user.caretaker_profile else False
    elif any(r == "researcher" for r in user_roles):
        onboarding_completed = user.researcher_profile.onboarding_completed if user.researcher_profile else False

    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "phone": user.phone,
        "address": user.Address,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "Role": user_roles,
        "intake_completed": intake_completed,
        "onboarding_completed": onboarding_completed,
        "onboarding_status": onboarding_status,
    }


@router.post(
    "/forgot-password",
    dependencies=[Depends(forgot_password_rate_limit), Depends(forgot_password_email_rate_limit)],
)
async def forgot_password(
    payload: ForgotPasswordIn,
    background: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = _get_client_ip(request)
    await set_rls_context(db, role="system")

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


@router.post("/reset-password", dependencies=[Depends(reset_password_rate_limit)])
async def reset_password_endpoint(
    payload: ResetPasswordIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Validates the reset token and updates the user's password."""
    ip = _get_client_ip(request)
    await set_rls_context(db, role="system")

    await reset_password(payload, db)

    await write_audit_log(
        db,
        action="PASSWORD_RESET_SUCCESS",
        ip_address=ip,
        actor_user_id=None,
        entity_type="user",
        details={},
    )

    return {"message": "Password has been reset successfully."}


@router.post("/signup_invite", dependencies=[Depends(invite_rate_limit)])
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
        group_id=Payload.group_id,
    )
    await set_rls_context(db, role="system")
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

    admin_rows = await db.execute(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
        .where(User.user_id != current_user.user_id)
    )
    admin_ids = [row[0] for row in admin_rows.all()]
    if admin_ids:
        await create_notifications_bulk(
            db=db,
            user_ids=admin_ids,
            notification_type="invite",
            title="New invite sent",
            message=f"{Payload.email} was invited as {target_role}.",
            link="/admin/users",
            role_target="admin",
            source_type="invite_sent",
            source_id=None,
        )

    return result
