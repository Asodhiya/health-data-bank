from __future__ import annotations

from datetime import datetime, timedelta, timezone


VALID_SURVEY_CADENCES = {"once", "daily", "weekly", "monthly"}


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_cadence(value: str | None) -> str:
    cadence = str(value or "once").strip().lower()
    return cadence if cadence in VALID_SURVEY_CADENCES else "once"


def add_months(anchor: datetime, months: int) -> datetime:
    year = anchor.year + (anchor.month - 1 + months) // 12
    month = (anchor.month - 1 + months) % 12 + 1

    if month == 12:
        next_month = datetime(year + 1, 1, 1, tzinfo=anchor.tzinfo)
    else:
        next_month = datetime(year, month + 1, 1, tzinfo=anchor.tzinfo)
    month_start = datetime(year, month, 1, tzinfo=anchor.tzinfo)
    last_day = (next_month - month_start).days
    day = min(anchor.day, last_day)

    return anchor.replace(year=year, month=month, day=day)


def get_cycle_start(
    cadence: str,
    now: datetime,
    anchor: datetime,
) -> datetime:
    cadence = normalize_cadence(cadence)
    now = as_utc(now) or datetime.now(timezone.utc)
    anchor = as_utc(anchor) or now

    if now < anchor:
        return anchor

    if cadence == "daily":
        elapsed_days = int((now - anchor).total_seconds() // 86400)
        return anchor + timedelta(days=elapsed_days)

    if cadence == "weekly":
        elapsed_weeks = int((now - anchor).total_seconds() // (86400 * 7))
        return anchor + timedelta(days=elapsed_weeks * 7)

    if cadence == "monthly":
        months = (now.year - anchor.year) * 12 + (now.month - anchor.month)
        candidate = add_months(anchor, months)
        if now < candidate:
            months -= 1
            candidate = add_months(anchor, months)
        return candidate

    return anchor


def get_cycle_key(
    cadence: str,
    now: datetime,
    anchor: datetime,
) -> str:
    cadence = normalize_cadence(cadence)
    if cadence == "once":
        return "once"

    cycle_start = get_cycle_start(cadence, now, anchor)
    return f"{cadence}:{cycle_start.isoformat()}"


def get_cycle_label(cadence: str) -> str:
    cadence = normalize_cadence(cadence)
    labels = {
        "once": "One-time",
        "daily": "Daily",
        "weekly": "Weekly",
        "monthly": "Monthly",
    }
    return labels.get(cadence, "One-time")
