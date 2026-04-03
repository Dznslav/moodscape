from fastapi import APIRouter, HTTPException
from datetime import date
from typing import Dict, Any
from app.services.weather_service import get_weather_for_date

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
async def get_weather(
    lat: float | None = None,
    lon: float | None = None,
    target_date: date = None
):
    """
    Эндпоинт для проверки работы кэширования погоды.
    """
    if target_date is None:
        target_date = date.today()

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="lat and lon are required")
        
    weather_data = await get_weather_for_date(lat, lon, target_date)
    return weather_data
