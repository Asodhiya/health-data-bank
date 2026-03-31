import datetime as dt
from types import SimpleNamespace

from app.db.queries.Queries import ParticipantQuery


def test_window_bounds_daily():
    as_of = dt.datetime(2026, 3, 30, 15, 45, tzinfo=dt.timezone.utc)
    start, end = ParticipantQuery._window_bounds("daily", as_of)
    assert start == dt.datetime(2026, 3, 30, 0, 0, tzinfo=dt.timezone.utc)
    assert end == dt.datetime(2026, 3, 31, 0, 0, tzinfo=dt.timezone.utc)


def test_window_bounds_weekly():
    # Monday in UTC
    as_of = dt.datetime(2026, 3, 30, 15, 45, tzinfo=dt.timezone.utc)
    start, end = ParticipantQuery._window_bounds("weekly", as_of)
    assert start == dt.datetime(2026, 3, 30, 0, 0, tzinfo=dt.timezone.utc)
    assert end == dt.datetime(2026, 4, 6, 0, 0, tzinfo=dt.timezone.utc)


def test_window_bounds_monthly():
    as_of = dt.datetime(2026, 3, 30, 15, 45, tzinfo=dt.timezone.utc)
    start, end = ParticipantQuery._window_bounds("monthly", as_of)
    assert start == dt.datetime(2026, 3, 1, 0, 0, tzinfo=dt.timezone.utc)
    assert end == dt.datetime(2026, 4, 1, 0, 0, tzinfo=dt.timezone.utc)


def test_window_bounds_none():
    as_of = dt.datetime(2026, 3, 30, 15, 45, tzinfo=dt.timezone.utc)
    start, end = ParticipantQuery._window_bounds("none", as_of)
    assert start is None
    assert end is None


def test_goal_completed_at_least():
    goal = SimpleNamespace(target_value=100, direction="at_least")
    assert ParticipantQuery._goal_completed(goal, 100) is True
    assert ParticipantQuery._goal_completed(goal, 120) is True
    assert ParticipantQuery._goal_completed(goal, 99) is False


def test_goal_completed_at_most():
    goal = SimpleNamespace(target_value=130, direction="at_most")
    assert ParticipantQuery._goal_completed(goal, 129) is True
    assert ParticipantQuery._goal_completed(goal, 130) is True
    assert ParticipantQuery._goal_completed(goal, 131) is False


def test_goal_completed_requires_numeric_current_value():
    goal = SimpleNamespace(target_value=10, direction="at_least")
    assert ParticipantQuery._goal_completed(goal, None) is False
    assert ParticipantQuery._goal_completed(goal, "10") is False

