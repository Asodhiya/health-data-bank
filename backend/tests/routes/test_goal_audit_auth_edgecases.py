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
    def test_caretaker_participant_detail_returns_group_memberships(self):
        group_id = uuid.uuid4()
        joined_at = datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc)
        participant_row = (
            SimpleNamespace(participant_id=TEST_PARTICIPANT_ID),
            "Test",
            "User",
            joined_at,
        )
        memberships = [
            {
                "group_id": group_id,
                "name": "North Cohort",
                "description": "Primary care group",
                "joined_at": joined_at,
            }
        ]

        with (
            patch(
                "app.api.routes.Caretakers.CaretakersQuery.get_group_participant",
                AsyncMock(return_value=participant_row),
            ),
            patch(
                "app.api.routes.Caretakers.CaretakersQuery.get_participant_group_memberships",
                AsyncMock(return_value=memberships),
            ),
        ):
            res = client.get(
                f"/api/v1/caretaker/participants/{TEST_PARTICIPANT_ID}?group_id={group_id}"
            )

        assert res.status_code == 200
        body = res.json()
        assert body["participant_id"] == str(TEST_PARTICIPANT_ID)
        assert body["groups"][0]["group_id"] == str(group_id)
        assert body["groups"][0]["name"] == "North Cohort"

    def test_list_my_feedback_uses_authenticated_participant_id(self):
        feedback_id = uuid.uuid4()
        caretaker_id = uuid.uuid4()
        row = SimpleNamespace(
            feedback_id=feedback_id,
            caretaker_id=caretaker_id,
            participant_id=TEST_PARTICIPANT_ID,
            submission_id=None,
            message="Keep it up",
            created_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
        )

        with patch(
            "app.api.routes.participants_only.CaretakersQuery.list_feedback",
            AsyncMock(return_value=[row]),
        ) as mock_list:
            res = client.get("/api/v1/participant/feedback")

        assert res.status_code == 200
        assert res.json()[0]["participant_id"] == str(TEST_PARTICIPANT_ID)
        assert res.json()[0]["message"] == "Keep it up"
        assert mock_list.await_args.args[0] == TEST_PARTICIPANT_ID

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
        with (
            patch(
                "app.api.routes.participants_only.ParticipantQuery.log_progress",
                AsyncMock(return_value=expected),
            ),
            patch(
                "app.api.routes.participants_only.ParticipantQuery.get_goal_progress",
                AsyncMock(return_value={"completed": False, "entries": [expected]}),
            ),
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
        session = SimpleNamespace(session_id=uuid.uuid4())
        with (
            patch(
                "app.api.routes.auth.authenticate_user",
                AsyncMock(return_value=user),
            ),
            patch(
                "app.api.routes.auth.create_user_session",
                AsyncMock(return_value=session),
            ) as mock_session,
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
        assert mock_session.await_args.args[0] == user.user_id

    def test_login_failure_writes_audit(self):
        fake_db = AsyncMock()
        fake_db.scalar = AsyncMock(return_value=0)
        fake_db.execute = AsyncMock(return_value=MagicMock(all=lambda: []))

        async def fake_db_dep():
            return fake_db

        with (
            patch(
                "app.api.routes.auth.authenticate_user",
                AsyncMock(side_effect=HTTPException(status_code=401, detail="Incorrect email or password")),
            ),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
        ):
            test_app.dependency_overrides[get_db] = fake_db_dep
            try:
                res = client.post(
                    "/api/v1/auth/login",
                    json={"identifier": "wrong@test.com", "password": "bad"},
                )
            finally:
                test_app.dependency_overrides.pop(get_db, None)
        assert res.status_code == 401
        assert mock_audit.await_args.kwargs["action"] == "LOGIN_FAILED"
        assert mock_audit.await_args.kwargs["actor_user_id"] is None

    def test_locked_login_writes_account_lock_audit_and_admin_flag(self):
        locked_user = _make_user(email="locked@test.com")
        fake_db = AsyncMock()
        fake_db.scalar = AsyncMock(side_effect=[locked_user, 0])
        fake_db.execute = AsyncMock(return_value=MagicMock(all=lambda: [(uuid.uuid4(),)]))

        async def fake_db_dep():
            return fake_db

        with (
            patch(
                "app.api.routes.auth.authenticate_user",
                AsyncMock(side_effect=HTTPException(status_code=423, detail="locked")),
            ),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
            patch("app.api.routes.auth._notify_admins_about_locked_account", AsyncMock()) as mock_notify,
        ):
            test_app.dependency_overrides[get_db] = fake_db_dep
            try:
                res = client.post(
                    "/api/v1/auth/login",
                    json={"identifier": "locked@test.com", "password": "bad"},
                )
            finally:
                test_app.dependency_overrides[get_db] = _fake_db

        assert res.status_code == 423
        actions = [call.kwargs["action"] for call in mock_audit.await_args_list]
        assert "LOGIN_FAILED" in actions
        assert "ACCOUNT_LOCKED" in actions
        assert mock_notify.await_count == 1

    def test_logout_writes_audit(self):
        with patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit:
            res = client.post("/api/v1/auth/logout")
        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "LOGOUT"

    def test_self_deactivate_writes_audit_in_same_transaction(self):
        fake_db = AsyncMock()
        fake_db.execute = AsyncMock(return_value=MagicMock(all=lambda: []))

        async def fake_db_dep():
            return fake_db

        with (
            patch("app.api.routes.auth.UserQuery.get_user_roles", AsyncMock(return_value=["participant"])),
            patch("app.api.routes.auth.create_notifications_bulk", AsyncMock()),
            patch("app.api.routes.auth.write_audit_log", AsyncMock()) as mock_audit,
        ):
            test_app.dependency_overrides[get_db] = fake_db_dep
            try:
                res = client.post("/api/v1/auth/self-deactivate")
            finally:
                test_app.dependency_overrides[get_db] = _fake_db

        assert res.status_code == 200
        assert mock_audit.await_args.kwargs["action"] == "USER_SELF_DEACTIVATED"
        assert mock_audit.await_args.kwargs["commit"] is False
        fake_db.commit.assert_awaited_once()

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
    def test_submit_feedback_delegates_to_service(self):
        feedback_id = uuid.uuid4()
        returned = {
            "feedback_id": str(feedback_id),
            "user_id": str(TEST_USER_ID),
            "category": "issue",
            "subject": "Broken form",
            "message": "Submitting the form throws an error.",
            "page_path": "/participant/survey",
            "status": "new",
            "reviewed_at": None,
            "reviewed_by": None,
            "created_at": "2026-04-03T10:00:00+00:00",
        }

        with patch(
            "app.api.routes.feedback.submit_system_feedback",
            AsyncMock(return_value=returned),
        ) as mock_submit:
            res = client.post(
                "/api/v1/feedback",
                json={
                    "category": "issue",
                    "subject": "Broken form",
                    "message": "Submitting the form throws an error.",
                    "page_path": "/participant/survey",
                },
            )

        assert res.status_code == 201
        assert res.json()["feedback_id"] == str(feedback_id)
        assert mock_submit.await_args.args[1] == TEST_USER_ID

    def test_list_my_system_feedback_delegates_to_service(self):
        feedback_id = uuid.uuid4()
        returned = [
            {
                "feedback_id": str(feedback_id),
                "user_id": str(TEST_USER_ID),
                "category": "feature",
                "subject": "Need export",
                "message": "Please add export support.",
                "page_path": "/participant",
                "status": "new",
                "reviewed_at": None,
                "reviewed_by": None,
                "created_at": "2026-04-03T10:00:00+00:00",
            }
        ]

        with patch(
            "app.api.routes.feedback.list_my_feedback",
            AsyncMock(return_value=returned),
        ) as mock_list:
            res = client.get("/api/v1/feedback/me")

        assert res.status_code == 200
        assert res.json()[0]["feedback_id"] == str(feedback_id)
        assert mock_list.await_args.args[0] == TEST_USER_ID

    def test_admin_unlock_user_delegates_to_service(self):
        target_user_id = uuid.uuid4()
        returned = {"detail": "User account unlocked.", "email": "locked@test.com"}

        with patch(
            "app.api.routes.admin_only.unlock_user_access",
            AsyncMock(return_value=returned),
        ) as mock_unlock:
            res = client.post(f"/api/v1/admin_only/users/{target_user_id}/unlock")

        assert res.status_code == 200
        assert res.json() == returned
        assert mock_unlock.await_args.args[0] == target_user_id

    def test_register_delegates_to_auth_service(self):
        returned = {"detail": "registered"}

        with patch(
            "app.api.routes.auth.register_user_from_invite",
            AsyncMock(return_value=returned),
        ) as mock_register:
            res = client.post(
                "/api/v1/auth/register?token=test-token",
                json={
                    "first_name": "Pat",
                    "last_name": "User",
                    "username": "pat_user",
                    "email": "pat@example.com",
                    "password": "StrongPass1!",
                    "confirm_password": "StrongPass1!",
                    "phone": "+19025550147",
                    "address": "123 Main St",
                },
            )

        assert res.status_code == 200
        assert res.json() == returned
        assert mock_register.await_args.args[0] == "test-token"

    def test_validate_invite_delegates_to_auth_service(self):
        returned = {
            "email": "invite@example.com",
            "role": "participant",
            "expires_at": "2026-04-10T10:00:00+00:00",
        }

        with patch(
            "app.api.routes.auth.validate_signup_invite_token",
            AsyncMock(
                return_value={
                    "email": returned["email"],
                    "expires_at": returned["expires_at"],
                    "role": SimpleNamespace(role_name=returned["role"]),
                }
            ),
        ) as mock_validate:
            res = client.get("/api/v1/auth/validate-invite?token=good-token")

        assert res.status_code == 200
        assert res.json() == returned
        assert mock_validate.await_args.args[0] == "good-token"

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
            "app.api.routes.auth.validate_signup_invite_token",
            AsyncMock(side_effect=HTTPException(status_code=400, detail="Invalid invite token")),
        ):
            res = client.get("/api/v1/auth/validate-invite?token=bad")

        assert res.status_code == 400
        assert res.json()["detail"] == "Invalid invite token"
