from fastapi import HTTPException, status, Depends
from app.db.session import get_db
from app.core.security import PasswordHash
from app.middleware.signup_validation import UserSignup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import User
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

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
