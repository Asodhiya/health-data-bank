from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services import auth_service


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


@pytest.mark.anyio
async def test_authenticate_user_clears_stale_lock_after_expiry(monkeypatch):
    user = SimpleNamespace(
        user_id=uuid4(),
        email="user@example.com",
        username="user",
        status=True,
        password_hash="hashed",
        failed_login_attempts=7,
        locked_until=datetime.now(timezone.utc) - timedelta(minutes=1),
        last_login_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_ScalarResult(user))

    monkeypatch.setattr(
        auth_service,
        "verify_password_async",
        AsyncMock(return_value=True),
    )

    resolved = await auth_service.authenticate_user("user@example.com", "secret", db)

    assert resolved is user
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.last_login_at is not None
    db.commit.assert_awaited()


@pytest.mark.anyio
async def test_authenticate_user_clears_active_lock_immediately_in_debug(monkeypatch):
    user = SimpleNamespace(
        user_id=uuid4(),
        email="user@example.com",
        username="user",
        status=True,
        password_hash="hashed",
        failed_login_attempts=10,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=9),
        last_login_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_ScalarResult(user))

    monkeypatch.setattr(auth_service.settings, "DEBUG", True)
    monkeypatch.setattr(
        auth_service,
        "verify_password_async",
        AsyncMock(return_value=True),
    )

    resolved = await auth_service.authenticate_user("user@example.com", "secret", db)

    assert resolved is user
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.last_login_at is not None
    db.commit.assert_awaited()
