"""
Unit Tests: Participant Survey Service (app/services/participant_survey_service.py)

What we are testing:
    _build_survey_status()       — derives status (NEW / IN_PROGRESS / COMPLETED)
    _build_answer_records()      — maps raw answer dicts to SubmissionAnswer objects
    _apply_transform()           — normalises answer values per element mapping rules
    get_participant_survey_detail() — returns None when participant/deployment missing
    _get_participant_and_submission() — raises ValueError when not a participant or not assigned

These are service-layer unit tests. No real database is required.

Run with:
    pytest tests/services/test_participant_survey.py -v
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.db.models import FormSubmission, HealthDataPoint


USER_ID = uuid.uuid4()
FORM_ID = uuid.uuid4()
FIELD_ID = uuid.uuid4()
SUBMISSION_ID = uuid.uuid4()
PARTICIPANT_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    return db


def db_result(value):
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    r.scalar_one.return_value = value
    r.scalars.return_value.first.return_value = value
    r.scalars.return_value.all.return_value = (
        value if isinstance(value, list) else ([] if value is None else [value])
    )
    return r


def make_participant(participant_id=None):
    p = MagicMock()
    p.participant_id = participant_id or PARTICIPANT_ID
    p.user_id = USER_ID
    return p


def make_submission(submitted_at=None):
    s = MagicMock()
    s.submission_id = SUBMISSION_ID
    s.submitted_at = submitted_at
    s.answers = []
    return s


# ---------------------------------------------------------------------------
# _build_survey_status — pure function, no DB needed
# ---------------------------------------------------------------------------

class TestBuildSurveyStatus:

    def test_returns_new_when_no_submission(self):
        from app.services.participant_survey_service import _build_survey_status
        status, submitted_at = _build_survey_status(None)
        assert status == "NEW"
        assert submitted_at is None

    def test_returns_in_progress_when_draft(self):
        """Submission exists but submitted_at is None → IN_PROGRESS."""
        from app.services.participant_survey_service import _build_survey_status
        sub = make_submission(submitted_at=None)
        status, submitted_at = _build_survey_status(sub)
        assert status == "IN_PROGRESS"
        assert submitted_at is None

    def test_returns_completed_when_submitted(self):
        from app.services.participant_survey_service import _build_survey_status
        ts = datetime(2026, 3, 23, 10, 0, 0)
        sub = make_submission(submitted_at=ts)
        status, submitted_at = _build_survey_status(sub)
        assert status == "COMPLETED"
        assert submitted_at == ts


# ---------------------------------------------------------------------------
# _build_answer_records — pure function, no DB needed
# ---------------------------------------------------------------------------

class TestBuildAnswerRecords:

    def test_text_value_stored_as_val_text(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": "Feeling well"}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        assert len(records) == 1
        record, field_uuid, val_text, val_num, val_json = records[0]
        assert val_text == "Feeling well"
        assert val_num is None
        assert val_json is None

    def test_numeric_value_stored_as_val_num(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": 72.5}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        _, _, val_text, val_num, val_json = records[0]
        assert val_num == 72.5
        assert val_text is None
        assert val_json is None

    def test_integer_value_stored_as_val_num(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": 3}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        _, _, val_text, val_num, val_json = records[0]
        assert val_num == 3
        assert val_text is None

    def test_dict_value_stored_as_val_json(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": {"systolic": 120, "diastolic": 80}}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        _, _, val_text, val_num, val_json = records[0]
        assert val_json == {"systolic": 120, "diastolic": 80}
        assert val_text is None
        assert val_num is None

    def test_list_value_stored_as_val_json(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": ["option_a", "option_b"]}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        _, _, val_text, val_num, val_json = records[0]
        assert val_json == ["option_a", "option_b"]

    def test_none_value_stores_all_nulls(self):
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"field_id": str(FIELD_ID), "value": None}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        _, _, val_text, val_num, val_json = records[0]
        assert val_text is None
        assert val_num is None
        assert val_json is None

    def test_missing_field_id_is_skipped(self):
        """Answers without a field_id are silently ignored."""
        from app.services.participant_survey_service import _build_answer_records
        answers = [{"value": "orphan answer"}]
        records = _build_answer_records(answers, SUBMISSION_ID)
        assert records == []

    def test_multiple_answers_all_recorded(self):
        from app.services.participant_survey_service import _build_answer_records
        fid1, fid2 = uuid.uuid4(), uuid.uuid4()
        answers = [
            {"field_id": str(fid1), "value": "text answer"},
            {"field_id": str(fid2), "value": 42},
        ]
        records = _build_answer_records(answers, SUBMISSION_ID)
        assert len(records) == 2


# ---------------------------------------------------------------------------
# _apply_transform — pure function, no DB needed
# ---------------------------------------------------------------------------

class TestApplyTransform:

    def test_no_rule_returns_values_unchanged(self):
        from app.services.participant_survey_service import _apply_transform
        t, n, j = _apply_transform("hello", 5.0, None, None)
        assert t == "hello"
        assert n == 5.0
        assert j is None

    def test_offset_added_to_num(self):
        from app.services.participant_survey_service import _apply_transform
        _, n, _ = _apply_transform(None, 100.0, None, {"offset": -32})
        assert n == 68.0

    def test_multiply_scales_num(self):
        from app.services.participant_survey_service import _apply_transform
        _, n, _ = _apply_transform(None, 10.0, None, {"multiply": 2.5})
        assert n == 25.0

    def test_offset_then_multiply(self):
        """Fahrenheit to Celsius: (F - 32) * 0.5556"""
        from app.services.participant_survey_service import _apply_transform
        _, n, _ = _apply_transform(None, 212.0, None, {"offset": -32, "multiply": 0.5556})
        assert abs(n - 100.0) < 0.1  # ~100°C

    def test_map_remaps_text_to_number(self):
        """Text option mapped to a numeric score."""
        from app.services.participant_survey_service import _apply_transform
        t, n, _ = _apply_transform("Never", None, None, {"map": {"Never": 0, "Always": 3}})
        assert n == 0
        assert t is None

    def test_map_remaps_text_to_text(self):
        from app.services.participant_survey_service import _apply_transform
        t, n, _ = _apply_transform("yes", None, None, {"map": {"yes": "confirmed"}})
        assert t == "confirmed"

    def test_extract_pulls_key_from_json(self):
        from app.services.participant_survey_service import _apply_transform
        bp = {"systolic": 120, "diastolic": 80}
        t, n, j = _apply_transform(None, None, bp, {"extract": "systolic"})
        assert n == 120.0
        assert j is None

    def test_offset_ignored_when_no_num(self):
        """offset rule does nothing if there is no numeric value."""
        from app.services.participant_survey_service import _apply_transform
        t, n, _ = _apply_transform("text only", None, None, {"offset": 10})
        assert t == "text only"
        assert n is None


# ---------------------------------------------------------------------------
# get_participant_survey_detail
# ---------------------------------------------------------------------------

class TestGetParticipantSurveyDetail:

    @pytest.mark.asyncio
    async def test_returns_none_when_not_a_participant(self):
        """If the user has no participant profile, None is returned."""
        from app.services.participant_survey_service import get_participant_survey_detail

        db = make_db()
        db.execute.return_value = db_result(None)  # no ParticipantProfile

        result = await get_participant_survey_detail(FORM_ID, USER_ID, db)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_form_not_deployed_to_participant(self):
        """If the form is not deployed to any of the participant's groups, None is returned."""
        from app.services.participant_survey_service import get_participant_survey_detail

        db = make_db()
        participant = make_participant()
        # First execute: participant found. Second execute: no deployment.
        db.execute.side_effect = [db_result(participant), db_result(None)]

        result = await get_participant_survey_detail(FORM_ID, USER_ID, db)
        assert result is None


