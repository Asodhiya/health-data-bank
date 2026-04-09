from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from pydantic import ValidationError

from app.schemas.filter_data_schema import ElementValueFilter, GroupByField, ParticipantFilter, TimeseriesFilter
from app.services import filter_data_service


@pytest.mark.anyio
async def test_longitudinal_pivot_adds_observed_at_and_source_fields():
    participant_id = uuid4()
    survey_submission_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Blood Pressure",
                    unit="mmHg",
                    data_id=uuid4(),
                    value_text=None,
                    value_number=118.0,
                    value_date=None,
                    value_json=None,
                    source_type="survey",
                    source_submission_id=survey_submission_id,
                    observed_at=datetime(2026, 4, 8, 12, 0, tzinfo=timezone.utc),
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Blood Pressure",
                    unit="mmHg",
                )
            ]

    class _ScopedParticipantsResult:
        def scalars(self):
            return self

        def all(self):
            return [participant_id]

    db = AsyncMock()
    db.execute.side_effect = [
        _ScopedParticipantsResult(),
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    try:
        result = await filter_data_service.get_survey_results_pivoted(
            db,
            survey_id=str(uuid4()),
            filters=ParticipantFilter(mode="longitudinal"),
        )

        column_ids = [col["id"] for col in result["columns"]]
        assert "observed_at" in column_ids
        assert "source_type" in column_ids
        assert "source_submission_id" in column_ids
        assert len(result["data"]) == 1
        assert result["data"][0]["observed_at"] == "2026-04-08T12:00:00+00:00"
        assert result["data"][0]["source_type"] == "survey"
        assert result["data"][0]["source_submission_id"] == str(survey_submission_id)
    finally:
        monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_pivot_returns_demographic_columns_only():
    participant_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                )
            ]

    db = AsyncMock()
    db.execute.return_value = _DataResult()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(source_types=["goal"]),
    )

    column_ids = [col["id"] for col in result["columns"]]
    assert column_ids == [
        "gender",
        "pronouns",
        "primary_language",
        "occupation_status",
        "living_arrangement",
        "highest_education_level",
        "dependents",
        "marital_status",
        "age",
    ]
    assert result["data"][0]["gender"] == "Female"
    assert "observed_at" not in result["data"][0]
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_pivot_with_element_filter_includes_filtered_element_column():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Blood Pressure",
                    unit="mmHg",
                    value_mean=118.0,
                    value_min=118.0,
                    value_max=118.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Blood Pressure",
                    unit="mmHg",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gte",
                    value=100,
                )
            ],
        ),
    )

    column_ids = [col["id"] for col in result["columns"]]
    assert f"{element_id}__mean" in column_ids
    assert result["data"][0][f"{element_id}__mean"] == 118.0
    assert result["data"][0][f"{element_id}__min"] == 118.0
    assert result["data"][0][f"{element_id}__max"] == 118.0
    assert result["data"][0][f"{element_id}__n"] == 1
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_pivot_with_goal_element_filter_uses_element_filter_source_types():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Male",
                    pronouns="he/him",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=1,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Daily Steps",
                    unit="steps",
                    value_mean=4500.0,
                    value_min=4500.0,
                    value_max=4500.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Daily Steps",
                    unit="steps",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gte",
                    value=4000,
                    source_types=["goal"],
                )
            ],
        ),
    )

    assert result["data"][0][f"{element_id}__mean"] == 4500.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_default_top_level_source_types_do_not_override_row_level_goal_source():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Male",
                    pronouns="he/him",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=1,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Daily Steps",
                    unit="steps",
                    value_mean=4500.0,
                    value_min=4500.0,
                    value_max=4500.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Daily Steps",
                    unit="steps",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            source_types=["survey", "goal"],
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gte",
                    value=4000,
                    source_types=["goal"],
                )
            ],
        ),
    )

    assert result["data"][0][f"{element_id}__mean"] == 4500.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_selected_element_ids_include_element_column_without_numeric_value_filter():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1200.0,
                    value_min=1200.0,
                    value_max=1200.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Water Intake",
                    unit="ml",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            selected_elements=[
                {
                    "element_id": element_id,
                    "source_types": ["survey", "goal"],
                }
            ],
        ),
    )

    column_ids = [col["id"] for col in result["columns"]]
    assert f"{element_id}__mean" in column_ids
    assert result["data"][0][f"{element_id}__mean"] == 1200.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_selected_element_ids_respect_top_level_source_types():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1500.0,
                    value_min=1500.0,
                    value_max=1500.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Water Intake",
                    unit="ml",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            selected_elements=[
                {
                    "element_id": element_id,
                    "source_types": ["goal"],
                }
            ],
        ),
    )

    assert result["data"][0][f"{element_id}__mean"] == 1500.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_grouped_results_group_by_gender_returns_group_rows():
    participant_id = uuid4()
    element_id = uuid4()

    class _EmptyResult:
        def all(self):
            return []

    class _CategoricalCountsResult:
        def all(self):
            return [
                SimpleNamespace(
                    **{
                        "group_value": "Female",
                        "pronouns__She/Her": 3,
                        "marital_status__Single": 2,
                    }
                )
            ]

    class _DiscoveryPronounsResult:
        def all(self):
            return [SimpleNamespace(value="She/Her", value_count=3)]

    class _DiscoveryMaritalStatusResult:
        def all(self):
            return [SimpleNamespace(value="Single", value_count=2)]

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    group_value="Female",
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1200.0,
                    value_min=900.0,
                    value_max=1500.0,
                    obs_count=4,
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DiscoveryPronounsResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _DiscoveryMaritalStatusResult(),
        _CategoricalCountsResult(),
        _DataResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_grouped(
        db,
        filters=ParticipantFilter(group_by=GroupByField(type="demographic", field="gender")),
    )

    assert result["columns"][0] == {"id": "group_value", "text": "Gender"}
    assert result["data"][0]["group_value"] == "Female"
    assert result["data"][0]["pronouns__She/Her"] == 3
    assert result["data"][0]["marital_status__Single"] == 2
    assert result["data"][0][f"{element_id}__mean"] == 1200.0
    assert result["data"][0][f"{element_id}__n"] == 4
    monkeypatch.undo()


