from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services import admin_service
from app.services import audit_service
from app.schemas.admin_schema import BackupScheduleSettingsPayload


@pytest.mark.anyio
async def test_unlock_user_access_clears_lock_state(monkeypatch):
    user_id = uuid4()
    actor_id = uuid4()
    user = SimpleNamespace(
        user_id=user_id,
        email="locked@example.com",
        failed_login_attempts=9,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=user)

    mock_audit = AsyncMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)

    result = await admin_service.unlock_user_access(user_id, actor_id, db)

    assert result["detail"] == "User account unlocked."
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert mock_audit.await_args.kwargs["action"] == "USER_UNLOCKED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_update_user_status_writes_audit_in_same_transaction(monkeypatch):
    user_id = uuid4()
    actor_id = uuid4()
    user = SimpleNamespace(
        user_id=user_id,
        email="status@example.com",
        status=False,
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=user)

    mock_audit = AsyncMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)

    result = await admin_service.update_user_status(user_id, "active", actor_id, db)

    assert result is user
    assert user.status is True
    assert mock_audit.await_args.kwargs["action"] == "USER_STATUS_CHANGED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_reactivate_user_access_writes_audit_before_commit_and_sends_email(monkeypatch):
    user_id = uuid4()
    actor_id = uuid4()
    user = SimpleNamespace(
        user_id=user_id,
        email="deleted_user@deleted.local",
        status=False,
        reset_token_hash=None,
        reset_token_expires_at=None,
        failed_login_attempts=6,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=user)

    mock_audit = AsyncMock()
    mock_send_reset = MagicMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)
    monkeypatch.setattr(admin_service, "send_reset_email", mock_send_reset)
    monkeypatch.setattr(admin_service, "generate_reset_token", lambda: "plain-token")
    monkeypatch.setattr(admin_service, "hash_reset_token", lambda token: f"hashed:{token}")
    monkeypatch.setattr(admin_service, "reset_token_expiry", lambda minutes: datetime.now(timezone.utc) + timedelta(minutes=minutes))

    payload = SimpleNamespace(email="reactivated@example.com")
    result = await admin_service.reactivate_user_access(user_id, payload, actor_id, db)

    assert result["email"] == "reactivated@example.com"
    assert user.email == "reactivated@example.com"
    assert user.status is True
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.reset_token_hash == "hashed:plain-token"
    assert mock_audit.await_args.kwargs["action"] == "USER_REACTIVATED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()
    mock_send_reset.assert_called_once()


