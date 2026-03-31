"""
Targeted edge-case tests for:
1) Participant updates health goals
2) Audit logging for security-critical actions
3) Authentication API endpoints
"""

from __future__ import annotations

import sys
import types
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

# FastAPI checks for python-multipart at import time for routes using UploadFile.
# Provide a local lightweight stub so tests can import all routers in restricted environments.
if "multipart" not in sys.modules:
    multipart_mod = types.ModuleType("multipart")
    multipart_mod.__version__ = "0.0-test"
    multipart_sub = types.ModuleType("multipart.multipart")

    def _parse_options_header(value):
        return value, {}

    multipart_sub.parse_options_header = _parse_options_header
    sys.modules["multipart"] = multipart_mod
    sys.modules["multipart.multipart"] = multipart_sub

from app.api.routes import router as api_router
from app.core.dependency import check_current_user, get_rbac_service
from app.db.session import get_db


TEST_USER_ID = uuid.uuid4()
TEST_PARTICIPANT_ID = uuid.uuid4()


def _make_user(
    *,
    user_id: uuid.UUID = TEST_USER_ID,
    email: str = "user@test.com",
    researcher_onboarding: bool | None = None,
):
    user = MagicMock()
    user.user_id = user_id
    user.email = email
    user.first_name = "Test"
    user.last_name = "User"
    user.username = "test.user"
    user.phone = "1234567890"
    user.Address = "123 Test Lane"
    user.created_at = datetime(2026, 3, 30, 10, 0, tzinfo=timezone.utc)
    user.last_login_at = datetime(2026, 3, 30, 10, 5, tzinfo=timezone.utc)
    user.participant_profile = SimpleNamespace(participant_id=TEST_PARTICIPANT_ID)
    user.admin_profile = None
    user.caretaker_profile = None
    user.researcher_profile = (
        None
        if researcher_onboarding is None
        else SimpleNamespace(onboarding_completed=researcher_onboarding)
    )
    return user


async def _fake_current_user():
    return _make_user()


async def _fake_rbac():
    rbac = AsyncMock()
    rbac.user_has_permission = AsyncMock(return_value=True)
    return rbac


async def _fake_db():
    return AsyncMock()


test_app = FastAPI()
test_app.include_router(api_router, prefix="/api/v1")
test_app.dependency_overrides[check_current_user] = _fake_current_user
test_app.dependency_overrides[get_rbac_service] = _fake_rbac
test_app.dependency_overrides[get_db] = _fake_db
client = TestClient(test_app)


class TestParticipantUpdatesHealthGoals:
    def test_patch_goal_target_success(self):
        goal_id = uuid.uuid4()
        expected = {"goal_id": str(goal_id), "target_value": 55}

        with patch(
            "app.api.routes.participants_only.ParticipantQuery.update_goal",
            AsyncMock(return_value=expected),
        ) as mock_update:
            res = client.patch(
                f"/api/v1/participant/goals/{goal_id}",
                json={"target_value": 55},
            )

        assert res.status_code == 200
        assert res.json()["target_value"] == 55
        args = mock_update.await_args.args
        assert args[0] == goal_id
        assert args[1] == TEST_PARTICIPANT_ID

    def test_patch_goal_rejects_non_positive_target(self):
        goal_id = uuid.uuid4()
        res = client.patch(
            f"/api/v1/participant/goals/{goal_id}",
            json={"target_value": 0},
        )
        assert res.status_code == 422

    def test_patch_goal_rejects_invalid_window_value(self):
        goal_id = uuid.uuid4()
        res = client.patch(
            f"/api/v1/participant/goals/{goal_id}",
            json={"window": "yearly"},
        )
        assert res.status_code == 422

    def test_log_goal_progress_success_numeric(self):
        goal_id = uuid.uuid4()
        expected = {
            "goal_id": str(goal_id),
            "logged_at": "2026-03-30T12:00:00+00:00",
            "value": 2,
        }
        with patch(
            "app.api.routes.participants_only.ParticipantQuery.log_progress",
            AsyncMock(return_value=expected),
        ):
            res = client.post(
                f"/api/v1/participant/goals/{goal_id}/log",
                json={"value_number": 2, "notes": "after lunch"},
            )
        assert res.status_code == 200
        assert res.json()["goal_id"] == str(goal_id)

    def test_log_goal_progress_rejects_empty_payload(self):
        goal_id = uuid.uuid4()
        res = client.post(f"/api/v1/participant/goals/{goal_id}/log", json={})
        assert res.status_code == 422

    def test_log_goal_progress_not_found(self):
        goal_id = uuid.uuid4()
        with patch(
            "app.api.routes.participants_only.ParticipantQuery.log_progress",
            AsyncMock(side_effect=HTTPException(status_code=404, detail="Goal not found")),
        ):
            res = client.post(
                f"/api/v1/participant/goals/{goal_id}/log",
                json={"value_text": "entry"},
            )
        assert res.status_code == 404
        assert res.json()["detail"] == "Goal not found"


