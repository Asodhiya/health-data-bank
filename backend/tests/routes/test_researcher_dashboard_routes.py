"""
Route-level tests for the researcher dashboard:

  1. Researcher dashboard loads without blanks or failed API calls
 12. Researcher notifications load and mark-as-read works
     (+ documents the missing audit log emission for mark-as-read)

These tests follow the dynamic-import pattern used by
tests/routes/test_caretaker_routes.py and test_profile_settings_routes.py:
load the route module, mock the service-layer dependencies, and call the
route function directly with an AsyncMock db. No real DB or HTTP server.

Run with:
    pytest tests/routes/test_researcher_dashboard_routes.py -v
"""

from __future__ import annotations

import sys
import types
from datetime import datetime, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException


# ───────────────────────────────────────────────────────────────────────────
# Bootstrap — fake multipart shim + dynamic route import
# (matches the pattern in tests/routes/test_caretaker_routes.py)
# ───────────────────────────────────────────────────────────────────────────

def _install_fake_multipart() -> None:
    multipart_module = types.ModuleType("multipart")
    multipart_module.__version__ = "0.0-test"
    multipart_submodule = types.ModuleType("multipart.multipart")
    multipart_submodule.parse_options_header = lambda value: ("form-data", {})
    sys.modules.setdefault("multipart", multipart_module)
    sys.modules.setdefault("multipart.multipart", multipart_submodule)


