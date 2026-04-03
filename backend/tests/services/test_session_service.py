from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.dependency import check_current_user
from app.services import session_service


@pytest.mark.anyio
async def test_create_user_session_sets_future_expiry():
    db = AsyncMock()
    db.add = MagicMock()
    session = None

    def add_side_effect(obj):
        nonlocal session
        session = obj
        session.session_id = uuid4()

    db.add.side_effect = add_side_effect

    created = await session_service.create_user_session(uuid4(), db)

    assert created is session
    assert created.expired_at > datetime.now(timezone.utc)
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(created)


@pytest.mark.anyio
async def test_check_current_user_rejects_missing_session_id(monkeypatch):
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 1234)})
    request._cookies = {"token": "token"}
    db = AsyncMock()

    monkeypatch.setattr("app.core.dependency.decode_access_token", lambda token: {"sub": str(uuid4())})

    with pytest.raises(HTTPException, match="Invalid token"):
        await check_current_user(request, db)


@pytest.mark.anyio
async def test_check_current_user_rejects_expired_or_missing_session(monkeypatch):
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 1234)})
    request._cookies = {"token": "token"}
    db = AsyncMock()
    user_id = uuid4()
    session_id = uuid4()

    monkeypatch.setattr(
        "app.core.dependency.decode_access_token",
        lambda token: {"sub": str(user_id), "session_id": str(session_id)},
    )

    async def fake_get_active_session(session_uuid, _db):
        return None

    monkeypatch.setattr("app.core.dependency.get_active_session", fake_get_active_session)

    with pytest.raises(HTTPException, match="Session expired or invalid"):
        await check_current_user(request, db)


@pytest.mark.anyio
async def test_check_current_user_touches_valid_session(monkeypatch):
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 1234)})
    request._cookies = {"token": "token"}
    db = AsyncMock()
    user_id = uuid4()
    session_id = uuid4()
    session = SimpleNamespace(session_id=session_id, user_id=user_id)
    user = SimpleNamespace(user_id=user_id)

    monkeypatch.setattr(
        "app.core.dependency.decode_access_token",
        lambda token: {"sub": str(user_id), "session_id": str(session_id)},
    )

    async def fake_get_active_session(session_uuid, _db):
        return session

    async def fake_get_user_by_id(found_user_id, _db):
        return user

    touched = {"called": False}

    async def fake_touch_session(found_session, _db):
        touched["called"] = True
        return found_session

    monkeypatch.setattr("app.core.dependency.get_active_session", fake_get_active_session)
    monkeypatch.setattr("app.core.dependency.get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr("app.core.dependency.touch_session", fake_touch_session)

    resolved_user = await check_current_user(request, db)

    assert resolved_user is user
    assert touched["called"] is True
    assert request.state.session is session