@pytest.mark.anyio
async def test_delete_user_anonymize_writes_audit_in_same_transaction(monkeypatch):
    user_id = uuid4()
    actor_id = uuid4()
    user = SimpleNamespace(
        user_id=user_id,
        email="inactive@example.com",
        first_name="Old",
        last_name="Name",
        phone="1234567890",
        Address="123 Main",
        status=False,
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=user)

    mock_audit = AsyncMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)

    result = await admin_service.delete_user(user_id, "anonymize", actor_id, db)

    assert result["detail"] == "User anonymized successfully"
    assert user.first_name == "Deleted"
    assert user.email.startswith("deleted_")
    assert user.phone is None
    assert mock_audit.await_args.kwargs["action"] == "USER_ANONYMIZED"
    assert mock_audit.await_args.kwargs["commit"] is False
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_user_permanent_cleans_dependencies_before_deleting_user(monkeypatch):
    user_id = uuid4()
    actor_id = uuid4()
    user = SimpleNamespace(
        user_id=user_id,
        email="inactive@example.com",
        username="inactive_user",
        status=False,
        first_name="Inactive",
        last_name="User",
        password_hash="hash",
        phone="1112223333",
        Address="123 Main",
        last_login_at=datetime.now(timezone.utc),
        reset_token_hash="reset",
        reset_token_expires_at=datetime.now(timezone.utc),
        failed_login_attempts=4,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    participant_profile = SimpleNamespace(
        user_id=user_id,
        dob=date(2000, 1, 1),
        gender="Male",
        pronouns="He/Him",
        primary_language="English",
        occupation_status="Student",
        living_arrangement="With Family",
        highest_education_level="College",
        dependents=1,
        marital_status="Single",
        country_of_origin="Canada",
        address="123 Main",
    )
    caretaker_profile = SimpleNamespace(
        user_id=user_id,
        title="Dr.",
        organization="Org",
        credentials="RN",
        department="Dept",
        specialty="Care",
        bio="Bio",
        working_hours_start="09:00",
        working_hours_end="17:00",
        contact_preference="email",
        available_days=["Mon"],
    )
    db = AsyncMock()
    db.delete = AsyncMock()
    db.scalar = AsyncMock(
        side_effect=[
            user,          # load user
            0,             # owned forms
            participant_profile,
            caretaker_profile,
            None,          # researcher profile
            None,          # admin profile
        ]
    )

    mock_audit = AsyncMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)
    monkeypatch.setattr(admin_service, "_deactivate_participant_group_memberships", AsyncMock(return_value=1))
    monkeypatch.setattr(admin_service, "_unassign_groups_for_caretaker_user", AsyncMock(return_value=1))

    result = await admin_service.delete_user(user_id, "permanent", actor_id, db)

    assert result["detail"] == "User account deleted and retained data anonymized successfully"
    db.delete.assert_not_called()
    assert db.execute.await_count > 5
    assert mock_audit.await_args.kwargs["action"] == "USER_DELETED"
    assert user.first_name == "Deleted"
    assert user.phone is None
    assert user.status is False
    assert participant_profile.dob is None
    assert participant_profile.gender is None
    assert caretaker_profile.title is None
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_update_backup_schedule_settings_refreshes_scheduler(monkeypatch):
    actor_id = uuid4()
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=None)
    db.add = MagicMock()

    mock_audit = AsyncMock()
    mock_refresh = AsyncMock()
    monkeypatch.setattr(audit_service, "write_audit_log", mock_audit)
    monkeypatch.setattr(
        "app.services.notification_scheduler.refresh_backup_schedule_job",
        mock_refresh,
    )

    payload = BackupScheduleSettingsPayload(
        enabled=True,
        frequency="weekly",
        time="03:00",
        day_of_week="sunday",
        day_of_month=None,
        timezone="UTC",
        scope="full",
        retention_count=5,
        notify_on_success=True,
        notify_on_failure=True,
    )

    result = await admin_service.update_backup_schedule_settings(payload, actor_id, db)

    assert result.enabled is True
    assert result.frequency == "weekly"
    assert result.time == "03:00"
    assert result.day_of_week == "sunday"
    assert result.next_run_at is not None
    assert mock_audit.await_args.kwargs["action"] == "BACKUP_SCHEDULE_UPDATED"
    db.commit.assert_awaited_once()
    mock_refresh.assert_awaited_once()


@pytest.mark.anyio
async def test_restore_backup_by_id_rejects_legacy_backup_without_snapshot_content():
    backup_id = uuid4()
    db = AsyncMock()
    db.scalar = AsyncMock(
        return_value=SimpleNamespace(
            backup_id=backup_id,
            storage_path="backup_legacy",
            snapshot_content=None,
        )
    )

    with pytest.raises(HTTPException, match="predates one-click restore support"):
        await admin_service.restore_backup_by_id(backup_id, db)


@pytest.mark.anyio
async def test_restore_backup_by_id_uses_stored_snapshot_content(monkeypatch):
    backup_id = uuid4()
    snapshot_content = '{"snapshot_name":"backup_test","tables":{}}'
    db = AsyncMock()
    db.scalar = AsyncMock(
        return_value=SimpleNamespace(
            backup_id=backup_id,
            storage_path="backup_test",
            snapshot_content=snapshot_content,
        )
    )

    mock_restore = AsyncMock(
        return_value=SimpleNamespace(
            restored_from="backup_test",
            tables_restored=1,
            message="ok",
        )
    )
    monkeypatch.setattr(admin_service, "_restore_backup_payload", mock_restore)

    result = await admin_service.restore_backup_by_id(backup_id, db, restored_by=uuid4())

    assert result.message == "ok"
    mock_restore.assert_awaited_once()