class TestAuditLoggingSecurityCriticalActions:
    def test_login_success_writes_audit(self):
        user = _make_user(email="login@test.com")
        with (
            patch(
                "app.api.routes.auth.authenticate_user",
                AsyncMock(return_value=user),
            ),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
            patch("app.api.routes.auth.create_access_token", return_value="token"),
            patch("app.api.routes.auth._set_cookie"),
        ):
            res = client.post(
                "/api/v1/auth/login",
                json={"identifier": "login@test.com", "password": "secret"},
            )
        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "LOGIN_SUCCESS"

    def test_login_failure_writes_audit(self):
        with (
            patch(
                "app.api.routes.auth.authenticate_user",
                AsyncMock(side_effect=HTTPException(status_code=401, detail="Incorrect email or password")),
            ),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
        ):
            res = client.post(
                "/api/v1/auth/login",
                json={"identifier": "wrong@test.com", "password": "bad"},
            )
        assert res.status_code == 401
        assert mock_audit.await_args.kwargs["action"] == "LOGIN_FAILED"
        assert mock_audit.await_args.kwargs["actor_user_id"] is None

    def test_logout_writes_audit(self):
        with patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit:
            res = client.post("/api/v1/auth/logout")
        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "LOGOUT"

    def test_forgot_password_writes_audit(self):
        with (
            patch("app.api.routes.auth.reset_forgot_password", AsyncMock(return_value={"message": "ok"})),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
        ):
            res = client.post("/api/v1/auth/forgot-password", json={"email": "reset@test.com"})
        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "PASSWORD_RESET_REQUESTED"

    def test_reset_password_writes_audit(self):
        with (
            patch("app.api.routes.auth.reset_password", AsyncMock(return_value=None)),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
        ):
            res = client.post(
                "/api/v1/auth/reset-password",
                json={"token": "abc123", "new_password": "NewPassword1!"},
            )
        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "PASSWORD_RESET_SUCCESS"


class TestAuthenticationApiEndpoints:
    def test_login_validation_fails_when_payload_missing_fields(self):
        res = client.post("/api/v1/auth/login", json={"identifier": "only-id"})
        assert res.status_code == 422

    def test_me_for_researcher_returns_onboarding_completed(self):
        async def fake_researcher_user():
            return _make_user(researcher_onboarding=True)

        test_app.dependency_overrides[check_current_user] = fake_researcher_user
        try:
            with patch(
                "app.api.routes.auth.UserQuery.get_user_roles",
                AsyncMock(return_value=["researcher"]),
            ):
                res = client.get("/api/v1/auth/me")
        finally:
            test_app.dependency_overrides[check_current_user] = _fake_current_user

        assert res.status_code == 200
        body = res.json()
        assert body["Role"] == ["researcher"]
        assert body["onboarding_completed"] is True
        assert body["onboarding_status"] is None

    def test_me_for_participant_returns_intake_and_status(self):
        with (
            patch("app.api.routes.auth.UserQuery.get_user_roles", AsyncMock(return_value=["participant"])),
            patch("app.services.onboarding_service.check_intake_completed", AsyncMock(return_value=True)),
            patch("app.services.onboarding_service.get_onboarding_status", AsyncMock(return_value="COMPLETED")),
        ):
            res = client.get("/api/v1/auth/me")

        assert res.status_code == 200
        body = res.json()
        assert body["Role"] == ["participant"]
        assert body["intake_completed"] is True
        assert body["onboarding_status"] == "COMPLETED"

    def test_validate_invite_invalid_token(self):
        with patch(
            "app.api.routes.auth.InviteQuery.get_invite_by_token_hash",
            AsyncMock(return_value=None),
        ):
            res = client.get("/api/v1/auth/validate-invite?token=bad")

        assert res.status_code == 400
        assert res.json()["detail"] == "Invalid invite token"