def _load_route_module(filename: str, module_name: str):
    path = Path(__file__).resolve().parents[2] / "app" / "api" / "routes" / filename
    spec = spec_from_file_location(module_name, path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


_install_fake_multipart()
researcher_routes = _load_route_module("researcher.py", "test_researcher_routes_module")
researcher_query_routes = _load_route_module(
    "researcher_query_data.py", "test_researcher_query_routes_module"
)


USER_ID = uuid4()


def _make_user():
    return SimpleNamespace(user_id=USER_ID, email="researcher@test.com")


# ═══════════════════════════════════════════════════════════════════════════
# 1. Researcher dashboard loads without blanks or failed API calls
# ═══════════════════════════════════════════════════════════════════════════

class TestDashboardInitialLoad:
    """
    The dashboard fires three calls on first load:
        GET  /researcher/available-surveys
        GET  /researcher/config
        POST /researcher/results   (with default filters)

    A "blank dashboard" usually means one of these silently failed or
    returned an empty/None payload. These tests pin the contract for all
    three so a regression is loud.
    """

    @pytest.mark.anyio
    async def test_available_surveys_returns_list_not_none(self):
        """The picker endpoint must always return a list (possibly empty)."""
        db = AsyncMock()

        with patch.object(
            researcher_query_routes,
            "get_available_surveys",
            AsyncMock(return_value=[]),
        ):
            result = await researcher_query_routes.list_available_surveys(
                db=db, current_user=_make_user(),
            )

        assert result == []
        assert isinstance(result, list)

    @pytest.mark.anyio
    async def test_config_endpoint_returns_min_cohort_settings(self):
        """The /researcher/config endpoint feeds the dashboard's pseudonymisation rules."""
        result = await researcher_query_routes.get_query_config()

        assert "min_cohort_size" in result
        assert "min_cohort_size_raw" in result
        assert isinstance(result["min_cohort_size"], int)
        assert isinstance(result["min_cohort_size_raw"], int)

    @pytest.mark.anyio
    async def test_results_endpoint_returns_columns_and_data_keys(self):
        """
        The /results endpoint must always return a dict shaped
        {columns: [...], data: [...], pagination: {...}} — even on a
        zero-result query. A None or missing key would render as a blank
        dashboard on the frontend.
        """
        from app.schemas.filter_data_schema import ParticipantFilter

        fake_result = {
            "columns": [
                {"id": "gender", "text": "Gender"},
                {"id": "age", "text": "Age"},
            ],
            "data": [],
            "pagination": {
                "offset": 0,
                "limit": 10,
                "returned_participants": 0,
                "total_participants": 0,
                "has_more": False,
                "next_offset": 0,
            },
        }

        db = AsyncMock()

        with patch.object(
            researcher_query_routes,
            "get_survey_results_pivoted",
            AsyncMock(return_value=fake_result),
        ):
            result = await researcher_query_routes.get_survey_results(
                filters=ParticipantFilter(),
                db=db,
                current_user=_make_user(),
            )

        assert "columns" in result
        assert "data" in result
        assert isinstance(result["columns"], list)
        assert isinstance(result["data"], list)
        # Even on empty data, the columns list must be non-empty so the
        # table can render its header row.
        assert len(result["columns"]) > 0

    @pytest.mark.anyio
    async def test_results_endpoint_propagates_service_errors(self):
        """
        If the service raises, the route must surface the error rather than
        swallow it and return blank rows. Catches the "blank dashboard with
        no error toast" failure mode.
        """
        from app.schemas.filter_data_schema import ParticipantFilter

        db = AsyncMock()

        with patch.object(
            researcher_query_routes,
            "get_survey_results_pivoted",
            AsyncMock(side_effect=ValueError("schema mismatch")),
        ):
            with pytest.raises(ValueError, match="schema mismatch"):
                await researcher_query_routes.get_survey_results(
                    filters=ParticipantFilter(),
                    db=db,
                    current_user=_make_user(),
                )


# ═══════════════════════════════════════════════════════════════════════════
# 12. Researcher notifications load and mark-as-read works
# ═══════════════════════════════════════════════════════════════════════════

class TestResearcherNotifications:
    """
    Two routes:
        GET    /researcher/notifications              -> list_notifications
        PATCH  /researcher/notifications/{id}         -> mark_notification_read

    The list endpoint must scope to role_target='researcher' (so admin or
    caretaker notifications never leak in). The PATCH endpoint must flip
    the status to 'read' and return is_read=True in the response.
    """

    @pytest.mark.anyio
    async def test_list_notifications_scopes_to_researcher_role(self):
        notif_id = uuid4()
        rows = [
            SimpleNamespace(
                notification_id=notif_id,
                type="form_published",
                title="New form published",
                message="A caretaker just published a new survey.",
                link="/researcher",
                role_target="researcher",
                created_at=datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc),
                status="unread",
            ),
        ]
        captured = {}

        async def fake_list(db, user_id, role_target=None):
            captured["user_id"] = user_id
            captured["role_target"] = role_target
            return rows

        with patch.object(
            researcher_routes, "list_notifications_for_user", fake_list,
        ):
            result = await researcher_routes.list_notifications(
                db=AsyncMock(), current_user=_make_user(),
            )

        # Critical: the route must call the service with role_target='researcher'.
        # If a refactor drops this scoping arg, this test catches it.
        assert captured["role_target"] == "researcher"
        assert captured["user_id"] == USER_ID

        assert len(result) == 1
        assert result[0].notification_id == notif_id
        assert result[0].is_read is False
        assert result[0].title == "New form published"

    @pytest.mark.anyio
    async def test_list_notifications_returns_empty_list_not_none(self):
        """Frontend NotificationsPanel calls .map() — None would crash it."""
        with patch.object(
            researcher_routes,
            "list_notifications_for_user",
            AsyncMock(return_value=[]),
        ):
            result = await researcher_routes.list_notifications(
                db=AsyncMock(), current_user=_make_user(),
            )

        assert result == []

    @pytest.mark.anyio
    async def test_mark_notification_read_flips_status_and_returns_is_read_true(self):
        notif_id = uuid4()
        flipped = SimpleNamespace(
            notification_id=notif_id,
            type="form_published",
            title="New form published",
            message="msg",
            link="/researcher",
            role_target="researcher",
            created_at=datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc),
            status="read",  # service has already updated this
        )

        with patch.object(
            researcher_routes,
            "mark_notification_read_for_user",
            AsyncMock(return_value=flipped),
        ):
            result = await researcher_routes.mark_notification_read(
                notification_id=notif_id,
                db=AsyncMock(),
                current_user=_make_user(),
            )

        assert result.notification_id == notif_id
        assert result.is_read is True

    @pytest.mark.anyio
    async def test_mark_notification_read_propagates_404_when_missing(self):
        """
        If the service raises 404 (notification not found, or not owned by
        this researcher), the route must propagate it rather than return a
        success response with stale data.
        """
        with patch.object(
            researcher_routes,
            "mark_notification_read_for_user",
            AsyncMock(side_effect=HTTPException(status_code=404, detail="Notification not found")),
        ):
            with pytest.raises(HTTPException) as exc:
                await researcher_routes.mark_notification_read(
                    notification_id=uuid4(),
                    db=AsyncMock(),
                    current_user=_make_user(),
                )

        assert exc.value.status_code == 404

    # ─────────────────────────────────────────────────────────────────────
    # AUDIT LOG (currently NOT emitted on mark-as-read)
    # ─────────────────────────────────────────────────────────────────────
    #
    # The current notification mark-as-read flow does NOT call write_audit_log.
    # This test documents that gap and is structured so it can be flipped
    # from xfail to a real assertion as soon as the team adds emission.
    #
    # When the audit log call is added, do two things:
    #   1. Remove the @pytest.mark.xfail decorator below.
    #   2. Implement the emission in mark_notification_read_for_user (or in
    #      the route handler) and re-run.
    #
    @pytest.mark.xfail(
        reason=(
            "mark_notification_read_for_user does not currently emit an "
            "audit_log entry. Remove this xfail when NOTIFICATION_READ "
            "audit emission is added (see audit_service.write_audit_log)."
        ),
        strict=False,
    )
    @pytest.mark.anyio
    async def test_mark_notification_read_writes_audit_log(self, monkeypatch):
        from app.services import audit_service

        notif_id = uuid4()
        flipped = SimpleNamespace(
            notification_id=notif_id,
            type="form_published",
            title="t",
            message="m",
            link="/researcher",
            role_target="researcher",
            created_at=datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc),
            status="read",
        )

        mock_audit = AsyncMock()
        monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)

        with patch.object(
            researcher_routes,
            "mark_notification_read_for_user",
            AsyncMock(return_value=flipped),
        ):
            await researcher_routes.mark_notification_read(
                notification_id=notif_id,
                db=AsyncMock(),
                current_user=_make_user(),
            )

        mock_audit.assert_awaited_once()
        assert mock_audit.await_args.kwargs.get("action") == "NOTIFICATION_READ"
