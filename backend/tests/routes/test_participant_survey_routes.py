"""
Route Tests: Participant Survey (app/api/routes/participant_survey.py)

What we are testing:
    GET  /participant/surveys/assigned          — list assigned surveys
    GET  /participant/surveys/{form_id}         — get survey detail
    GET  /participant/surveys/{form_id}/response — get existing submission
    POST /participant/surveys/{form_id}/submit  — submit survey answers
    POST /participant/surveys/{form_id}/save    — save draft answers

Auth and RBAC are bypassed via FastAPI dependency overrides.
Service functions are mocked with unittest.mock.patch so no real DB is needed.

Run with:
    pytest tests/routes/test_participant_survey_routes.py -v
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.dependency import check_current_user, get_rbac_service
from app.db.session import get_db


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

USER_ID = uuid.uuid4()
FORM_ID = uuid.uuid4()
SUBMISSION_ID = uuid.uuid4()
FIELD_ID = uuid.uuid4()

BASE_URL = "/api/v1/participant/surveys"


# ---------------------------------------------------------------------------
# Dependency overrides — bypass auth and RBAC for all tests
# ---------------------------------------------------------------------------

def make_fake_user():
    user = MagicMock()
    user.user_id = USER_ID
    user.email = "participant@test.com"
    return user


async def fake_current_user():
    return make_fake_user()


async def fake_rbac():
    rbac = AsyncMock()
    rbac.user_has_permission = AsyncMock(return_value=True)
    return rbac


async def fake_db():
    return AsyncMock()


app.dependency_overrides[check_current_user] = fake_current_user
app.dependency_overrides[get_rbac_service] = fake_rbac
app.dependency_overrides[get_db] = fake_db


client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /assigned — list surveys assigned to the participant
# ---------------------------------------------------------------------------

class TestListAssignedSurveys:

    def test_returns_list_of_surveys(self):
        """Assigned surveys are returned as a list."""
        surveys = [
            {
                "form_id": str(uuid.uuid4()),
                "title": "Blood Pressure Survey",
                "description": "Monthly check",
                "status": "NEW",
                "due_date": None,
                "deployed_at": None,
                "submitted_at": None,
                "question_count": 3,
                "answered_count": 0,
            }
        ]
        with patch(
            "app.api.routes.participant_survey.list_assigned_surveys",
            AsyncMock(return_value=surveys),
        ):
            response = client.get(f"{BASE_URL}/assigned")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Blood Pressure Survey"
        assert data[0]["status"] == "NEW"

    def test_returns_empty_list_when_no_surveys_assigned(self):
        with patch(
            "app.api.routes.participant_survey.list_assigned_surveys",
            AsyncMock(return_value=[]),
        ):
            response = client.get(f"{BASE_URL}/assigned")

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_multiple_surveys_with_different_statuses(self):
        surveys = [
            {"form_id": str(uuid.uuid4()), "title": "Form A", "description": None,
             "status": "NEW", "due_date": None, "deployed_at": None,
             "submitted_at": None, "question_count": 2, "answered_count": 0},
            {"form_id": str(uuid.uuid4()), "title": "Form B", "description": None,
             "status": "IN_PROGRESS", "due_date": None, "deployed_at": None,
             "submitted_at": None, "question_count": 5, "answered_count": 3},
            {"form_id": str(uuid.uuid4()), "title": "Form C", "description": None,
             "status": "COMPLETED", "due_date": None, "deployed_at": None,
             "submitted_at": "2026-03-01T10:00:00", "question_count": 4, "answered_count": 4},
        ]
        with patch(
            "app.api.routes.participant_survey.list_assigned_surveys",
            AsyncMock(return_value=surveys),
        ):
            response = client.get(f"{BASE_URL}/assigned")

        assert response.status_code == 200
        statuses = [s["status"] for s in response.json()]
        assert "NEW" in statuses
        assert "IN_PROGRESS" in statuses
        assert "COMPLETED" in statuses


# ---------------------------------------------------------------------------
# GET /{form_id} — get survey detail
# ---------------------------------------------------------------------------

class TestGetSurveyDetail:

    def test_returns_survey_detail(self):
        """A valid form_id returns the survey with its fields."""
        mock_form = MagicMock()
        mock_form.form_id = FORM_ID
        mock_form.title = "Weekly Check-In"
        mock_form.description = "How are you this week?"
        mock_form.version = 1
        mock_form.status = "PUBLISHED"
        mock_form.created_at = None
        mock_form.fields = []

        with patch(
            "app.api.routes.participant_survey.get_participant_survey_detail",
            AsyncMock(return_value=mock_form),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}")

        assert response.status_code == 200
        assert response.json()["title"] == "Weekly Check-In"

    def test_returns_404_when_survey_not_found_or_not_assigned(self):
        """If the form doesn't exist or isn't assigned to the participant, 404 is returned."""
        with patch(
            "app.api.routes.participant_survey.get_participant_survey_detail",
            AsyncMock(return_value=None),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# GET /{form_id}/response — get existing submission
# ---------------------------------------------------------------------------

class TestGetSurveyResponse:

    def test_returns_submission_when_exists(self):
        """An existing draft or completed submission is returned."""
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID
        mock_submission.submitted_at = None
        mock_submission.answers = []

        with patch(
            "app.api.routes.participant_survey.get_participant_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}/response")

        assert response.status_code == 200
        data = response.json()
        assert str(data["submission_id"]) == str(SUBMISSION_ID)
        assert data["status"] == "DRAFT"

    def test_returns_completed_status_when_submitted_at_is_set(self):
        from datetime import datetime
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID
        mock_submission.submitted_at = datetime(2026, 3, 20, 10, 0, 0)
        mock_submission.answers = []

        with patch(
            "app.api.routes.participant_survey.get_participant_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}/response")

        assert response.status_code == 200
        assert response.json()["status"] == "COMPLETED"

    def test_returns_null_when_no_submission_exists(self):
        """No prior submission returns null (not a 404)."""
        with patch(
            "app.api.routes.participant_survey.get_participant_survey_response",
            AsyncMock(return_value=None),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}/response")

        assert response.status_code == 200
        assert response.json() is None

    def test_includes_answers_in_response(self):
        """Existing answers are included with field_id and value."""
        mock_answer = MagicMock()
        mock_answer.field_id = FIELD_ID
        mock_answer.value_text = "Feeling good"
        mock_answer.value_number = None
        mock_answer.value_json = None
        mock_answer.value_date = None

        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID
        mock_submission.submitted_at = None
        mock_submission.answers = [mock_answer]

        with patch(
            "app.api.routes.participant_survey.get_participant_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.get(f"{BASE_URL}/{FORM_ID}/response")

        assert response.status_code == 200
        answers = response.json()["answers"]
        assert len(answers) == 1
        assert answers[0]["value"] == "Feeling good"


# ---------------------------------------------------------------------------
# POST /{form_id}/submit — submit survey answers
# ---------------------------------------------------------------------------

class TestSubmitSurveyResponse:

    def test_successful_submission_returns_200(self):
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID

        with patch(
            "app.api.routes.participant_survey.submit_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/submit",
                json=[{"field_id": str(FIELD_ID), "value": "Good"}],
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Survey submitted successfully"
        assert str(data["submission_id"]) == str(SUBMISSION_ID)

    def test_returns_400_on_value_error(self):
        """ValueError from the service (e.g. already submitted) returns 400."""
        with patch(
            "app.api.routes.participant_survey.submit_survey_response",
            AsyncMock(side_effect=ValueError("Cannot modify a completed submission")),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/submit",
                json=[{"field_id": str(FIELD_ID), "value": "Good"}],
            )

        assert response.status_code == 400
        assert "completed" in response.json()["detail"].lower()

    def test_returns_500_on_unexpected_error(self):
        """Unexpected exceptions return 500."""
        with patch(
            "app.api.routes.participant_survey.submit_survey_response",
            AsyncMock(side_effect=Exception("DB connection lost")),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/submit",
                json=[{"field_id": str(FIELD_ID), "value": "Good"}],
            )

        assert response.status_code == 500

    def test_submit_with_empty_answers_list(self):
        """Submitting with no answers is technically valid — service decides."""
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID

        with patch(
            "app.api.routes.participant_survey.submit_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.post(f"{BASE_URL}/{FORM_ID}/submit", json=[])

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /{form_id}/save — save draft
# ---------------------------------------------------------------------------

class TestSaveSurveyDraft:

    def test_successful_save_returns_200(self):
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID

        with patch(
            "app.api.routes.participant_survey.save_survey_response",
            AsyncMock(return_value=mock_submission),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/save",
                json=[{"field_id": str(FIELD_ID), "value": "Draft answer"}],
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Draft saved successfully"
        assert str(data["submission_id"]) == str(SUBMISSION_ID)

    def test_returns_400_on_value_error(self):
        """ValueError (e.g. form not assigned) returns 400."""
        with patch(
            "app.api.routes.participant_survey.save_survey_response",
            AsyncMock(side_effect=ValueError("Form not assigned to participant")),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/save",
                json=[{"field_id": str(FIELD_ID), "value": "Draft answer"}],
            )

        assert response.status_code == 400
        assert "not assigned" in response.json()["detail"].lower()

    def test_returns_500_on_unexpected_error(self):
        with patch(
            "app.api.routes.participant_survey.save_survey_response",
            AsyncMock(side_effect=Exception("Unexpected error")),
        ):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/save",
                json=[{"field_id": str(FIELD_ID), "value": "Draft answer"}],
            )

        assert response.status_code == 500

    def test_save_multiple_answers(self):
        """Multiple answers are passed through to the service."""
        mock_submission = MagicMock()
        mock_submission.submission_id = SUBMISSION_ID

        captured = {}
        async def capture_save(form_id, user_id, answers, db):
            captured["answers"] = answers
            return mock_submission

        with patch("app.api.routes.participant_survey.save_survey_response", capture_save):
            response = client.post(
                f"{BASE_URL}/{FORM_ID}/save",
                json=[
                    {"field_id": str(uuid.uuid4()), "value": "Answer 1"},
                    {"field_id": str(uuid.uuid4()), "value": 42},
                    {"field_id": str(uuid.uuid4()), "value": None},
                ],
            )

        assert response.status_code == 200
        assert len(captured["answers"]) == 3
