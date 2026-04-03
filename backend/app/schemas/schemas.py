from datetime import date, datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    name: str = Field(..., description="User name")
    email: EmailStr = Field(..., description="User email")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="User password")


class UserResponse(UserBase):
    id: int
    created_at: datetime
    analytics_consent: bool = Field(False, description="Consent for analytics processing")

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, description="New user name")
    email: Optional[EmailStr] = Field(None, description="New user email")
    analytics_consent: Optional[bool] = Field(None, description="Consent for analytics processing")


class RecordCreate(BaseModel):
    mood: int = Field(..., ge=1, le=5, description="Mood from 1 to 5")
    energy: int = Field(..., ge=1, le=5, description="Energy from 1 to 5")
    note: Optional[str] = Field(None, description="Free-text note")
    tags: Optional[list[str]] = Field(default_factory=list, description="Selected activity tags")
    latitude: Optional[float] = Field(None, description="Latitude")
    longitude: Optional[float] = Field(None, description="Longitude")
    timestamp: Optional[datetime] = Field(None, description="Record timestamp")
    timezone: Optional[str] = Field(None, description="User timezone")


class RecordUpdate(BaseModel):
    mood: Optional[int] = Field(None, ge=1, le=5, description="Mood from 1 to 5")
    energy: Optional[int] = Field(None, ge=1, le=5, description="Energy from 1 to 5")
    note: Optional[str] = Field(None, description="Free-text note")
    tags: Optional[list[str]] = Field(None, description="Selected activity tags")


class RecordImportItem(BaseModel):
    mood: int = Field(..., ge=1, le=5, description="Mood from 1 to 5")
    energy: Optional[int] = Field(None, ge=1, le=5, description="Energy from 1 to 5. May be missing for Daylio.")
    note: Optional[str] = Field(None, description="Free-text note")
    tags: list[str] = Field(default_factory=list, description="Selected activity tags")
    timestamp: datetime = Field(..., description="Record timestamp")
    latitude: Optional[float] = Field(None, description="Latitude")
    longitude: Optional[float] = Field(None, description="Longitude")
    location_city: Optional[str] = Field(None, description="City name")
    features: Optional[Dict[str, Any]] = Field(None, description="Stored weather/calendar features")


class RecordImportRequest(BaseModel):
    source: Literal["daylio", "moodscape"] = Field(..., description="CSV source")
    overwrite_existing: bool = Field(False, description="Overwrite existing records on the same date")
    records: list[RecordImportItem] = Field(default_factory=list, min_length=1, description="Records to import")


class RecordImportResponse(BaseModel):
    source: Literal["daylio", "moodscape"]
    total: int
    imported: int
    updated: int
    skipped: int


class SleepLogCreate(BaseModel):
    hours_slept: float = Field(..., ge=0, le=16, description="Sleep duration in hours")
    sleep_quality: int = Field(..., ge=1, le=3, description="Subjective sleep quality from 1 to 3")
    timezone: Optional[str] = Field(None, description="User timezone")
    sleep_date: Optional[date] = Field(None, description="Local date of the morning this sleep belongs to")


class SleepLogUpdate(BaseModel):
    hours_slept: Optional[float] = Field(None, ge=0, le=16, description="Sleep duration in hours")
    sleep_quality: Optional[int] = Field(None, ge=1, le=3, description="Subjective sleep quality from 1 to 3")
    timezone: Optional[str] = Field(None, description="User timezone")
    sleep_date: Optional[date] = Field(None, description="Local date of the morning this sleep belongs to")


class SleepLogImportItem(BaseModel):
    hours_slept: float = Field(..., ge=0, le=16, description="Sleep duration in hours")
    sleep_quality: int = Field(..., ge=1, le=3, description="Subjective sleep quality from 1 to 3")
    sleep_date: date = Field(..., description="Local date of the morning this sleep belongs to")


class SleepLogImportRequest(BaseModel):
    overwrite_existing: bool = Field(False, description="Overwrite existing sleep logs on the same date")
    sleep_logs: list[SleepLogImportItem] = Field(
        default_factory=list,
        min_length=1,
        description="Sleep logs to import",
    )


class SleepLogImportResponse(BaseModel):
    total: int
    imported: int
    updated: int
    skipped: int


class SleepLogResponse(BaseModel):
    id: int
    user_id: int
    sleep_date: date
    hours_slept: float
    sleep_quality: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictionTimelinePoint(BaseModel):
    slot: Literal["today", "tomorrow", "day_after"] = Field(..., description="Relative day slot")
    value: float = Field(..., description="Predicted mood score for the slot")


class PredictionRequest(BaseModel):
    target_date: date = Field(..., description="Target date")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude")


class PredictionResponse(BaseModel):
    model_type: str = Field(..., description='"cold" or "warm"')
    mood_trend: str = Field("stable", description="Mood trend: rise, drop, stable")
    energy_trend: Optional[str] = Field(None, description="Energy trend: rise, drop, stable")
    mood_delta: Optional[float] = Field(None, description="Mood delta (predicted - actual)")
    energy_delta: Optional[float] = Field(None, description="Energy delta (predicted - actual)")
    weather_info: Optional[Dict[str, Any]] = Field(None, description="Weather data")
    energy_available: bool = Field(True, description="Whether energy prediction is available for this forecast")
    probabilities: Optional[Dict[str, Any]] = Field(None, description="Trend probabilities in fractions")
    mood_timeline: list[PredictionTimelinePoint] = Field(
        default_factory=list,
        description="Relative mood forecast points for today/tomorrow/day after",
    )
    prediction_metadata: Optional[Dict[str, Any]] = Field(None, description="Auxiliary metadata for UI explanations")
    mood_actual_today: Optional[float] = Field(None, description="Latest known mood score")
    mood_predicted_value: Optional[float] = Field(None, description="Predicted mood score for target date")
    energy_actual_today: Optional[float] = Field(None, description="Latest known energy score")
    energy_predicted_value: Optional[float] = Field(None, description="Predicted energy score for target date")


class RecordResponse(RecordCreate):
    id: int
    user_id: int
    location_city: Optional[str] = None
    features: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