@pytest.mark.anyio
async def test_grouped_results_group_by_gender_merges_case_variants():
    participant_id = uuid4()
    element_id = uuid4()

    class _EmptyResult:
        def all(self):
            return []

    class _CategoricalCountsResult:
        def all(self):
            return [
                SimpleNamespace(
                    **{
                        "group_value": "male",
                        "pronouns__they/them": 4,
                    }
                )
            ]

    class _DiscoveryPronounsResult:
        def all(self):
            return [SimpleNamespace(value="they/them", value_count=4)]

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    group_value="male",
                    element_id=element_id,
                    element_label="Daily Steps",
                    unit="steps",
                    value_mean=2000.0,
                    value_min=1000.0,
                    value_max=3000.0,
                    obs_count=4,
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DiscoveryPronounsResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _CategoricalCountsResult(),
        _DataResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_grouped(
        db,
        filters=ParticipantFilter(group_by=GroupByField(type="demographic", field="gender")),
    )

    assert result["data"] == [
        {
            "group_value": "Male",
            "pronouns__they/them": 4,
            f"{element_id}__mean": 2000.0,
            f"{element_id}__min": 1000.0,
            f"{element_id}__max": 3000.0,
            f"{element_id}__n": 4,
        }
    ]
    assert any(column["text"] == "Pronouns: They/Them" for column in result["columns"])
    monkeypatch.undo()


