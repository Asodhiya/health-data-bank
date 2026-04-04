from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.schemas import SystemFeedbackCreate, SystemFeedbackStatusUpdate
from app.services import feedback_service


@pytest.mark.anyio
async def test_submit_system_feedback_creates_admin_notifications_and_audit(monkeypatch):
    user_id = uuid4()
    feedback_id = uuid4()
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: [(uuid4(),), (uuid4(),)]))
    db.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "feedback_id", feedback_id))

    mock_notify = AsyncMock()
    mock_audit = AsyncMock()
    monkeypatch.setattr(feedback_service, "create_notifications_bulk", mock_notify)
    monkeypatch.setattr(feedback_service, "write_audit_log", mock_audit)

    payload = SystemFeedbackCreate(
        category="issue",
        subject="Login issue",
        message="The login screen freezes after submitting.",
        page_path="/login",
    )
    feedback = await feedback_service.submit_system_feedback(payload, user_id, db)

    assert feedback.user_id == user_id
    assert feedback.category == "issue"
    assert mock_notify.await_count == 1
    assert mock_notify.await_args.kwargs["title"] == "New issue reported"
    assert mock_audit.await_args.kwargs["action"] == "SYSTEM_ISSUE_REPORTED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_list_my_feedback_orders_newest_first():
    user_id = uuid4()
    newer = SimpleNamespace(created_at=datetime.now(timezone.utc))
    older = SimpleNamespace(created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    scalars = SimpleNamespace(all=lambda: [newer, older])
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(scalars=lambda: scalars))

    rows = await feedback_service.list_my_feedback(user_id, db)

    assert rows == [newer, older]


@pytest.mark.anyio
async def test_update_system_feedback_status_marks_review_metadata(monkeypatch):
    actor_id = uuid4()
    feedback = SimpleNamespace(
        feedback_id=uuid4(),
        category="bug",
        status="new",
        reviewed_at=None,
        reviewed_by=None,
    )
    db = AsyncMock()
    db.add = MagicMock()
    db.scalar = AsyncMock(return_value=feedback)

    mock_audit = AsyncMock()
    monkeypatch.setattr(feedback_service, "write_audit_log", mock_audit)

    result = await feedback_service.update_system_feedback_status(
        feedback.feedback_id,
        SystemFeedbackStatusUpdate(status="in_progress"),
        actor_id,
        db,
    )

    assert result is feedback
    assert feedback.status == "in_progress"
    assert feedback.reviewed_by == actor_id
    assert feedback.reviewed_at is not None
    assert mock_audit.await_args.kwargs["action"] == "SYSTEM_FEEDBACK_STATUS_UPDATED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_update_system_feedback_status_404_when_missing():
    db = AsyncMock()
    db.add = MagicMock()
    db.scalar = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await feedback_service.update_system_feedback_status(
            uuid4(),
            SystemFeedbackStatusUpdate(status="in_review"),
            uuid4(),
            db,
        )

    assert exc.value.status_code == 404


def test_issue_submission_requires_subject():
    with pytest.raises(ValueError, match="Subject is required when reporting an issue."):
        SystemFeedbackCreate(
            category="bug",
            message="The form crashes after I click submit.",
        )
