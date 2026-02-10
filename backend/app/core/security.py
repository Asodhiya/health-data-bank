import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
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