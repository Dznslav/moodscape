import httpx
import json
import logging
from datetime import date, datetime, timezone

from app.core.config import settings
from app.core.coordinates import format_coordinate, normalize_coordinates
from app.core.redis import safe_get, safe_set

logger = logging.getLogger(__name__)

WEATHER_KEYS = ("temp", "humidity", "rain", "clouds")
WEATHER_CACHE_VERSION = "v3"


def _has_weather_api_key() -> bool:
    api_key = (settings.OPENWEATHER_API_KEY or "").strip()
    return bool(api_key and api_key != "your_openweathermap_api_key")


def _build_weather_payload(
    *,
    temp: float = 0.0,
    humidity: float = 0.0,
    rain: float = 0.0,
    clouds: float = 0.0,
    weather_condition: str = "",
    weather_description: str = "",
    available: bool = False,
    reason: str | None = None,
) -> dict:
    payload = {
        "temp": float(temp),
        "humidity": float(humidity),
        "rain": float(rain),
        "clouds": float(clouds),
        "weather_condition": weather_condition,
        "weather_description": weather_description,
        "available": available,
    }

    if reason:
        payload["reason"] = reason

    return payload


def _normalize_weather_payload(payload: dict | None) -> dict:
    if not isinstance(payload, dict):
        return _build_weather_payload(reason="invalid_payload")

    available = payload.get("available")
    if available is None:
        available = any(float(payload.get(key, 0.0) or 0.0) != 0.0 for key in WEATHER_KEYS)

    return _build_weather_payload(
        temp=payload.get("temp", 0.0),
        humidity=payload.get("humidity", 0.0),
        rain=payload.get("rain", 0.0),
        clouds=payload.get("clouds", 0.0),
        weather_condition=payload.get("weather_condition", ""),
        weather_description=payload.get("weather_description", ""),
        available=bool(available),
        reason=payload.get("reason"),
    )


def _get_daily_item_local_date(item: dict, timezone_offset_seconds: int) -> date | None:
    try:
        dt_value = int(item.get("dt", 0) or 0)
    except (TypeError, ValueError):
        return None

    if dt_value <= 0:
        return None

    return datetime.fromtimestamp(dt_value + timezone_offset_seconds, tz=timezone.utc).date()


def _select_daily_weather_entry(daily_list: list[dict], target_date: date, timezone_offset_seconds: int) -> dict | None:
    exact_match = None
    closest_match = None
    closest_delta_days = None

    for item in daily_list:
        item_local_date = _get_daily_item_local_date(item, timezone_offset_seconds)
        if item_local_date is None:
            continue

        if item_local_date == target_date:
            exact_match = item
            break

        delta_days = abs((item_local_date - target_date).days)
        if closest_delta_days is None or delta_days < closest_delta_days:
            closest_delta_days = delta_days
            closest_match = item

    return exact_match or closest_match


