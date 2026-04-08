from fastapi import Response
import os
from dotenv import load_dotenv
load_dotenv()
expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))  # default 30


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


COOKIE_SECURE = _env_flag("COOKIE_SECURE", default=False)


def _set_cookie(response: Response, token: str, *, max_age_seconds: int | None = None):
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
        max_age=max_age_seconds if max_age_seconds is not None else expire_minutes * 60,
    )
