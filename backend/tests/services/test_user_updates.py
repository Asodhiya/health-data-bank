"""
Unit Tests: User Update Service (app/services/user_update.py)

What we are testing:
    The update_user() function builds the correct dict of values to update
    and enforces password change rules (old password must be provided and
    correct, new password replaces the hash).

Run with:
    pytest tests/services/test_user_updates.py -v
    pytest tests/services/test_user_updates.py -v --html=tests/services/test_user_updates_report.html --self-contained-html 
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.schemas.schemas import UpdatePersonalInfoPayload
from app.core.security import PasswordHash


# ---------------------------------------------------------------------------
# Fake User object (mimics app/db/models.py User, no SQLAlchemy needed)
# ---------------------------------------------------------------------------

class FakeUser:
    """
    A minimal stand-in for the real User SQLAlchemy model.
    We only need the fields that update_user() actually reads.
    """
    def __init__(self, user_id="user-uuid-123", password="OldP@ss1"):
        self.user_id = user_id
        self.password_hash = PasswordHash.from_password(password).to_str()


# ---------------------------------------------------------------------------
# Fake DB session
# ---------------------------------------------------------------------------

def make_fake_db():
    """Returns an async mock that satisfies db.execute(), db.commit()."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def run_update(payload_data: dict, user: FakeUser = None):
    """Convenience wrapper to call update_user with a fake DB."""
    from app.services.user_update import update_user
    if user is None:
        user = FakeUser()
    db = make_fake_db()
    return await update_user(UpdatePersonalInfoPayload(**payload_data), user, db)


# ---------------------------------------------------------------------------
# Tests: empty / no-op payloads
# ---------------------------------------------------------------------------

class TestEmptyPayload:

    @pytest.mark.asyncio
    async def test_completely_empty_payload_raises_400(self):
        """
        Sending a payload with no fields at all must be rejected.
        There is nothing to update — the server should not waste a DB round-trip.
        """
        with pytest.raises(HTTPException) as exc:
            await run_update({})
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_payload_with_only_none_values_raises_400(self):
        """
        Pydantic will exclude None fields when exclude_unset=True is used,
        so a payload of all-None optional fields is effectively empty.
        """
        with pytest.raises(HTTPException) as exc:
            await run_update({"username": None, "first_name": None})
        assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Tests: normal field updates (username, name, email, etc.)
# ---------------------------------------------------------------------------

class TestNormalFieldUpdates:

    @pytest.mark.asyncio
    async def test_username_update_succeeds(self):
        result = await run_update({"username": "new_username"})
        assert result["detail"] == "User information updated successfully"

    @pytest.mark.asyncio
    async def test_first_name_update_succeeds(self):
        result = await run_update({"first_name": "NewFirstName"})
        assert result is not None

    @pytest.mark.asyncio
    async def test_email_update_succeeds(self):
        result = await run_update({"email": "newemail@example.com"})
        assert result is not None

    @pytest.mark.asyncio
    async def test_multiple_fields_update_succeeds(self):
        result = await run_update({
            "first_name": "Jane",
            "last_name": "Smith",
            "username": "janesmith",
        })
        assert result is not None


# ---------------------------------------------------------------------------
# Tests: password change rules
# ---------------------------------------------------------------------------

class TestPasswordChange:

    @pytest.mark.asyncio
    async def test_password_change_without_old_password_raises_400(self):
        """
        You must provide your current (old) password to change it.
        This prevents someone with a stolen session cookie from
        locking the real user out of their account.
        """
        with pytest.raises(HTTPException) as exc:
            await run_update({"new_password": "NewP@ssword1!"})
        assert exc.value.status_code == 400
        assert "old_password" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_password_change_with_wrong_old_password_raises_400(self):
        """
        If the old password doesn't match, reject the request.
        """
        user = FakeUser(password="OldP@ss1")
        with pytest.raises(HTTPException) as exc:
            await run_update(
                {"old_password": "WrongOldP@ss1!", "new_password": "NewP@ssword1!"},
                user=user
            )
        assert exc.value.status_code == 400
        assert "incorrect" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_password_change_with_correct_old_password_succeeds(self):
        """
        When the old password is correct, the update should go through.
        """
        user = FakeUser(password="OldP@ss1")
        result = await run_update(
            {"old_password": "OldP@ss1", "new_password": "BrandNewP@ss99!"},
            user=user
        )
        assert result is not None