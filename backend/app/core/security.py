import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.core.config import settings

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
    
# ── JWT Tokens (added for session management) ────────────────────────

def create_access_token(data: dict, expires_minutes: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
