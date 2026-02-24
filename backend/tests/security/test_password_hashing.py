"""
Unit Tests: PasswordHash (app/core/security.py)

What we are testing:
    The PasswordHash class is responsible for hashing user passwords before
    they are stored in the database, and for verifying a plain-text password
    against a stored hash at login time.
Run with (from tests):
    pytest security/test_password_hashing.py -v
"""

import pytest
from app.core.security import PasswordHash


STRONG_PASSWORD = "StrongPass123!"
ANOTHER_PASSWORD = "AnotherP@ss99"

# ---------------------------------------------------------------------------
# Hashing behaviour
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    """Tests that from_password() produces a valid bcrypt hash."""

    def test_hashed_value_is_not_plain_text(self):
        """The stored value must never equal the original password."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.to_str() != STRONG_PASSWORD

    def test_hash_starts_with_bcrypt_prefix(self):
        """bcrypt hashes always start with $2b$ or $2a$ — confirms the right algorithm."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.to_str().startswith("$2b$") or hashed.to_str().startswith("$2a$")

    def test_two_hashes_of_same_password_are_different(self):
        """
        bcrypt uses a random salt each time, so hashing the same password
        twice should never produce the same output. This is important —
        it means even if the DB is leaked, attackers cannot identify users
        with the same password by comparing hashes.
        """
        hash1 = PasswordHash.from_password(STRONG_PASSWORD)
        hash2 = PasswordHash.from_password(STRONG_PASSWORD)
        assert hash1.to_str() != hash2.to_str()

    def test_hash_is_a_string_when_serialised(self):
        """to_str() must return a plain string (for storing in the DB TEXT column)."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert isinstance(hashed.to_str(), str)


# ---------------------------------------------------------------------------
# Verification behaviour
# ---------------------------------------------------------------------------

class TestPasswordVerification:
    """Tests that verify() correctly accepts and rejects passwords."""

    def test_correct_password_verifies_successfully(self):
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.verify(STRONG_PASSWORD) is True

    def test_wrong_password_fails_verification(self):
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.verify("WrongPassword!") is False

    def test_empty_string_fails_verification(self):
        """An empty string must never verify against a real password hash."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.verify("") is False

    def test_similar_but_different_password_fails(self):
        """Passwords that are almost identical must not pass — case-sensitive check."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.verify("strongpass123!") is False  # lowercase version

    def test_different_password_fails_verification(self):
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        assert hashed.verify(ANOTHER_PASSWORD) is False


# ---------------------------------------------------------------------------
# Round-trip: store → restore → verify
# ---------------------------------------------------------------------------

class TestPasswordRoundTrip:
    """
    Simulates the real application flow:
      1. Hash on registration  →  save to_str() in DB
      2. Load from DB          →  restore with from_str()
      3. Login attempt         →  verify against plain-text input
    """

    def test_hash_can_be_restored_from_string_and_verified(self):
        """The full registration → login cycle must work end-to-end."""
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        stored_in_db = hashed.to_str()

        # Simulate loading from DB
        restored = PasswordHash.from_str(stored_in_db)
        assert restored.verify(STRONG_PASSWORD) is True

    def test_wrong_password_fails_after_restore(self):
        hashed = PasswordHash.from_password(STRONG_PASSWORD)
        restored = PasswordHash.from_str(hashed.to_str())
        assert restored.verify("NotTheRightOne!") is False