@pytest.mark.anyio
async def test_grouped_results_group_by_element_returns_group_rows():
    participant_id = uuid4()
    element_id = uuid4()

    class _EmptyResult:
        def all(self):
            return []

    class _CategoricalCountsResult:
        def all(self):
            return [
                SimpleNamespace(**{"group_value": "1200.0", "gender__Female": 1})
            ]

    class _DiscoveryGenderResult:
        def all(self):
            return [SimpleNamespace(value="Female", value_count=1)]

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    group_value="1200.0",
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1200.0,
                    value_min=1200.0,
                    value_max=1200.0,
                    obs_count=1,
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DiscoveryGenderResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _EmptyResult(),
        _CategoricalCountsResult(),
        _DataResult(),
    ]
    db.get = AsyncMock(
        return_value=SimpleNamespace(
            element_id=element_id,
            label="Living Arrangement",
            unit=None,
            datatype="text",
        )
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_grouped(
        db,
        filters=ParticipantFilter(group_by=GroupByField(type="element", element_id=element_id)),
    )

    assert result["columns"][0] == {"id": "group_value", "text": "Living Arrangement"}
    assert result["data"][0]["group_value"] == "1200.0"
    assert result["data"][0]["gender__Female"] == 1
    assert result["data"][0][f"{element_id}__mean"] == 1200.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_grouped_results_group_by_numeric_element_is_rejected():
    participant_id = uuid4()
    element_id = uuid4()

    db = AsyncMock()
    db.get = AsyncMock(
        return_value=SimpleNamespace(
            element_id=element_id,
            label="Water Intake",
            unit="ml",
            datatype="number",
        )
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    with pytest.raises(HTTPException, match="categorical"):
        await filter_data_service.get_survey_results_grouped(
            db,
            filters=ParticipantFilter(group_by=GroupByField(type="element", element_id=element_id)),
        )

    monkeypatch.undo()


def test_element_value_filter_requires_value_max_for_between():
    with pytest.raises(ValidationError, match="value_max is required"):
        ElementValueFilter(
            element_id=uuid4(),
            operator="between",
            value=100,
        )


def test_element_value_filter_requires_value_max_above_value():
    with pytest.raises(ValidationError, match="value_max must be greater than value"):
        ElementValueFilter(
            element_id=uuid4(),
            operator="between",
            value=120,
            value_max=100,
        )


def test_participant_filter_allow_null_defaults_to_true():
    filters = ParticipantFilter()
    assert filters.allow_null is True


@pytest.mark.anyio
async def test_resolve_participant_ids_allow_null_includes_missing_rows():
    participant_a = uuid4()
    participant_b = uuid4()
    element_id = uuid4()

    class _BaseParticipantsResult:
        def scalars(self):
            return self

        def all(self):
            return [participant_a, participant_b]

    class _MatchedResult:
        def scalars(self):
            return self

        def all(self):
            return [participant_a]

    class _PresentResult:
        def scalars(self):
            return self

        def all(self):
            return [participant_a]

    db = AsyncMock()
    db.execute.side_effect = [
        _BaseParticipantsResult(),
        _MatchedResult(),
        _PresentResult(),
    ]
    db.get = AsyncMock(
        return_value=SimpleNamespace(element_id=element_id, label="A", datatype="number")
    )

    result = await filter_data_service.resolve_participant_ids(
        ParticipantFilter(
            allow_null=True,
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gte",
                    value=10,
                )
            ],
        ),
        db,
    )

    assert result == [participant_a, participant_b]


@pytest.mark.anyio
async def test_no_survey_pivot_allow_null_keeps_missing_participant_row():
    participant_with_data = uuid4()
    participant_missing = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_with_data,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1200.0,
                    value_min=1200.0,
                    value_max=1200.0,
                    obs_count=1,
                ),
                SimpleNamespace(
                    participant_id=participant_missing,
                    gender="Male",
                    pronouns="he/him",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=1,
                    marital_status="Married",
                    dob=None,
                    element_id=None,
                    element_label=None,
                    unit=None,
                    value_mean=None,
                    value_min=None,
                    value_max=None,
                    obs_count=None,
                ),
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Water Intake",
                    unit="ml",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_with_data, participant_missing]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            allow_null=True,
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gte",
                    value=1000,
                )
            ],
        ),
    )

    assert len(result["data"]) == 2
    missing_row = next(row for row in result["data"] if row["_participant_id"] == str(participant_missing))
    assert f"{element_id}__mean" not in missing_row or missing_row[f"{element_id}__mean"] is None
    column_ids = [column["id"] for column in result["columns"]]
    assert f"{element_id}__mean" in column_ids
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_pivot_allow_null_false_excludes_missing_participant_row_without_element_filters():
    participant_with_data = uuid4()
    participant_missing = uuid4()
    group_id = uuid4()
    element_id = uuid4()

    class _ElementScopeResult:
        def scalars(self):
            return self

        def all(self):
            return [element_id]

    class _PresenceResult:
        def scalars(self):
            return self

        def all(self):
            return [participant_with_data]

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_with_data,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=1200.0,
                    value_min=1200.0,
                    value_max=1200.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Water Intake",
                    unit="ml",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _ElementScopeResult(),
        _PresenceResult(),
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_with_data, participant_missing]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            group_ids=[group_id],
            allow_null=False,
        ),
    )

    assert len(result["data"]) == 1
    assert result["data"][0]["_participant_id"] == str(participant_with_data)
    monkeypatch.undo()


