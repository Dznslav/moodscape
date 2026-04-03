from datetime import date, datetime, timezone

from app.services.weather_service import _select_daily_weather_entry


def _ts(year: int, month: int, day: int, hour: int = 0) -> int:
    return int(datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc).timestamp())


def test_select_daily_weather_entry_matches_target_local_date() -> None:
    target_date = date(2026, 3, 31)
    timezone_offset_seconds = 14 * 3600
    daily_list = [
        {"dt": _ts(2026, 3, 30, 10), "temp": {"day": 12.0}, "clouds": 90},
        {"dt": _ts(2026, 3, 31, 10), "temp": {"day": 22.0}, "clouds": 5},
    ]

    selected = _select_daily_weather_entry(daily_list, target_date, timezone_offset_seconds)

    assert selected == daily_list[0]


def test_select_daily_weather_entry_falls_back_to_closest_local_date() -> None:
    target_date = date(2026, 4, 2)
    timezone_offset_seconds = 2 * 3600
    daily_list = [
        {"dt": _ts(2026, 4, 1, 22), "temp": {"day": 8.0}},
        {"dt": _ts(2026, 4, 2, 22), "temp": {"day": 16.0}},
    ]

    selected = _select_daily_weather_entry(daily_list, target_date, timezone_offset_seconds)

    assert selected == daily_list[0]
