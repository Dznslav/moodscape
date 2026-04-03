import asyncio
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.logical_day import get_logical_date_for_datetime, get_logical_day_bounds
from app.core.redis import delete_by_pattern, safe_delete, safe_get, safe_set
from app.db.database import get_db
from app.models.models import Record, User
from app.schemas.schemas import (
    RecordCreate,
    RecordImportRequest,
    RecordImportResponse,
    RecordResponse,
    RecordUpdate,
)
from app.services.log_service import queue_log
from app.services.ml_service import background_retrain_task, build_all_features_dict, should_schedule_retrain
from app.services.weather_service import get_city_for_coordinates, get_weather_for_date

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo


async def invalidate_records_cache(user_id: int):
    await safe_delete(f"records:{user_id}")
    await delete_by_pattern(f"records:today:{user_id}:*")

    await delete_by_pattern(f"cold_prediction*:{user_id}:*")
    await delete_by_pattern(f"warm_prediction*:{user_id}:*")


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def _normalize_tags(values: Optional[list[str]]) -> list[str]:
    normalized = []
    seen = set()

    for value in values or []:
        cleaned = _normalize_optional_text(str(value))
        if not cleaned:
            continue

        dedupe_key = cleaned.lower()
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        normalized.append(cleaned)

    return normalized


def _normalize_import_timestamp(value: datetime) -> datetime:
    if value.tzinfo is not None and value.utcoffset() is not None:
                                                                          
                                                                                   
        return value.replace(tzinfo=None)

    return value.replace(tzinfo=None) if value.tzinfo else value


def _normalize_features(value: Optional[dict]) -> Optional[dict]:
    if not isinstance(value, dict):
        return None

    normalized = {key: feature for key, feature in value.items() if feature is not None}
    return normalized or None


def _has_weather_features(value: Optional[dict]) -> bool:
    if not isinstance(value, dict):
        return False

    return any(key in value for key in ("temp", "humidity", "rain", "clouds"))


router = APIRouter()


