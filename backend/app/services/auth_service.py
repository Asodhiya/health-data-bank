"""
Auth Service — business logic for registration and login
"""
from fastapi import HTTPException, status
from app.core.database import get_db
from app.core.security import PasswordHash
from app.schemas.auth import RegisterRequest


async def create_user(data: RegisterRequest) -> dict:
    async with get_db() as conn:
        exists = await (
            await conn.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        ).fetchone()

        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

        hashed = PasswordHash.from_password(data.password).to_str()

        user = await (
            await conn.execute(
                """
                INSERT INTO users (first_name, last_name, email, password_hash)
                VALUES (%s, %s, %s, %s)
                RETURNING id, first_name, last_name, email, is_active, created_at
                """,
                (data.first_name, data.last_name, data.email, hashed),
            )
        ).fetchone()
        return user


async def authenticate_user(email: str, password: str) -> dict:
    async with get_db() as conn:
        user = await (
            await conn.execute(
                "SELECT id, first_name, last_name, email, password_hash, is_active, created_at FROM users WHERE email = %s",
                (email,),
            )
        ).fetchone()

    if not user or not PasswordHash.from_str(user["password_hash"]).verify(password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return user


async def get_user_by_id(user_id: str) -> dict | None:
    async with get_db() as conn:
        return await (
            await conn.execute(
                "SELECT id, first_name, last_name, email, is_active, created_at FROM users WHERE id = %s",
                (user_id,),
            )
        ).fetchone()