@pytest.mark.anyio
async def test_no_survey_pivot_element_filter_excludes_non_matching_rows_from_filtered_element():
    participant_id = uuid4()
    element_id = uuid4()

    class _DataResult:
        def all(self):
            return [
                SimpleNamespace(
                    participant_id=participant_id,
                    gender="Female",
                    pronouns="she/her",
                    primary_language="English",
                    occupation_status="Employed",
                    living_arrangement="Apartment",
                    highest_education_level="College",
                    dependents=2,
                    marital_status="Single",
                    dob=None,
                    element_id=element_id,
                    element_label="Water Intake",
                    unit="ml",
                    value_mean=20.0,
                    value_min=20.0,
                    value_max=20.0,
                    obs_count=1,
                )
            ]

    class _ElementMetaResult:
        def all(self):
            return [
                SimpleNamespace(
                    element_id=element_id,
                    label="Water Intake",
                    unit="ml",
                )
            ]

    db = AsyncMock()
    db.execute.side_effect = [
        _DataResult(),
        _ElementMetaResult(),
    ]
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=[participant_id]),
    )

    result = await filter_data_service.get_survey_results_pivoted(
        db,
        filters=ParticipantFilter(
            element_filters=[
                ElementValueFilter(
                    element_id=element_id,
                    operator="gt",
                    value=5,
                )
            ],
        ),
    )

    assert result["data"][0][f"{element_id}__mean"] == 20.0
    monkeypatch.undo()


@pytest.mark.anyio
async def test_timeseries_rejects_invalid_element_ids(monkeypatch):
    survey_id = uuid4()
    valid_element = uuid4()
    invalid_element = uuid4()

    monkeypatch.setattr(
        filter_data_service,
        "get_mapped_element_ids",
        AsyncMock(return_value=[valid_element]),
    )

    with pytest.raises(HTTPException) as exc_info:
        await filter_data_service.get_timeseries(
            TimeseriesFilter(
                survey_id=survey_id,
                element_ids=[valid_element, invalid_element],
            ),
            AsyncMock(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["invalid_element_ids"] == [str(invalid_element)]


@pytest.mark.anyio
async def test_timeseries_dispatches_raw_and_aggregate(monkeypatch):
    participant_ids = [uuid4()]
    raw_rows = [{"participant_id": "raw"}]
    aggregate_rows = [{"participant_id": "aggregate"}]

    monkeypatch.setattr(
        filter_data_service,
        "resolve_participant_ids",
        AsyncMock(return_value=participant_ids),
    )
    monkeypatch.setattr(
        filter_data_service,
        "_get_timeseries_raw",
        AsyncMock(return_value=raw_rows),
    )
    monkeypatch.setattr(
        filter_data_service,
        "_get_timeseries_aggregate",
        AsyncMock(return_value=aggregate_rows),
    )

    raw_result = await filter_data_service.get_timeseries(
        TimeseriesFilter(
            element_ids=[uuid4()],
            source_types=["survey", "goal"],
            date_from=date(2026, 1, 1),
            date_to=date(2026, 3, 31),
            mode="raw",
        ),
        AsyncMock(),
    )
    aggregate_result = await filter_data_service.get_timeseries(
        TimeseriesFilter(
            element_ids=[uuid4()],
            mode="aggregate",
        ),
        AsyncMock(),
    )

    assert raw_result == raw_rows
    assert aggregate_result == aggregate_rows
