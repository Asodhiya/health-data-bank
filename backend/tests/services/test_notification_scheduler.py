from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import pytest

from app.services import notification_scheduler
from app.services.notification_scheduler import _as_utc


def test_as_utc_adds_utc_to_naive_datetimes():
    naive = datetime(2026, 4, 3, 12, 0, 0)

    normalized = _as_utc(naive)

    assert normalized == datetime(2026, 4, 3, 12, 0, 0, tzinfo=timezone.utc)


def test_as_utc_preserves_aware_datetimes_in_utc():
    aware = datetime(2026, 4, 3, 8, 0, 0, tzinfo=timezone(timedelta(hours=-4)))

    normalized = _as_utc(aware)

    assert normalized == datetime(2026, 4, 3, 12, 0, 0, tzinfo=timezone.utc)


def test_as_utc_leaves_none_untouched():
    assert _as_utc(None) is None


@pytest.mark.anyio
async def test_run_scheduled_backup_skips_when_recent_backup_exists(monkeypatch):
    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(
        side_effect=[
            {
                "enabled": True,
                "retention_count": 0,
                "notify_on_success": False,
                "notify_on_failure": False,
            },
            datetime.now(timezone.utc),
        ]
    )

    class _SessionCtx:
        async def __aenter__(self):
            return fake_db

        async def __aexit__(self, exc_type, exc, tb):
            return False

    mock_backup = AsyncMock()
    monkeypatch.setattr(notification_scheduler, "AsyncSessionLocal", lambda: _SessionCtx())
    monkeypatch.setattr(notification_scheduler, "backup_database", mock_backup)

    await notification_scheduler._run_scheduled_backup()

    mock_backup.assert_not_awaited()


@pytest.mark.anyio
async def test_run_scheduled_backup_creates_backup_when_missing(monkeypatch):
    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(
        side_effect=[
            {
                "enabled": True,
                "retention_count": 0,
                "notify_on_success": False,
                "notify_on_failure": False,
            },
            None,
        ]
    )

    class _SessionCtx:
        async def __aenter__(self):
            return fake_db

        async def __aexit__(self, exc_type, exc, tb):
            return False

    mock_backup = AsyncMock(return_value=("{}", "backup_2026-04-03_02-00-00"))
    monkeypatch.setattr(notification_scheduler, "AsyncSessionLocal", lambda: _SessionCtx())
    monkeypatch.setattr(notification_scheduler, "backup_database", mock_backup)

    await notification_scheduler._run_scheduled_backup()

    mock_backup.assert_awaited_once_with(created_by=None, db=fake_db, source="scheduled")


@pytest.mark.anyio
async def test_run_scheduled_backup_notifies_admins_on_success(monkeypatch):
    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(
        side_effect=[
            {
                "enabled": True,
                "retention_count": 5,
                "notify_on_success": True,
                "notify_on_failure": False,
            },
            None,
        ]
    )

    class _SessionCtx:
        async def __aenter__(self):
            return fake_db

        async def __aexit__(self, exc_type, exc, tb):
            return False

    mock_backup = AsyncMock(return_value=("{}", "backup_2026-04-03_02-00-00"))
    mock_notify = AsyncMock()
    mock_prune = AsyncMock(return_value=2)
    monkeypatch.setattr(notification_scheduler, "AsyncSessionLocal", lambda: _SessionCtx())
    monkeypatch.setattr(notification_scheduler, "backup_database", mock_backup)
    monkeypatch.setattr(notification_scheduler, "_notify_admins_of_scheduled_backup", mock_notify)
    monkeypatch.setattr(notification_scheduler, "prune_old_backups", mock_prune)

    await notification_scheduler._run_scheduled_backup()

    mock_prune.assert_awaited_once_with(5, fake_db)
    mock_notify.assert_awaited_once()


@pytest.mark.anyio
async def test_run_scheduled_backup_ignores_recent_manual_backup(monkeypatch):
    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(
        side_effect=[
            {
                "enabled": True,
                "retention_count": 0,
                "notify_on_success": False,
                "notify_on_failure": False,
            },
            None,
        ]
    )

    class _SessionCtx:
        async def __aenter__(self):
            return fake_db

        async def __aexit__(self, exc_type, exc, tb):
            return False

    mock_backup = AsyncMock(return_value=("{}", "backup_2026-04-03_02-00-00"))
    monkeypatch.setattr(notification_scheduler, "AsyncSessionLocal", lambda: _SessionCtx())
    monkeypatch.setattr(notification_scheduler, "backup_database", mock_backup)

    await notification_scheduler._run_scheduled_backup()

    mock_backup.assert_awaited_once_with(created_by=None, db=fake_db, source="scheduled")
