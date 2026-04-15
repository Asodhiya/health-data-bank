import sys
import types
from datetime import date, datetime, timedelta, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.caretaker_response_schema import (
    FeedbackCreate,
    NoteCreateRequest,
    NoteUpdateRequest,
    ReportGenerateRequest,
)


def _install_fake_multipart():
    multipart_module = types.ModuleType("multipart")
    multipart_module.__version__ = "0.0-test"
    multipart_submodule = types.ModuleType("multipart.multipart")
    multipart_submodule.parse_options_header = lambda value: ("form-data", {})
    sys.modules.setdefault("multipart", multipart_module)
    sys.modules.setdefault("multipart.multipart", multipart_submodule)


def _load_route_module(filename: str, module_name: str):
    path = Path(__file__).resolve().parents[2] / "app" / "api" / "routes" / filename
    spec = spec_from_file_location(module_name, path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


_install_fake_multipart()
caretaker_routes = _load_route_module("Caretakers.py", "test_caretaker_routes_module")


USER_ID = uuid4()
CARETAKER_ID = uuid4()
PARTICIPANT_ID = uuid4()
GROUP_ID = uuid4()
FORM_ID = uuid4()
SUBMISSION_ID = uuid4()
NOTE_ID = uuid4()
REPORT_ID = uuid4()
NOTIFICATION_ID = uuid4()
INVITE_ID = uuid4()
FIELD_ID = uuid4()
ELEMENT_ID = uuid4()


def make_user():
    return SimpleNamespace(user_id=USER_ID, email="caretaker@test.com")


def make_result_with_scalar(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def make_scalars_result(items):
    result = MagicMock()
    result.scalars.return_value.all.return_value = items
    return result


@pytest.mark.anyio
async def test_get_caretaker_profile_returns_existing_profile():
    profile = SimpleNamespace(
        caretaker_id=CARETAKER_ID,
        user_id=USER_ID,
        title="Dr.",
        credentials="RN",
        organization="Health Bank",
        department="Care",
        specialty="Coaching",
        bio="Helping participants.",
        working_hours_start="09:00",
        working_hours_end="17:00",
        contact_preference="email",
        available_days=["Mon"],
        onboarding_completed=True,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=make_result_with_scalar(profile))

    result = await caretaker_routes.get_caretaker_profile(db=db, current_user=make_user())

    assert result is profile
    db.commit.assert_not_called()


@pytest.mark.anyio
async def test_get_caretaker_profile_creates_profile_when_missing():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=make_result_with_scalar(None))
    db.add = MagicMock()

    async def refresh_side_effect(profile):
        profile.caretaker_id = CARETAKER_ID
        profile.onboarding_completed = False

    db.refresh = AsyncMock(side_effect=refresh_side_effect)

    result = await caretaker_routes.get_caretaker_profile(db=db, current_user=make_user())

    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    assert result.user_id == USER_ID
    assert result.caretaker_id == CARETAKER_ID


@pytest.mark.anyio
async def test_list_groups_returns_serialized_groups():
    group_a = SimpleNamespace(group_id=GROUP_ID, name="Chaos Group", description="A", caretaker_id=CARETAKER_ID)
    group_b = SimpleNamespace(group_id=uuid4(), name="Peace Group", description="B", caretaker_id=CARETAKER_ID)
    query = SimpleNamespace(get_groups=AsyncMock(return_value=[group_a, group_b]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_groups(db=AsyncMock(), current_user=make_user())

    assert len(result) == 2
    assert result[0].group_id == GROUP_ID
    assert result[1].name == "Peace Group"


@pytest.mark.anyio
async def test_get_group_propagates_not_found():
    query = SimpleNamespace(get_group=AsyncMock(side_effect=HTTPException(status_code=404, detail="Group not found")))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        with pytest.raises(HTTPException) as exc:
            await caretaker_routes.get_group(GROUP_ID, db=AsyncMock(), current_user=make_user())

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_list_group_members_returns_names():
    participant = SimpleNamespace(participant_id=PARTICIPANT_ID)
    row = (participant, "Akshit", "Sodhiya", datetime(2026, 4, 1, tzinfo=timezone.utc))
    query = SimpleNamespace(get_group_participants=AsyncMock(return_value=[row]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_group_members(GROUP_ID, db=AsyncMock(), current_user=make_user())

    assert len(result) == 1
    assert result[0].participant_id == PARTICIPANT_ID
    assert result[0].name == "Akshit Sodhiya"


@pytest.mark.anyio
async def test_list_group_forms_computes_completion_rate():
    row = SimpleNamespace(
        deployment_id=uuid4(),
        form_id=FORM_ID,
        group_id=GROUP_ID,
        group_name="Chaos Group",
        form_title="Weekly Check-in",
        form_description="Survey",
        form_status="PUBLISHED",
        deployed_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        revoked_at=None,
        participant_count=10,
        submitted_count=7,
    )
    query = SimpleNamespace(get_group_forms=AsyncMock(return_value=[row]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_group_forms(db=AsyncMock(), current_user=make_user())

    assert len(result) == 1
    assert result[0].completion_rate == 70.0
    assert result[0].is_active is True


@pytest.mark.anyio
async def test_get_group_form_detail_404_when_form_not_in_assigned_groups():
    query = SimpleNamespace(get_caretaker_form_group_ids=AsyncMock(return_value=[]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        with pytest.raises(HTTPException) as exc:
            await caretaker_routes.get_group_form_detail(FORM_ID, db=AsyncMock(), current_user=make_user())

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_get_group_form_detail_filters_deployed_group_ids():
    form = SimpleNamespace(
        form_id=FORM_ID,
        title="Survey",
        description="Desc",
        version=1,
        status="PUBLISHED",
        created_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        fields=[],
        deployed_group_ids=[GROUP_ID, uuid4()],
    )
    query = SimpleNamespace(get_caretaker_form_group_ids=AsyncMock(return_value=[GROUP_ID]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        with patch.object(caretaker_routes, "get_form_by_id", AsyncMock(return_value=form)):
            result = await caretaker_routes.get_group_form_detail(FORM_ID, db=AsyncMock(), current_user=make_user())

    assert result.deployed_group_ids == [GROUP_ID]


@pytest.mark.anyio
async def test_list_participants_passes_filters_and_serializes():
    row = SimpleNamespace(
        participant_id=PARTICIPANT_ID,
        first_name="Ben",
        last_name="Dover",
        email="ben@example.com",
        phone="123",
        dob=date(2000, 1, 1),
        gender="Male",
        age=26,
        status="highly_active",
        group_id=GROUP_ID,
        enrolled_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        survey_progress="completed",
        goal_progress="in_progress",
        survey_submitted_count=3,
        survey_deployed_count=4,
        goals_completed_count=1,
        goals_total_count=2,
        last_login_at=datetime(2026, 4, 6, tzinfo=timezone.utc),
        last_submission_at=date(2026, 4, 6),
    )
    query = SimpleNamespace(get_participants=AsyncMock(return_value=[row]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_participants(
            group_id=GROUP_ID,
            status="active",
            gender="male",
            age_min=20,
            age_max=30,
            has_alerts=True,
            survey_progress="completed",
            goal_progress="in_progress",
            submission_date_from=date(2026, 1, 1),
            submission_date_to=date(2026, 12, 31),
            sort_by="name",
            sort_dir="desc",
            limit=25,
            offset=5,
            q="Ben",
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert len(result) == 1
    assert result[0].name == "Ben Dover"
    query.get_participants.assert_awaited_once()
    kwargs = query.get_participants.await_args.kwargs
    assert kwargs["group_id"] == GROUP_ID
    assert kwargs["status"] == "active"
    assert kwargs["gender"] == "male"
    assert kwargs["sort_by"] == "name"
    assert kwargs["sort_dir"] == "desc"


@pytest.mark.anyio
async def test_get_participant_activity_counts_returns_counts():
    query = SimpleNamespace(
        get_participant_activity_counts=AsyncMock(
            return_value={"highly_active": 8, "moderately_active": 0, "low_active": 0, "inactive": 3}
        )
    )

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_participant_activity_counts(
            group_id=GROUP_ID,
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert result.highly_active == 8
    assert result.inactive == 3


@pytest.mark.anyio
async def test_get_participant_returns_detail_with_groups():
    participant = SimpleNamespace(participant_id=PARTICIPANT_ID)
    query = SimpleNamespace(
        get_group_participant=AsyncMock(return_value=(participant, "Naruto", "Uzumaki", datetime.now(timezone.utc))),
        get_participant_group_memberships=AsyncMock(return_value=[{"group_id": str(GROUP_ID), "name": "Chaos Group"}]),
    )

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_participant(
            participant_id=PARTICIPANT_ID,
            group_id=GROUP_ID,
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert result.participant_id == PARTICIPANT_ID
    assert result.name == "Naruto Uzumaki"
    assert result.groups[0]["name"] == "Chaos Group"


@pytest.mark.anyio
async def test_list_participant_submissions_returns_items():
    row = SimpleNamespace(
        submission_id=SUBMISSION_ID,
        participant_id=PARTICIPANT_ID,
        form_id=FORM_ID,
        form_name="Survey A",
        submitted_at=datetime(2026, 4, 6, tzinfo=timezone.utc),
    )
    query = SimpleNamespace(get_participant_submissions=AsyncMock(return_value=[row]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_participant_submissions(
            participant_id=PARTICIPANT_ID,
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert len(result) == 1
    assert result[0].form_name == "Survey A"


@pytest.mark.anyio
async def test_create_feedback_on_submission_creates_notification():
    feedback = SimpleNamespace(
        feedback_id=uuid4(),
        caretaker_id=CARETAKER_ID,
        participant_id=PARTICIPANT_ID,
        submission_id=SUBMISSION_ID,
        message="Great job",
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
    )
    participant = SimpleNamespace(user_id=uuid4())
    query = SimpleNamespace(create_feedback=AsyncMock(return_value=feedback))
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=participant)

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        with patch.object(caretaker_routes, "create_notification", AsyncMock()) as notify:
            result = await caretaker_routes.create_feedback(
                participant_id=PARTICIPANT_ID,
                submission_id=SUBMISSION_ID,
                body=FeedbackCreate(message="Great job"),
                db=db,
                current_user=make_user(),
            )

    assert result.feedback_id == feedback.feedback_id
    notify.assert_awaited_once()
    assert notify.await_args.kwargs["user_id"] == participant.user_id


@pytest.mark.anyio
async def test_create_general_feedback_creates_notification():
    feedback = SimpleNamespace(
        feedback_id=uuid4(),
        caretaker_id=CARETAKER_ID,
        participant_id=PARTICIPANT_ID,
        submission_id=None,
        message="Keep going",
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
    )
    participant = SimpleNamespace(user_id=uuid4())
    query = SimpleNamespace(create_feedback=AsyncMock(return_value=feedback))
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=participant)

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        with patch.object(caretaker_routes, "create_notification", AsyncMock()) as notify:
            result = await caretaker_routes.create_general_feedback(
                participant_id=PARTICIPANT_ID,
                body=FeedbackCreate(message="Keep going"),
                db=db,
                current_user=make_user(),
            )

    assert result.submission_id is None
    notify.assert_awaited_once()


@pytest.mark.anyio
async def test_list_feedback_returns_feedback_items():
    row = SimpleNamespace(
        feedback_id=uuid4(),
        caretaker_id=CARETAKER_ID,
        participant_id=PARTICIPANT_ID,
        submission_id=None,
        message="Hello",
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
    )
    query = SimpleNamespace(list_feedback=AsyncMock(return_value=[row]))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.list_feedback(PARTICIPANT_ID, db=AsyncMock(), current_user=make_user())

    assert len(result) == 1
    assert result[0].message == "Hello"


@pytest.mark.anyio
async def test_create_note_returns_404_when_participant_missing():
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[CARETAKER_ID, None])

    with pytest.raises(HTTPException) as exc:
        await caretaker_routes.create_note(
            participant_id=PARTICIPANT_ID,
            body=NoteCreateRequest(text="Check-in went well"),
            db=db,
            current_user=make_user(),
        )

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_create_note_creates_note():
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[CARETAKER_ID, PARTICIPANT_ID])
    db.add = MagicMock()

    async def refresh_side_effect(note):
        note.note_id = NOTE_ID
        note.created_at = datetime(2026, 4, 7, tzinfo=timezone.utc)

    db.refresh = AsyncMock(side_effect=refresh_side_effect)

    result = await caretaker_routes.create_note(
        participant_id=PARTICIPANT_ID,
        body=NoteCreateRequest(text="  Check-in went well  ", tag="concern"),
        db=db,
        current_user=make_user(),
    )

    assert result.note_id == NOTE_ID
    assert result.text == "Check-in went well"
    assert result.tag == "concern"


@pytest.mark.anyio
async def test_update_note_returns_404_when_note_missing():
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[CARETAKER_ID, None])

    with pytest.raises(HTTPException) as exc:
        await caretaker_routes.update_note(
            note_id=NOTE_ID,
            body=NoteUpdateRequest(text="updated"),
            db=db,
            current_user=make_user(),
        )

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_delete_note_returns_404_when_note_missing():
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=CARETAKER_ID)
    result = MagicMock()
    result.rowcount = 0
    db.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await caretaker_routes.delete_note(
            note_id=NOTE_ID,
            db=db,
            current_user=make_user(),
        )

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_generate_group_report_returns_response():
    report = SimpleNamespace(
        report_id=REPORT_ID,
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
        parameters={"payload": {"rows": 10}},
    )
    query = SimpleNamespace(generate_group_report=AsyncMock(return_value=report))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.generate_group_report(
            group_id=GROUP_ID,
            body=ReportGenerateRequest(
                date_from=date(2026, 1, 1),
                date_to=date(2026, 4, 1),
                element_ids=[ELEMENT_ID],
            ),
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert result.report_id == REPORT_ID
    assert result.payload["rows"] == 10


@pytest.mark.anyio
async def test_generate_comparison_report_requires_compare_participant():
    with pytest.raises(HTTPException) as exc:
        await caretaker_routes.generate_comparison_report(
            participant_id=PARTICIPANT_ID,
            compare_with="participant",
            compare_participant_id=None,
            group_id=None,
            body=ReportGenerateRequest(),
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert exc.value.status_code == 422


@pytest.mark.anyio
async def test_get_submission_detail_serializes_answers():
    row = SimpleNamespace(
        submission_id=SUBMISSION_ID,
        participant_id=PARTICIPANT_ID,
        form_id=FORM_ID,
        form_name="Survey A",
        submitted_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
    )
    answer = SimpleNamespace(
        field_id=FIELD_ID,
        field_label="Mood",
        value_text="Good",
        value_number=None,
        value_date=None,
        value_json=None,
    )
    query = SimpleNamespace(get_submission_detail=AsyncMock(return_value=(row, [answer])))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_submission_detail(
            participant_id=PARTICIPANT_ID,
            submission_id=SUBMISSION_ID,
            db=AsyncMock(),
            _=make_user(),
        )

    assert result.submission_id == SUBMISSION_ID
    assert len(result.answers) == 1
    assert result.answers[0].field_label == "Mood"


@pytest.mark.anyio
async def test_get_participant_goals_passthrough():
    goals = [{"goal_id": str(uuid4()), "status": "active"}]
    query = SimpleNamespace(get_participant_goals=AsyncMock(return_value=goals))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_participant_goals(PARTICIPANT_ID, db=AsyncMock(), _=make_user())

    assert result == goals


@pytest.mark.anyio
async def test_get_health_trends_passthrough():
    trends = [{"metric_name": "Water", "points": [{"date": "2026-04-01", "value": 8}]}]
    query = SimpleNamespace(get_health_trends=AsyncMock(return_value=trends))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_health_trends(
            participant_id=PARTICIPANT_ID,
            element_ids=[ELEMENT_ID],
            date_from=date(2026, 1, 1),
            date_to=date(2026, 12, 31),
            db=AsyncMock(),
            _=make_user(),
        )

    assert result == trends


@pytest.mark.anyio
async def test_list_notifications_transforms_read_status():
    row = SimpleNamespace(
        notification_id=NOTIFICATION_ID,
        type="flag",
        title="Title",
        message="Message",
        link="/caretaker/messages",
        role_target="caretaker",
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
        status="read",
    )

    with patch.object(caretaker_routes, "list_notifications_for_user", AsyncMock(return_value=[row])):
        result = await caretaker_routes.list_notifications(db=AsyncMock(), current_user=make_user())

    assert len(result) == 1
    assert result[0].is_read is True


@pytest.mark.anyio
async def test_mark_notification_read_returns_updated_item():
    row = SimpleNamespace(
        notification_id=NOTIFICATION_ID,
        type="flag",
        title="Title",
        message="Message",
        link="/caretaker/messages",
        role_target="caretaker",
        created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
        status="read",
    )

    with patch.object(caretaker_routes, "mark_notification_read_for_user", AsyncMock(return_value=row)):
        result = await caretaker_routes.mark_notification_read(
            notification_id=NOTIFICATION_ID,
            db=AsyncMock(),
            current_user=make_user(),
        )

    assert result.notification_id == NOTIFICATION_ID
    assert result.is_read is True


@pytest.mark.anyio
async def test_list_my_invites_derives_pending_accepted_and_expired_status():
    now = datetime.now(timezone.utc)
    rows = [
        SimpleNamespace(
            invite_id=uuid4(),
            email="pending@example.com",
            group_id=GROUP_ID,
            invited_by=USER_ID,
            created_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=2),
            used=False,
            role_name="participant",
            group_name="Chaos Group",
        ),
        SimpleNamespace(
            invite_id=uuid4(),
            email="accepted@example.com",
            group_id=GROUP_ID,
            invited_by=USER_ID,
            created_at=now - timedelta(days=2),
            expires_at=now + timedelta(days=2),
            used=True,
            role_name="participant",
            group_name="Chaos Group",
        ),
        SimpleNamespace(
            invite_id=uuid4(),
            email="expired@example.com",
            group_id=GROUP_ID,
            invited_by=USER_ID,
            created_at=now - timedelta(days=5),
            expires_at=now - timedelta(days=1),
            used=False,
            role_name="participant",
            group_name="Chaos Group",
        ),
    ]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: rows))

    result = await caretaker_routes.list_my_invites(limit=None, offset=0, db=db, current_user=make_user())

    statuses = {item.email: item.status for item in result}
    assert statuses["pending@example.com"] == "pending"
    assert statuses["accepted@example.com"] == "accepted"
    assert statuses["expired@example.com"] == "expired"


@pytest.mark.anyio
async def test_get_participant_summary_passthrough():
    query = SimpleNamespace(get_participant_summary=AsyncMock(return_value={"total": 10, "active": 8, "inactive": 2, "flagged": 1}))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_participant_summary(group_id=GROUP_ID, db=AsyncMock(), current_user=make_user())

    assert result["total"] == 10
    assert result["active"] == 8


@pytest.mark.anyio
async def test_get_forms_summary_passthrough():
    query = SimpleNamespace(get_group_forms_summary=AsyncMock(return_value={"total": 2, "active": 1, "revoked": 1}))

    with patch.object(caretaker_routes, "CaretakersQuery", return_value=query):
        result = await caretaker_routes.get_forms_summary(group_id=GROUP_ID, db=AsyncMock(), current_user=make_user())

    assert result["total"] == 2
    assert result["revoked"] == 1


@pytest.mark.anyio
async def test_revoke_my_invite_rejects_used_invite():
    invite = SimpleNamespace(
        invite_id=INVITE_ID,
        invited_by=USER_ID,
        used=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=invite)

    with pytest.raises(HTTPException) as exc:
        await caretaker_routes.revoke_my_invite(INVITE_ID, db=db, current_user=make_user())

    assert exc.value.status_code == 400
