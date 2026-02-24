"""
Unit Tests: JWT Token Functions (app/core/security.py)

What we are testing:
    create_access_token() — builds a signed JWT from a dict payload
    decode_access_token() — verifies and decodes a JWT back to a dict

Important:
    create_access_token() and decode_access_token() read JWT_SECRET,
    JWT_ALGORITHM, and ACCESS_TOKEN_EXPIRE_MINUTES directly from os.getenv().
    I used monkeypatch.setenv() to inject safe test values so these tests
    are fully self-contained.

Run with:
    pytest tests/security/test_jwt.py -v
"""

import pytest
import os
from unittest.mock import patch


# We patch env vars before importing the module so the module-level
# os.getenv() calls pick up our test values.
TEST_SECRET = "test-secret-key-for-unit-tests"
TEST_ALGORITHM = "HS256"
TEST_EXPIRE_MINUTES = "30"


@pytest.fixture(autouse=True)
def set_jwt_env_vars(monkeypatch):
    """Inject required env vars for every test in this file automatically."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("JWT_ALGORITHM", TEST_ALGORITHM)
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", TEST_EXPIRE_MINUTES)


# Import after the fixture concept is set up — the actual import happens when
# the test runs, so monkeypatch will be active in time.
from app.core.security import create_access_token, decode_access_token


# ---------------------------------------------------------------------------
# create_access_token
# ---------------------------------------------------------------------------

class TestCreateAccessToken:

    def test_returns_a_string(self):
        """A JWT is always a string — three base64 parts joined by dots."""
        token = create_access_token({"sub": "user-123"})
        assert isinstance(token, str)

    def test_token_has_three_parts(self):
        """Valid JWTs always have exactly three dot-separated segments."""
        token = create_access_token({"sub": "user-123"})
        parts = token.split(".")
        assert len(parts) == 3

    def test_payload_data_survives_encode_decode(self):
        """
        The data we put in must come back out after decoding.
        This is the core guarantee of JWTs.
        """
        token = create_access_token({"sub": "user-abc", "role": "admin"})
        decoded = decode_access_token(token)
        assert decoded["sub"] == "user-abc"
        assert decoded["role"] == "admin"

    def test_token_contains_exp_claim(self):
        """
        Tokens must contain an expiry claim (exp). Without this,
        tokens would be valid forever — a major security flaw.
        """
        token = create_access_token({"sub": "user-123"})
        decoded = decode_access_token(token)
        assert "exp" in decoded

    def test_token_contains_iat_claim(self):
        """iat = 'issued at'. Useful for audit logs and token rotation."""
        token = create_access_token({"sub": "user-123"})
        decoded = decode_access_token(token)
        assert "iat" in decoded

    def test_different_payloads_produce_different_tokens(self):
        token1 = create_access_token({"sub": "user-1"})
        token2 = create_access_token({"sub": "user-2"})
        assert token1 != token2


# ---------------------------------------------------------------------------
# decode_access_token
# ---------------------------------------------------------------------------

class TestDecodeAccessToken:

    def test_valid_token_decodes_successfully(self):
        token = create_access_token({"sub": "user-999"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-999"

    def test_tampered_token_returns_none(self):
        """
        If someone edits the token after it was signed, the signature
        check fails. decode_access_token must return None — not crash.
        """
        token = create_access_token({"sub": "user-123"})
        tampered = token[:-5] + "XXXXX"  # corrupt the signature
        result = decode_access_token(tampered)
        assert result is None

    def test_completely_invalid_string_returns_none(self):
        """Garbage input must not raise an exception — return None gracefully."""
        result = decode_access_token("this.is.not.a.jwt")
        assert result is None

    def test_empty_string_returns_none(self):
        result = decode_access_token("")
        assert result is None

    def test_token_signed_with_wrong_secret_returns_none(self):
        """
        A token signed with a different secret key (e.g. from another environment)
        must be rejected. This prevents tokens from staging being used in production.
        """
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        # Manually create a token with a DIFFERENT secret
        payload = {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30)
        }
        bad_token = jwt.encode(payload, "completely-wrong-secret", algorithm="HS256")
        result = decode_access_token(bad_token)
        assert result is None