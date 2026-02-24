from fastapi import HTTPException, status, BackgroundTasks

from app.core.security import PasswordHash, generate_reset_token, hash_reset_token, reset_token_expiry
from app.middleware.signup_validation import UserSignup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import User
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
from app.schemas.schemas import ForgotPasswordIn
from app.services.email_sender import send_reset_email

async def authenticate_user(email: str, password: str, db: AsyncSession):
    """Checks email and password if in db or not"""
    res = await(db.execute(select(User).where(User.email == email)))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )
    
    stored_hash = user.password_hash
    # verify hashed pass if it matches with the stored hashed db
    if not PasswordHash.from_str(stored_hash).verify(password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

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
    FRONTEND_URL = "http://localhost:3000"
    reset_link = f"{FRONTEND_URL}/forgot-password?token={raw_token}"
    send_reset_email(user.email, reset_link)
    # background.add_task(send_reset_email, user.email, reset_link)

    return {"message": "If the email exists, a reset link has been sent."}
   
