"""
Service-level tests for the researcher dashboard.

Covers items 2–11 of the dashboard test plan:

  2. Demographic data appears in the researcher's results
  3. The intake form does NOT appear in the researcher survey picker
  4. Researchers can still see demographic data derived from intake answers
  5. A researcher can filter with all data elements
  6. The researcher survey filter does not show deleted (DRAFT/DELETED) surveys
  7. Date filters work on the initial demographic-only view
  8. Date filters work after selecting a survey
  9. Group filter works
 10. Advanced filters only apply when included in the request payload
 11. allow_null toggle (Include missing element data) works in isolation

These are unit tests that mock the DB layer — no real database needed.

Run with:
    pytest tests/services/test_researcher_dashboard_filters.py -v
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.schemas.filter_data_schema import ParticipantFilter
from app.services import filter_data_service


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

class _CapturedFilters(Exception):
    """
    Sentinel raised by a fake resolve_participant_ids to short-circuit
    get_survey_results_pivoted before any db.execute call. The filters
    object is attached so the test can assert on it.

    This pattern makes parameter-passthrough tests robust to ANY internal
    refactor of the function — we never depend on the exact call sequence.
    """
    def __init__(self, filters):
        self.filters = filters


def _capturing_resolve(captured_list=None):
    """
    Build a fake resolve_participant_ids that records the filters it
    received and then raises _CapturedFilters to short-circuit.

    CRITICAL: real signature is resolve_participant_ids(filters, db).
    filters comes FIRST. The previous version of this file had them
    swapped, which is why every parameter-passthrough test was reading
    the AsyncMock instead of the real ParticipantFilter.
    """
    async def fake(filters, db):
        if captured_list is not None:
            captured_list.append(filters)
        raise _CapturedFilters(filters)
    return fake


class _FakeResult:
    """
    Drop-in for SQLAlchemy Result. Supports every access pattern used by
    filter_data_service so a single instance satisfies any caller.

        result.all()                   → list of rows
        result.scalar()                → scalar_value (or len(rows))
        result.scalar_one()            → same
        result.scalar_one_or_none()    → same
        result.scalars().all()         → list of scalar values
        result.scalars().first()       → first scalar or None
        result.scalars().one_or_none() → first scalar or None
    """
    def __init__(self, rows=None, scalar_value=None):
        self._rows = list(rows or [])
        self._scalar = (
            scalar_value if scalar_value is not None else len(self._rows)
        )

    def all(self):
        return self._rows

    def scalar(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return _FakeScalars(self._rows)


class _FakeScalars:
    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def one_or_none(self):
        return self._rows[0] if self._rows else None


def _make_demographic_row(participant_id, **overrides):
    """
    Build a fake row of the shape the demographics-only branch's main
    SELECT returns (one row per participant, no element columns).
    """
    row = SimpleNamespace(
        participant_id=participant_id,
        gender="Female",
        pronouns="she/her",
        primary_language="English",
        occupation_status="Employed",
        living_arrangement="Apartment",
        highest_education_level="College",
        dependents=1,
        marital_status="Single",
        dob=date(1990, 1, 1),
    )
    for k, v in overrides.items():
        setattr(row, k, v)
    return row


def _patch_intake_fallbacks(monkeypatch, fallback_map=None):
    monkeypatch.setattr(
        filter_data_service,
        "_load_intake_profile_fallbacks",
        AsyncMock(return_value=fallback_map or {}),
    )


def _compile(stmt):
    """Compile a SQLAlchemy stmt with literals inlined so we can grep the SQL."""
    return str(
        stmt.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


# ═══════════════════════════════════════════════════════════════════════════
# 2. Demographic data appears in the researcher's results
# ═══════════════════════════════════════════════════════════════════════════

class TestDemographicDataAppears:

    @pytest.mark.anyio
    async def test_default_view_includes_demographic_columns(self, monkeypatch):
        """
        With no survey selected, the response columns must include the
        standard demographic fields and rows must carry those values.

        Demographics-only branch makes exactly 2 db.execute calls:
          1) count_stmt → .scalar()
          2) main stmt  → .all()
        Then calls _load_intake_profile_fallbacks (patched).
        """
        participant_id = uuid4()

        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            AsyncMock(return_value=[participant_id]),
        )
        _patch_intake_fallbacks(monkeypatch)

        db = AsyncMock()
        db.execute.side_effect = [
            _FakeResult(scalar_value=1),                                  # count
            _FakeResult(rows=[_make_demographic_row(participant_id)]),    # main
        ]

        result = await filter_data_service.get_survey_results_pivoted(
            db, filters=ParticipantFilter(),
        )

        column_ids = {col["id"] for col in result["columns"]}
        for required in (
            "gender", "pronouns", "primary_language",
            "occupation_status", "living_arrangement",
            "highest_education_level", "dependents",
            "marital_status", "age",
        ):
            assert required in column_ids, f"missing demographic column: {required}"

        assert len(result["data"]) == 1
        assert result["data"][0]["gender"] == "Female"
        assert result["data"][0]["primary_language"] == "English"


# ═══════════════════════════════════════════════════════════════════════════
# 3. Intake form does not appear in the researcher survey picker
# 6. Survey filter does not show deleted (DRAFT/DELETED) surveys
# ═══════════════════════════════════════════════════════════════════════════

class TestSurveyPickerExclusions:
    """
    get_available_surveys is the backing service for /researcher/available-surveys.
    Current implementation filters by:
        title != 'Intake Form'
        status IN ('PUBLISHED', 'ARCHIVED')
    These tests pin that contract via SQL inspection with literal_binds.
    """

    @pytest.mark.anyio
    async def test_intake_form_excluded_from_picker(self):
        db = AsyncMock()
        db.execute.return_value = _FakeResult()  # all calls return empty

        await filter_data_service.get_available_surveys(db, current_user_id=uuid4())

        assert db.execute.await_count >= 1
        first_call_sql = _compile(db.execute.call_args_list[0].args[0])
        assert "Intake Form" in first_call_sql, (
            "expected the submitted-form query to filter out the Intake Form by title"
        )

    @pytest.mark.anyio
    async def test_only_published_or_archived_surveys_appear(self):
        db = AsyncMock()
        db.execute.return_value = _FakeResult()

        await filter_data_service.get_available_surveys(db, current_user_id=uuid4())

        first_call_sql = _compile(db.execute.call_args_list[0].args[0])
        assert "PUBLISHED" in first_call_sql
        assert "ARCHIVED" in first_call_sql
        # If DRAFT or DELETED ever appear here, someone widened the status
        # filter — that's the regression we want to catch.
        assert "'DRAFT'" not in first_call_sql
        assert "'DELETED'" not in first_call_sql

    @pytest.mark.anyio
    async def test_picker_dedupes_to_latest_version_per_family(self):
        """Two versions of the same form return only the latest in the picker."""
        root_id = uuid4()
        v1 = SimpleNamespace(
            form_id=root_id, parent_form_id=None, version=1,
            title="BP Survey", status="ARCHIVED",
        )
        v2 = SimpleNamespace(
            form_id=uuid4(), parent_form_id=root_id, version=2,
            title="BP Survey", status="PUBLISHED",
        )

        db = AsyncMock()
        # 1st execute: submitted forms (both versions)
        # 2nd execute: latest-by-family candidates (v2 first)
        # 3rd execute: deployment lookup (empty)
        db.execute.side_effect = [
            _FakeResult(rows=[v1, v2]),
            _FakeResult(rows=[v2, v1]),
            _FakeResult(rows=[]),
        ]

        forms = await filter_data_service.get_available_surveys(
            db, current_user_id=uuid4()
        )

        assert len(forms) == 1
        assert forms[0].version == 2
        assert forms[0].status == "PUBLISHED"


# ═══════════════════════════════════════════════════════════════════════════
# 4. Researchers can still see demographic data derived from intake answers
# ═══════════════════════════════════════════════════════════════════════════

class TestIntakeDerivedDemographics:

    @pytest.mark.anyio
    async def test_missing_profile_fields_filled_from_intake(self, monkeypatch):
        """
        ParticipantProfile fields are NULL (participant never edited their
        profile after intake). The intake-fallback dict carries the values
        they originally answered on the intake form.
        """
        participant_id = uuid4()

        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            AsyncMock(return_value=[participant_id]),
        )
        _patch_intake_fallbacks(monkeypatch, {
            str(participant_id): {
                "gender": "Non-binary",
                "pronouns": "they/them",
                "primary_language": "French",
                "occupation_status": "Student",
                "living_arrangement": "With Family",
                "highest_education_level": "Undergraduate",
                "dependents": 0,
                "marital_status": "Single",
                "dob": date(1995, 6, 15),
            },
        })

        db = AsyncMock()
        db.execute.side_effect = [
            _FakeResult(scalar_value=1),
            _FakeResult(rows=[
                _make_demographic_row(
                    participant_id,
                    gender=None, pronouns=None, primary_language=None,
                    occupation_status=None, living_arrangement=None,
                    highest_education_level=None, dependents=None,
                    marital_status=None, dob=None,
                ),
            ]),
        ]

        result = await filter_data_service.get_survey_results_pivoted(
            db, filters=ParticipantFilter(),
        )

        row = result["data"][0]
        assert row["gender"] == "Non-binary"
        assert row["pronouns"] == "they/them"
        assert row["primary_language"] == "French"
        assert row["dependents"] == 0
        # Age depends on "today" — just assert it was computed.
        assert row["age"] is not None


# ═══════════════════════════════════════════════════════════════════════════
# 5. A researcher can filter with all data elements
# ═══════════════════════════════════════════════════════════════════════════

class TestFilterWithAllElements:
    """
    Verified at the parameter-passthrough level via the sentinel pattern:
    every selected element id must reach resolve_participant_ids unmodified.
    The end-to-end 'every element renders a column' behaviour has its own
    coverage in test_filter_data_researcher.py — we don't duplicate that
    mock chain here.
    """

    @pytest.mark.anyio
    async def test_every_selected_element_id_reaches_resolver(self, monkeypatch):
        element_ids = [uuid4() for _ in range(5)]

        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(
                    selected_elements=[
                        {"element_id": eid, "source_types": ["survey", "goal"]}
                        for eid in element_ids
                    ],
                ),
            )

        captured = exc_info.value.filters
        captured_ids = [se.element_id for se in (captured.selected_elements or [])]
        assert len(captured_ids) == 5
        for eid in element_ids:
            assert eid in captured_ids, f"element {eid} dropped before reaching resolver"


# ═══════════════════════════════════════════════════════════════════════════
# 7. Date filters on the demographic-only view
# 8. Date filters after selecting a survey
# ═══════════════════════════════════════════════════════════════════════════

class TestDateFilters:

    @pytest.mark.anyio
    async def test_date_filters_apply_in_demographic_only_view(self, monkeypatch):
        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(
                    date_from=date(2026, 1, 1),
                    date_to=date(2026, 3, 31),
                ),
            )

        captured = exc_info.value.filters
        assert captured.date_from == date(2026, 1, 1)
        assert captured.date_to == date(2026, 3, 31)
        assert captured.survey_id is None

    @pytest.mark.anyio
    async def test_date_filters_apply_when_survey_selected(self, monkeypatch):
        survey_id = uuid4()
        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                survey_id=str(survey_id),
                filters=ParticipantFilter(
                    survey_id=str(survey_id),
                    date_from=date(2026, 2, 1),
                    date_to=date(2026, 2, 28),
                ),
            )

        captured = exc_info.value.filters
        assert captured.date_from == date(2026, 2, 1)
        assert captured.date_to == date(2026, 2, 28)
        assert str(captured.survey_id) == str(survey_id)


# ═══════════════════════════════════════════════════════════════════════════
# 9. Group filter works
# ═══════════════════════════════════════════════════════════════════════════

class TestGroupFilter:

    @pytest.mark.anyio
    async def test_group_ids_passed_to_participant_resolver(self, monkeypatch):
        group_a = uuid4()
        group_b = uuid4()

        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(group_ids=[group_a, group_b]),
            )

        captured = exc_info.value.filters
        assert list(captured.group_ids) == [group_a, group_b]

    @pytest.mark.anyio
    async def test_empty_group_filter_does_not_restrict_scope(self, monkeypatch):
        """An empty group_ids list must mean 'all groups', not 'no groups'."""
        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(group_ids=[]),
            )

        captured = exc_info.value.filters
        assert list(captured.group_ids) == []


# ═══════════════════════════════════════════════════════════════════════════
# 10. Advanced filters only apply when included in the payload
#
# NOTE: The "Apply button only" requirement (no fetch on every keystroke)
# is a React component-level concern — see ResearcherDashboard.jsx
# draftFilters / appliedFilters separation. That belongs in a Vitest
# component test.
#
# What we verify at the API layer: the service does NOT carry advanced-
# filter state across calls.
# ═══════════════════════════════════════════════════════════════════════════

class TestAdvancedFiltersOnlyApplyWhenSent:

    @pytest.mark.anyio
    async def test_omitting_demographic_filters_widens_scope(self, monkeypatch):
        captured_calls = []

        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(captured_list=captured_calls),
        )

        # Call 1: no advanced filters
        with pytest.raises(_CapturedFilters):
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(), filters=ParticipantFilter(),
            )

        # Call 2: WITH a demographic filter
        with pytest.raises(_CapturedFilters):
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(
                    demographic_filters=[{
                        "field": "gender",
                        "operator": "eq",
                        "value": "Female",
                    }],
                ),
            )

        assert len(captured_calls) == 2
        first, second = captured_calls
        assert list(first.demographic_filters or []) == []
        assert len(list(second.demographic_filters or [])) == 1
        only_filter = list(second.demographic_filters)[0]
        assert only_filter.field == "gender"
        assert only_filter.value == "Female"


# ═══════════════════════════════════════════════════════════════════════════
# 11. allow_null toggle works in isolation
# ═══════════════════════════════════════════════════════════════════════════

class TestAllowNullToggle:
    """
    The end-to-end "missing participants are/aren't included" behaviour is
    already covered by the existing tests in test_filter_data_researcher.py.
    Here we verify the API contract: the toggle's value reaches the resolver
    unchanged. If anyone hard-codes allow_null or drops it along the way,
    these tests catch it.
    """

    @pytest.mark.anyio
    async def test_allow_null_true_reaches_resolver(self, monkeypatch):
        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(allow_null=True),
            )

        assert exc_info.value.filters.allow_null is True

    @pytest.mark.anyio
    async def test_allow_null_false_reaches_resolver(self, monkeypatch):
        monkeypatch.setattr(
            filter_data_service,
            "resolve_participant_ids",
            _capturing_resolve(),
        )

        with pytest.raises(_CapturedFilters) as exc_info:
            await filter_data_service.get_survey_results_pivoted(
                AsyncMock(),
                filters=ParticipantFilter(allow_null=False),
            )

        assert exc_info.value.filters.allow_null is False