async def get_city_for_coordinates(lat: float | None, lon: float | None) -> str | None:
    """
    Получает название города по координатам через OpenWeather Reverse Geocoding API.
    Кэширует результат по округленным координатам.
    """
    if lat is None or lon is None or not _has_weather_api_key():
        return None

    normalized_lat, normalized_lon = normalize_coordinates(lat, lon)
    if normalized_lat is None or normalized_lon is None:
        return None

    cache_key = f"city:{format_coordinate(normalized_lat)}:{format_coordinate(normalized_lon)}"

    try:
        cached_city = await safe_get(cache_key)
        if cached_city:
            return cached_city.decode("utf-8") if isinstance(cached_city, bytes) else cached_city

        url = (
            "https://api.openweathermap.org/geo/1.0/reverse"
            f"?lat={normalized_lat}&lon={normalized_lon}&limit=1&appid={settings.OPENWEATHER_API_KEY}"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()

        if data and isinstance(data, list):
            city = data[0].get("name")
            if city:
                await safe_set(cache_key, city, ex=2592000)
                return city
    except Exception as e:
        logger.error(f"Error fetching city for {normalized_lat}, {normalized_lon}: {e}")

    return None


async def get_weather_for_date(lat: float | None, lon: float | None, target_date: date) -> dict:
    """
    Получает погоду по координатам на определенную дату.
    Если данных нет в Redis, делает запрос к OpenWeather API.
    Округляет координаты до 2 знаков для кэширования.
    Если дата в прошлом, использует Time Machine API.
    """
    if lat is None or lon is None:
        return _build_weather_payload(reason="missing_location")

    if not _has_weather_api_key():
        return _build_weather_payload(reason="missing_api_key")

    normalized_lat, normalized_lon = normalize_coordinates(lat, lon)
    if normalized_lat is None or normalized_lon is None:
        return _build_weather_payload(reason="missing_location")

    cache_key = (
        f"weather:{WEATHER_CACHE_VERSION}:{format_coordinate(normalized_lat)}:"
        f"{format_coordinate(normalized_lon)}:{target_date}"
    )

    try:
        cached_data = await safe_get(cache_key)
        if cached_data:
            parsed_cache = json.loads(cached_data)
            return _normalize_weather_payload(parsed_cache)

        target_datetime = datetime(
            target_date.year, target_date.month, target_date.day, 12, 0, 0, tzinfo=timezone.utc
        )
        target_ts = int(target_datetime.timestamp())
        today = date.today()

        temp = 0.0
        humidity = 0.0
        clouds = 0.0
        rain = 0.0
        weather_condition = ""
        weather_description = ""

        async with httpx.AsyncClient() as client:
            if target_date < today:
                url = (
                    "https://api.openweathermap.org/data/3.0/onecall/timemachine"
                    f"?lat={normalized_lat}&lon={normalized_lon}&dt={target_ts}"
                    f"&appid={settings.OPENWEATHER_API_KEY}&units=metric"
                )
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                data = response.json()

                if "data" in data and data["data"]:
                    historical = data["data"][0]
                    temp = historical.get("temp", 0.0)
                    humidity = historical.get("humidity", 0.0)
                    clouds = historical.get("clouds", 0.0)
                    rain_info = historical.get("rain", {})
                    rain = rain_info.get("1h", 0.0) if isinstance(rain_info, dict) else (rain_info or 0.0)
                    weather_list = historical.get("weather", [])
                    if weather_list:
                        weather_condition = weather_list[0].get("main", "")
                        weather_description = weather_list[0].get("description", "")
                else:
                    raise ValueError("No matching historical data in response")
            else:
                part = "minutely,hourly,alerts"
                url = (
                    "https://api.openweathermap.org/data/3.0/onecall"
                    f"?lat={normalized_lat}&lon={normalized_lon}&exclude={part}"
                    f"&appid={settings.OPENWEATHER_API_KEY}&units=metric"
                )
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                data = response.json()

                daily_entry = None
                if "daily" in data:
                    daily_list = data["daily"]
                    timezone_offset_seconds = int(data.get("timezone_offset", 0) or 0)
                    daily_entry = _select_daily_weather_entry(
                        daily_list,
                        target_date,
                        timezone_offset_seconds,
                    )

                    if not daily_entry:
                        raise ValueError("No daily weather data available")

                    temp_dict = daily_entry.get("temp", {})
                    temp = temp_dict.get("max", temp_dict.get("day", 0.0))
                    humidity = daily_entry.get("humidity", 0.0)
                    clouds = daily_entry.get("clouds", 0.0)
                    rain = daily_entry.get("rain", 0.0)
                else:
                    raise ValueError("No matching current or daily weather data in response")

                if daily_entry:
                    weather_list = daily_entry.get("weather", [])
                    if weather_list:
                        weather_condition = weather_list[0].get("main", "")
                        weather_description = weather_list[0].get("description", "")

        result = _build_weather_payload(
            temp=temp,
            humidity=humidity,
            rain=rain,
            clouds=clouds,
            weather_condition=weather_condition,
            weather_description=weather_description,
            available=True,
        )

        if target_date < today:
            cache_duration = 2592000
        elif target_date == today:
            cache_duration = 3600
        else:
            cache_duration = 10800
        await safe_set(cache_key, json.dumps(result), ex=cache_duration)
        return result
    except Exception as e:
        logger.error(
            f"Error fetching weather for {normalized_lat}, {normalized_lon} on {target_date}: {e}"
        )
        return _build_weather_payload(reason="api_error")
