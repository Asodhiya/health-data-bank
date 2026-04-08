import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core import rate_limit as rate_limit_module
from app.db.session import get_db
from unittest.mock import AsyncMock


def setup_function():
    rate_limit_module.rate_limiter = rate_limit_module.InMemoryRateLimiter()


def _stub_rate_limit_side_effects(app: FastAPI, monkeypatch):
    fake_db = AsyncMock()

    async def fake_db_dep():
        return fake_db

    app.dependency_overrides[get_db] = fake_db_dep
    monkeypatch.setattr(rate_limit_module, "write_audit_log", AsyncMock())
    monkeypatch.setattr(rate_limit_module, "_maybe_alert_admins_for_rate_limit_spike", AsyncMock())


def test_rate_limit_blocks_after_threshold(monkeypatch):
    app = FastAPI()
    limiter = rate_limit_module.rate_limit(scope="test:login", limit=2, window_seconds=60)

    @app.get("/limited", dependencies=[Depends(limiter)])
    async def limited():
        return {"ok": True}

    _stub_rate_limit_side_effects(app, monkeypatch)
    client = TestClient(app)
    rate_limit_module.rate_limiter.reset()

    assert client.get("/limited").status_code == 200
    assert client.get("/limited").status_code == 200

    blocked = client.get("/limited")
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"]
    assert blocked.json()["detail"] == "Too many requests. Please try again later."


def test_rate_limit_is_isolated_by_scope(monkeypatch):
    app = FastAPI()
    auth_limiter = rate_limit_module.rate_limit(scope="auth:login", limit=1, window_seconds=60)
    invite_limiter = rate_limit_module.rate_limit(scope="auth:invite", limit=1, window_seconds=60)

    @app.get("/login", dependencies=[Depends(auth_limiter)])
    async def login():
        return {"ok": True}

    @app.get("/invite", dependencies=[Depends(invite_limiter)])
    async def invite():
        return {"ok": True}

    _stub_rate_limit_side_effects(app, monkeypatch)
    client = TestClient(app)
    rate_limit_module.rate_limiter.reset()

    assert client.get("/login").status_code == 200
    assert client.get("/invite").status_code == 200
    assert client.get("/login").status_code == 429
    assert client.get("/invite").status_code == 429


def test_rate_limit_is_isolated_by_client_ip(monkeypatch):
    app = FastAPI()
    limiter = rate_limit_module.rate_limit(scope="test:shared", limit=1, window_seconds=60)

    @app.get("/limited", dependencies=[Depends(limiter)])
    async def limited():
        return {"ok": True}

    _stub_rate_limit_side_effects(app, monkeypatch)
    client = TestClient(app)
    rate_limit_module.rate_limiter.reset()

    first = client.get("/limited", headers={"X-Forwarded-For": "1.1.1.1"})
    second = client.get("/limited", headers={"X-Forwarded-For": "2.2.2.2"})
    third = client.get("/limited", headers={"X-Forwarded-For": "1.1.1.1"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429


def test_redis_backend_selection_falls_back_to_memory_when_unavailable(monkeypatch):
    monkeypatch.setattr(rate_limit_module.settings, "RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setattr(rate_limit_module, "Redis", None)

    limiter = rate_limit_module._build_rate_limiter()

    assert isinstance(limiter, rate_limit_module.InMemoryRateLimiter)


def test_rate_limit_supports_custom_key_func(monkeypatch):
    app = FastAPI()

    async def email_key(request):
        body = await request.json()
        return body.get("email", "missing")

    limiter = rate_limit_module.rate_limit(
        scope="auth:forgot-password:email",
        limit=1,
        window_seconds=60,
        key_func=email_key,
    )

    @app.post("/forgot", dependencies=[Depends(limiter)])
    async def forgot():
        return {"ok": True}

    _stub_rate_limit_side_effects(app, monkeypatch)
    client = TestClient(app)
    rate_limit_module.rate_limiter = rate_limit_module.InMemoryRateLimiter()

    first = client.post("/forgot", json={"email": "one@example.com"})
    second = client.post("/forgot", json={"email": "one@example.com"})
    third = client.post("/forgot", json={"email": "two@example.com"})

    assert first.status_code == 200
    assert second.status_code == 429
    assert third.status_code == 200


def test_rate_limit_logs_audit_and_alerts_on_block(monkeypatch):
    app = FastAPI()
    limiter = rate_limit_module.rate_limit(scope="auth:login:ip", limit=1, window_seconds=60)

    @app.get("/limited", dependencies=[Depends(limiter)])
    async def limited():
        return {"ok": True}

    fake_db = AsyncMock()

    async def fake_db_dep():
        return fake_db

    app.dependency_overrides[get_db] = fake_db_dep
    client = TestClient(app)
    rate_limit_module.rate_limiter = rate_limit_module.InMemoryRateLimiter()

    monkeypatch.setattr(rate_limit_module, "write_audit_log", AsyncMock())
    monkeypatch.setattr(rate_limit_module, "_maybe_alert_admins_for_rate_limit_spike", AsyncMock())

    assert client.get("/limited").status_code == 200
    blocked = client.get("/limited")

    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many login attempts from this network. Please try again later."
    assert rate_limit_module.write_audit_log.await_count == 1
    assert rate_limit_module._maybe_alert_admins_for_rate_limit_spike.await_count == 1


@pytest.mark.anyio
async def test_rate_limit_spike_alert_creates_admin_notification(monkeypatch):
    admin_id = "admin-1"
    db = AsyncMock()

    monkeypatch.setattr(rate_limit_module.settings, "RATE_LIMIT_ALERT_THRESHOLD", 3)
    monkeypatch.setattr(rate_limit_module, "_count_recent_rate_limit_exceedances", AsyncMock(return_value=3))
    monkeypatch.setattr(rate_limit_module, "_get_admin_user_ids", AsyncMock(return_value=[admin_id]))
    monkeypatch.setattr(rate_limit_module, "notification_exists_recent", AsyncMock(return_value=False))
    monkeypatch.setattr(rate_limit_module, "create_notification", AsyncMock())
    monkeypatch.setattr(rate_limit_module, "write_audit_log", AsyncMock())

    await rate_limit_module._maybe_alert_admins_for_rate_limit_spike(
        db,
        scope="auth:login:identifier",
        key_kind="identifier",
        key_value="user@example.com",
        ip_address="127.0.0.1",
        window_seconds=300,
    )

    assert rate_limit_module.create_notification.await_count == 1
    assert rate_limit_module.write_audit_log.await_count == 1