# ---------------------------------------------------------------------------
# _get_participant_and_submission
# ---------------------------------------------------------------------------

class TestGetParticipantAndSubmission:

    @pytest.mark.asyncio
    async def test_raises_value_error_when_not_a_participant(self):
        from app.services.participant_survey_service import _get_participant_and_submission

        db = make_db()
        db.execute.return_value = db_result(None)  # no ParticipantProfile

        with pytest.raises(ValueError, match="not a participant"):
            await _get_participant_and_submission(FORM_ID, USER_ID, db)

    @pytest.mark.asyncio
    async def test_raises_value_error_when_form_not_assigned(self):
        from app.services.participant_survey_service import _get_participant_and_submission

        db = make_db()
        participant = make_participant()
        # First execute: participant found. Second execute: no deployment.
        db.execute.side_effect = [db_result(participant), db_result(None)]

        with pytest.raises(ValueError, match="not assigned"):
            await _get_participant_and_submission(FORM_ID, USER_ID, db)

    @pytest.mark.asyncio
    async def test_raises_value_error_when_submission_already_completed(self):
        """Cannot save/submit to an already-completed submission."""
        from app.services.participant_survey_service import _get_participant_and_submission

        db = make_db()
        participant = make_participant()
        deployment = MagicMock()
        deployment.group_id = uuid.uuid4()
        completed_submission = make_submission(submitted_at=datetime(2026, 1, 1))

        db.execute.side_effect = [
            db_result(participant),   # _get_participant
            db_result(deployment),    # check deployment
            db_result(completed_submission),  # existing submission
        ]

        with pytest.raises(ValueError, match="completed"):
            await _get_participant_and_submission(FORM_ID, USER_ID, db)


class TestSubmitSurveyResponse:

    @pytest.mark.asyncio
    async def test_submission_sets_source_submission_id_on_health_data_point(self):
        from app.services.participant_survey_service import submit_survey_response

        db = make_db()
        participant = make_participant()
        deployment = MagicMock()
        deployment.group_id = uuid.uuid4()
        mapping = MagicMock()
        mapping.field_id = FIELD_ID
        mapping.element_id = uuid.uuid4()
        mapping.transform_rule = None

        db.scalar = AsyncMock(return_value=None)
        db.execute.side_effect = [
            db_result(participant),  # _get_participant
            db_result(deployment),   # deployment lookup
            db_result(None),         # no existing draft/completed submission
            db_result([mapping]),    # field map query
        ]

        async def fake_flush():
            for call in db.add.call_args_list:
                candidate = call.args[0]
                if isinstance(candidate, FormSubmission) and candidate.submission_id is None:
                    candidate.submission_id = SUBMISSION_ID

        db.flush.side_effect = fake_flush

        await submit_survey_response(
            FORM_ID,
            USER_ID,
            [{"field_id": str(FIELD_ID), "value": 118}],
            db,
        )

        health_data_points = [
            call.args[0]
            for call in db.add.call_args_list
            if isinstance(call.args[0], HealthDataPoint)
        ]

        assert len(health_data_points) == 1
        assert health_data_points[0].source_type == "survey"
        assert health_data_points[0].source_submission_id == SUBMISSION_ID