@router.post("/", response_model=RecordResponse)
async def create_record(
    record_in: RecordCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_tz = None
    if record_in.timezone:
        try:
            user_tz = ZoneInfo(record_in.timezone)
        except Exception:
            user_tz = None

    if record_in.timestamp:
        target_ts = _normalize_import_timestamp(record_in.timestamp)
        target_date = get_logical_date_for_datetime(target_ts)
    elif user_tz:
        now_user = datetime.now(user_tz)
        target_ts = now_user.replace(tzinfo=None)
        target_date = get_logical_date_for_datetime(now_user)
    else:
        target_ts = datetime.now()
        target_date = get_logical_date_for_datetime(target_ts)

    day_start, next_day_start = get_logical_day_bounds(target_date)
    result = await db.execute(
        select(Record).filter(
            Record.user_id == current_user.id,
            Record.timestamp >= day_start,
            Record.timestamp < next_day_start,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Record for this date already exists.",
        )

    weather_features, location_city = await asyncio.gather(
        get_weather_for_date(record_in.latitude, record_in.longitude, target_date),
        get_city_for_coordinates(record_in.latitude, record_in.longitude),
    )
    full_features = build_all_features_dict(target_date, weather_features)

    record_dict = record_in.model_dump(exclude={"latitude", "longitude", "timestamp", "timezone"})

    new_record = Record(
        **record_dict,
        user_id=current_user.id,
        features=full_features,
        location_city=location_city,
        timestamp=target_ts,
    )

    db.add(new_record)
    queue_log(
        db,
        current_user.id,
        "RECORD_CREATED",
        f"Record created for date {target_date} with mood={new_record.mood}, energy={new_record.energy}",
    )
    await db.commit()
    await db.refresh(new_record)

    result_count = await db.execute(select(func.count(Record.id)).filter(Record.user_id == current_user.id))
    total_records = result_count.scalar()

    if should_schedule_retrain(total_records):
        background_tasks.add_task(background_retrain_task, current_user.id)

    await invalidate_records_cache(current_user.id)
    return new_record


@router.post("/import", response_model=RecordImportResponse)
async def import_records(
    import_in: RecordImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Record)
        .filter(Record.user_id == current_user.id)
        .order_by(Record.timestamp.asc())
    )
    existing_records = result.scalars().all()
    records_by_day = {
        get_logical_date_for_datetime(record.timestamp): record for record in existing_records
    }

    imported = 0
    updated = 0
    skipped = 0
    has_ml_ready_features = False

    for item in import_in.records:
        target_ts = _normalize_import_timestamp(item.timestamp)
        target_date = get_logical_date_for_datetime(target_ts)
        normalized_note = _normalize_optional_text(item.note)
        normalized_tags = _normalize_tags(item.tags)
        normalized_city = _normalize_optional_text(item.location_city)
        normalized_features = _normalize_features(item.features)

        if import_in.source == "moodscape" and _has_weather_features(normalized_features):
            has_ml_ready_features = True

        existing = records_by_day.get(target_date)
        if existing and not import_in.overwrite_existing:
            skipped += 1
            continue

        if existing:
            existing.mood = item.mood
            if item.energy is not None:
                existing.energy = item.energy
            existing.note = normalized_note
            existing.tags = normalized_tags
            existing.timestamp = target_ts
            if import_in.source == "moodscape" and normalized_features is not None:
                existing.features = normalized_features
            if normalized_city is not None:
                existing.location_city = normalized_city
            updated += 1
            continue

        new_record = Record(
            user_id=current_user.id,
            mood=item.mood,
            energy=item.energy if item.energy is not None else 3,
            note=normalized_note,
            tags=normalized_tags,
            location_city=normalized_city,
            features=normalized_features if import_in.source == "moodscape" else None,
            timestamp=target_ts,
        )
        db.add(new_record)
        records_by_day[target_date] = new_record
        imported += 1

    if imported or updated:
        queue_log(
            db,
            current_user.id,
            "RECORDS_IMPORTED",
            f"Imported records batch: imported={imported}, updated={updated}, skipped={skipped}, source={import_in.source}",
        )
        await db.commit()

        result_count = await db.execute(select(func.count(Record.id)).filter(Record.user_id == current_user.id))
        total_records = result_count.scalar() or 0
        if import_in.source == "moodscape" and has_ml_ready_features and should_schedule_retrain(total_records):
            background_tasks.add_task(background_retrain_task, current_user.id)

        await invalidate_records_cache(current_user.id)

    return RecordImportResponse(
        source=import_in.source,
        total=len(import_in.records),
        imported=imported,
        updated=updated,
        skipped=skipped,
    )


@router.get("/today", response_model=Optional[RecordResponse])
async def get_today_record(
    tz: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_tz = None
    if tz:
        try:
            user_tz = ZoneInfo(tz)
        except Exception:
            user_tz = None

    if user_tz:
        now_user = datetime.now(user_tz)
        today_date = get_logical_date_for_datetime(now_user)
    else:
        today_date = get_logical_date_for_datetime(datetime.now())

    cache_key = f"records:today:{current_user.id}:{today_date.isoformat()}"
    cached = await safe_get(cache_key)
    if cached:
        return json.loads(cached)

    today_start, next_day_start = get_logical_day_bounds(today_date)
    result = await db.execute(
        select(Record).filter(
            Record.user_id == current_user.id,
            Record.timestamp >= today_start,
            Record.timestamp < next_day_start,
        )
    )
    record = result.scalar_one_or_none()

    if record:
        record_json = RecordResponse.model_validate(record).model_dump(mode="json")
        await safe_set(cache_key, json.dumps(record_json), ex=3600)

    return record


@router.put("/{record_id}", response_model=RecordResponse)
async def update_record(
    record_id: int,
    record_in: RecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Record).filter(Record.id == record_id))
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой записи")

    update_data = record_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    queue_log(
        db,
        current_user.id,
        "RECORD_UPDATED",
        f"Record {record.id} updated for date {get_logical_date_for_datetime(record.timestamp)}",
    )
    await db.commit()
    await db.refresh(record)

    await invalidate_records_cache(current_user.id)
    return record


@router.get("/", response_model=List[RecordResponse])
async def get_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"records:{current_user.id}"
    cached = await safe_get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Record)
        .filter(Record.user_id == current_user.id)
        .order_by(Record.timestamp.desc())
    )
    records = result.scalars().all()

    records_list = [RecordResponse.model_validate(record).model_dump(mode="json") for record in records]
    await safe_set(cache_key, json.dumps(records_list), ex=3600)

    return records
