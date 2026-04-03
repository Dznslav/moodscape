from __future__ import annotations

from datetime import date, datetime, time, timedelta


LOGICAL_DAY_START_HOUR = 4
LOGICAL_DAY_START_TIME = time(hour=LOGICAL_DAY_START_HOUR)


def get_logical_date_for_datetime(value: datetime) -> date:
    return (value - timedelta(hours=LOGICAL_DAY_START_HOUR)).date()


def get_logical_day_bounds(target_date: date) -> tuple[datetime, datetime]:
    day_start = datetime.combine(target_date, LOGICAL_DAY_START_TIME)
    next_day_start = day_start + timedelta(days=1)
    return day_start, next_day_start
