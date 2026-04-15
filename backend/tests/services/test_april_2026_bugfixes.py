from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import ANY, AsyncMock, patch

import pytest

from app.db.models import DataElement
from app.db.queries.Queries import CaretakersQuery, DataElementQuery, ParticipantQuery


def _result(*, one=None, rows=None):
    return SimpleNamespace(
        one_or_none=lambda: one,
        all=lambda: rows or [],
    )


@pytest.mark.anyio
async def test_get_submission_detail_resolves_option_value_to_label():
    participant_id = uuid4()
    submission_id = uuid4()
    user_id = uuid4()
    field_id = uuid4()

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _result(one=SimpleNamespace(
                submission_id=submission_id,
                participant_id=participant_id,
                form_id=uuid4(),
                form_name="Mood survey",
                submitted_at=None,
            )),
            _result(rows=[
                SimpleNamespace(
                    field_id=field_id,
                    field_label="Mood",
                    field_type="single_select",
                    value_text=None,
                    value_number=2,
                    value_date=None,
                    value_json=None,
                )
            ]),
            _result(rows=[(field_id, 2, "Often")]),
        ]
    )

    query = CaretakersQuery(db)
    with patch.object(query, "_assert_participant_in_owned_group", AsyncMock()):
        _, answers = await query.get_submission_detail(participant_id, submission_id, user_id)

    assert len(answers) == 1
    assert answers[0].value_text == "Often"
    assert answers[0].value_number == 2


@pytest.mark.anyio
async def test_get_goal_progress_handles_missing_data_element():
    goal_id = uuid4()
    participant_id = uuid4()
    goal = SimpleNamespace(
        goal_id=goal_id,
        target_value=5,
        direction="at_least",
        window="daily",
        progress_mode="incremental",
    )

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_result(one=(goal, None)))

    query = ParticipantQuery(db)
    with patch.object(query, "_compute_goal_current_value", AsyncMock(return_value=3.0)) as compute_mock:
        result = await query.get_goal_progress(goal_id, participant_id)

    compute_mock.assert_awaited_once_with(goal, None, participant_id, as_of=ANY)
    assert result["goal_id"] == goal_id
    assert result["current_value"] == 3.0
    assert result["completed"] is False
@pytest.mark.anyio
async def test_restore_data_element_reactivates_soft_deleted_element():
    element_id = uuid4()
    element = DataElement(element_id=element_id, code="sleep_hours", label="Sleep Hours", is_active=False)

    db = AsyncMock()
    db.get = AsyncMock(return_value=element)
    db.refresh = AsyncMock()

    query = DataElementQuery(db)
    restored = await query.restore_data_element(element_id)

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(element)
    assert restored is element
    assert element.is_active is True
