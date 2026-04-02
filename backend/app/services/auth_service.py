import os
from fastapi import HTTPException, status, BackgroundTasks

from app.core.security import PasswordHash, verify_password_async, generate_reset_token, hash_reset_token, reset_token_expiry
from app.middleware.signup_validation import UserSignup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import User, Role
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
from app.schemas.schemas import ForgotPasswordIn,Role_user_link
from app.services.email_sender import send_reset_email
from app.db.queries.Queries import RoleQuery, UserQuery

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

async def authenticate_user(identifier: str, password: str, db: AsyncSession):
    """Checks email or username and password if in db or not"""
    identifier = identifier.strip()
    res = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.username == identifier)
        )
    )
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )
    if user.status is False:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive."
        )

    now = datetime.now(timezone.utc)

    if user.locked_until and user.locked_until > now:
        unlock_in = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=423,
            detail=f"Account locked due to too many failed attempts. Try again in {unlock_in} minute(s)."
        )

    stored_hash = user.password_hash
    if not await verify_password_async(password, stored_hash.encode("utf-8")):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            await db.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Account locked after {MAX_FAILED_ATTEMPTS} failed attempts. Try again in {LOCKOUT_DURATION_MINUTES} minutes."
            )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    await db.commit()

    return user

async def create_user(payload: UserSignup, db: AsyncSession):
    res = await db.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT ,
                    detail= "User already exists"
        )

    hashedpwd = PasswordHash.from_password(payload.password)
    hashedpwd = hashedpwd.to_str()
    user = User(
        username= payload.username,
        email= payload.email,
        password_hash= hashedpwd,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        status=True

    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="User already exists")

    await db.refresh(user)
    return user

async def create_user_with_role(payload: UserSignup, role_name: str, db: AsyncSession):
    user_query = UserQuery(db)
    role_query = RoleQuery(db)

    user = await user_query.get_user(payload.username)
    if user:
        raise HTTPException(status_code=409, detail="User already exists")

    role = await role_query.get_role(role_name)
    if not role:
        raise HTTPException(status_code=500, detail=f"{role_name} role not configured")

    hashedpwd = PasswordHash.from_password(payload.password).to_str()

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hashedpwd,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        Address=payload.address,
        status=True,
    )

    db.add(user)
    await db.flush()

    await role_query.assign_role_to_user(user, role)
    await role_query.put_role(user.user_id, role_name)
    await db.commit()
    await db.refresh(user)
    return user

async def get_user_by_id(user_id: str, db: AsyncSession):
    """get user if found in db"""
    result = await db.execute(select(User).where(User.user_id == user_id))
    return result.scalar_one_or_none()




async def reset_forgot_password( payload: ForgotPasswordIn, background: BackgroundTasks,db: AsyncSession ):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user:
        return {"message": "If the email exists, a reset link has been sent."}

    raw_token = generate_reset_token()
    user.reset_token_hash = hash_reset_token(raw_token)
    user.reset_token_expires_at = reset_token_expiry(15)

    await db.commit()
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    send_reset_email(user.email, reset_link)
    # background.add_task(send_reset_email, user.email, reset_link)

    return {"message": "If the email exists, a reset link has been sent."}

async def reset_password(payload, db: AsyncSession):
    """Validates reset token and updates the user's password."""
    token_hash = hash_reset_token(payload.token)
    result = await db.execute(select(User).where(User.reset_token_hash == token_hash))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if user.reset_token_expires_at is None or user.reset_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    if PasswordHash.from_str(user.password_hash).verify(payload.new_password):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as your current password."
        )

    user.password_hash = PasswordHash.from_password(payload.new_password).to_str()
    user.reset_token_hash = None
    user.reset_token_expires_at = None

    await db.commit()
