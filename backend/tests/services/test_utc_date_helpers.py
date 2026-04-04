from datetime import date, datetime, timezone

from app.db.queries import Queries
from app.services import filter_data_service


def test_queries_utc_day_bounds_use_utc_dates(monkeypatch):
    class FakeDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 4, 3, 23, 30, tzinfo=timezone.utc)

    monkeypatch.setattr(Queries, "datetime", FakeDatetime)

    start, end = Queries._utc_day_bounds()

    assert start == datetime(2026, 4, 3, 0, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 4, 4, 0, 0, tzinfo=timezone.utc)


def test_filter_data_calculate_age_uses_utc_today(monkeypatch):
    class FakeDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 4, 3, 23, 30, tzinfo=timezone.utc)

    monkeypatch.setattr(filter_data_service, "datetime", FakeDatetime)

    assert filter_data_service.calculate_age(date(2000, 4, 4)) == 25
    assert filter_data_service.calculate_age(date(2000, 4, 3)) == 26
