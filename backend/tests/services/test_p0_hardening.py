import csv
import importlib
import importlib.util
import io
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
from zipfile import ZipFile

import pytest
from fastapi import HTTPException

from app.db.models import User
from app.schemas.schemas import UserSignup
from app.services import admin_service, filter_data_service


class _SessionContext:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.anyio
async def test_get_db_rolls_back_on_exception(monkeypatch):
    session_module = importlib.import_module("app.db.session")
    db = AsyncMock()

    monkeypatch.setattr(session_module, "AsyncSessionLocal", lambda: _SessionContext(db))

    gen = session_module.get_db()
    yielded = await gen.__anext__()
    assert yielded is db

    with pytest.raises(RuntimeError, match="boom"):
        await gen.athrow(RuntimeError("boom"))

    db.rollback.assert_awaited_once()
    db.commit.assert_not_awaited()


@pytest.mark.anyio
async def test_get_db_commits_on_success(monkeypatch):
    session_module = importlib.import_module("app.db.session")
    db = AsyncMock()

    monkeypatch.setattr(session_module, "AsyncSessionLocal", lambda: _SessionContext(db))

    gen = session_module.get_db()
    yielded = await gen.__anext__()
    assert yielded is db

    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()

    db.commit.assert_awaited_once()
    db.rollback.assert_not_awaited()


def test_user_signup_rejects_weak_password():
    with pytest.raises(ValueError, match="Password must be at least 8 characters long."):
        UserSignup(
            first_name="A",
            last_name="B",
            username="user_name",
            email="user@example.com",
            password="weak",
            confirm_password="weak",
            phone="1234567890",
            address="123 Main St",
        )


def test_user_signup_rejects_mismatched_confirm_password():
    with pytest.raises(ValueError, match="Passwords do not match"):
        UserSignup(
            first_name="A",
            last_name="B",
            username="user_name",
            email="user@example.com",
            password="StrongPass1!",
            confirm_password="StrongPass2!",
            phone="1234567890",
            address="123 Main St",
        )


def test_backup_serialization_omits_sensitive_auth_fields():
    user = User(
        first_name="Test",
        last_name="User",
        username="testuser",
        email="test@example.com",
        password_hash="super-secret-hash",
        phone="1234567890",
        Address="123 Main St",
        status=True,
        reset_token_hash="reset-token",
        failed_login_attempts=4,
    )

    data = admin_service._serialize_row(user, User)

    assert "password_hash" not in data
    assert "reset_token_hash" not in data
    assert "failed_login_attempts" not in data


@pytest.mark.anyio
async def test_restore_database_rejects_invalid_json():
    db = AsyncMock()

    with pytest.raises(HTTPException, match="valid JSON"):
        await admin_service.restore_database(b"not-json", db)


@pytest.mark.anyio
async def test_preview_restore_file_rejects_invalid_json():
    db = AsyncMock()

    with pytest.raises(HTTPException, match="valid JSON"):
        await admin_service.preview_restore_file(b"not-json", db)


@pytest.mark.anyio
async def test_preview_restore_file_returns_backup_summary():
    backup_id = uuid4()
    backup_record = SimpleNamespace(
        backup_id=backup_id,
        checksum="abc123",
        snapshot_content="{}",
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=backup_record)

    payload = {
        "snapshot_name": "backup_test",
        "created_at": "2026-04-03T12:00:00+00:00",
        "auth_fields_sanitized": True,
        "table_row_counts": {"users": 2, "groups": 1},
        "tables": {"users": [{}, {}], "groups": [{}]},
    }

    preview = await admin_service.preview_restore_file(json.dumps(payload).encode(), db)

    assert preview.snapshot_name == "backup_test"
    assert preview.table_count == 2
    assert preview.total_rows == 3
    assert preview.auth_fields_sanitized is True
    assert preview.matched_backup_id == backup_id


@pytest.mark.anyio
async def test_export_csv_excludes_identifier_columns(monkeypatch):
    async def fake_results(*args, **kwargs):
        return {
            "columns": [
                {"id": "participant_id", "text": "Participant ID"},
                {"id": "email", "text": "Email"},
                {"id": "gender", "text": "Gender"},
            ],
            "data": [
                {"participant_id": "abc", "email": "hidden@example.com", "gender": "Female"},
            ],
        }

    monkeypatch.setattr(filter_data_service, "get_survey_results_pivoted", fake_results)

    response = await filter_data_service.export_survey_results_csv(AsyncMock())
    body = b"".join([chunk async for chunk in response.body_iterator]).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(body)))

    assert rows[0] == ["Gender"]
    assert rows[1] == ["Female"]


@pytest.mark.anyio
async def test_export_excel_excludes_identifier_columns(monkeypatch):
    if importlib.util.find_spec("openpyxl") is None:
        with pytest.raises(HTTPException, match="openpyxl is not installed"):
            await filter_data_service.export_survey_results_excel(AsyncMock())
        return

    async def fake_results(*args, **kwargs):
        return {
            "columns": [
                {"id": "participant_id", "text": "Participant ID"},
                {"id": "email", "text": "Email"},
                {"id": "gender", "text": "Gender"},
            ],
            "data": [
                {"participant_id": "abc", "email": "hidden@example.com", "gender": "Female"},
            ],
        }

    monkeypatch.setattr(filter_data_service, "get_survey_results_pivoted", fake_results)

    response = await filter_data_service.export_survey_results_excel(AsyncMock())
    body = b"".join([chunk async for chunk in response.body_iterator])

    assert response.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    with ZipFile(io.BytesIO(body)) as workbook:
        shared_strings = workbook.read("xl/sharedStrings.xml").decode("utf-8")

    assert "Gender" in shared_strings
    assert "Female" in shared_strings
    assert "Participant ID" not in shared_strings
    assert "hidden@example.com" not in shared_strings
