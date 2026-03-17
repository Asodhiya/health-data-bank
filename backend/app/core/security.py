import asyncio
import hashlib
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SignupInvite, Role
from sqlalchemy import select
from fastapi import HTTPException




load_dotenv()


class PasswordHash:
    __slots__ = ("_value",)

    def __init__(self, value: bytes):
        self._value = value

    @classmethod
    def from_password(cls, password: str, rounds: int = 12):
        hashed = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds)
        )
        return cls(hashed)

    def verify(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self._value
        )

    def to_str(self) -> str:
        return self._value.decode("utf-8")

    @classmethod
    def from_str(cls, value: str):
        return cls(value.encode("utf-8"))


_password_executor = ThreadPoolExecutor(max_workers=4)

async def verify_password_async(password: str, hashed: bytes) -> bool:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _password_executor, bcrypt.checkpw, password.encode("utf-8"), hashed
    )


@dataclass
class InviteTokenGenerator:
    current_user_id: int
    current_user_role: str
    target_role: str
    target_email: str
    group_id: object = None  # uuid.UUID | None
    expires_in_hours: int = 48
    base_url: str = "https://yourapp.com"

    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    expires_at: datetime = field(init=False)

    def __post_init__(self):
        self.target_role = self.target_role.lower()
        self.expires_at = datetime.utcnow() + timedelta(hours=self.expires_in_hours)

    def build_model(self, role_id) -> SignupInvite:
        return SignupInvite(
            email=self.target_email,
            token_hash=hash_reset_token(self.token),
            role_id=role_id,
            expires_at=self.expires_at,
            used=False,
            invited_by=self.current_user_id,
            group_id=self.group_id,
        )

    async def save(self, db: AsyncSession) -> dict:
        role_result = await db.execute(select(Role).where(Role.role_name == self.target_role))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{self.target_role}' not found")

        invite = self.build_model(role.role_id)
        db.add(invite)
        await db.commit()
        await db.refresh(invite)

        return {
            "invite_url": f"{self.base_url}/register?token={self.token}",
            "role": self.target_role,
            "expires_at": self.expires_at,
        }

def create_access_token(data: dict, expires_minutes: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, os.getenv("JWT_SECRET"), algorithm=os.getenv("JWT_ALGORITHM"))


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=[os.getenv("JWT_ALGORITHM")])
    except JWTError:
        return None
    

def generate_reset_token() -> str:
  
    return secrets.token_urlsafe(32)

def hash_reset_token(token: str) -> str:
   
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def reset_token_expiry(minutes: int = 15) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)