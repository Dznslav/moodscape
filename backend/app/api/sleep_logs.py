import json
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.logical_day import get_logical_date_for_datetime
from app.core.redis import safe_delete, safe_get, safe_set
from app.db.database import get_db
from app.models.models import SleepLog, User
from app.schemas.schemas import (
    SleepLogCreate,
    SleepLogImportRequest,
    SleepLogImportResponse,
    SleepLogResponse,
    SleepLogUpdate,
)
from app.services.log_service import queue_log

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo


router = APIRouter()


async def invalidate_sleep_logs_cache(user_id: int):
    await safe_delete(f"sleep_logs:{user_id}")


def _resolve_sleep_date(explicit_date: date | None, timezone_name: str | None) -> date:
    if explicit_date:
        return explicit_date

    if timezone_name:
        try:
            return get_logical_date_for_datetime(datetime.now(ZoneInfo(timezone_name)))
        except Exception:
            pass

    return get_logical_date_for_datetime(datetime.now())


@router.get("/", response_model=List[SleepLogResponse])
async def get_sleep_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"sleep_logs:{current_user.id}"
    cached = await safe_get(cache_key)
    if cached:
        payload = json.loads(cached)
        if payload:
            return payload
                                                                           
        await safe_delete(cache_key)

    result = await db.execute(
        select(SleepLog)
        .filter(SleepLog.user_id == current_user.id)
        .order_by(SleepLog.sleep_date.desc(), SleepLog.created_at.desc())
    )
    sleep_logs = result.scalars().all()
    payload = [SleepLogResponse.model_validate(log).model_dump(mode="json") for log in sleep_logs]
    await safe_set(cache_key, json.dumps(payload), ex=3600)
    return payload


@router.post("/", response_model=SleepLogResponse)
async def create_sleep_log(
    sleep_in: SleepLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resolved_sleep_date = _resolve_sleep_date(sleep_in.sleep_date, sleep_in.timezone)

    existing_result = await db.execute(
        select(SleepLog).filter(
            SleepLog.user_id == current_user.id,
            SleepLog.sleep_date == resolved_sleep_date,
        )
    )
    existing_log = existing_result.scalar_one_or_none()
    if existing_log:
        await invalidate_sleep_logs_cache(current_user.id)
        raise HTTPException(
            status_code=400,
            detail="Sleep log for this day already exists. Use edit instead.",
        )

    sleep_log = SleepLog(
        user_id=current_user.id,
        sleep_date=resolved_sleep_date,
        hours_slept=sleep_in.hours_slept,
        sleep_quality=sleep_in.sleep_quality,
    )

    db.add(sleep_log)
    queue_log(
        db,
        current_user.id,
        "SLEEP_LOG_CREATED",
        f"Sleep log created for date {resolved_sleep_date} with hours={sleep_log.hours_slept}, quality={sleep_log.sleep_quality}",
    )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Sleep log for this day already exists. Use edit instead.",
        )

    await db.refresh(sleep_log)
    await invalidate_sleep_logs_cache(current_user.id)
    return sleep_log


@router.post("/import", response_model=SleepLogImportResponse)
async def import_sleep_logs(
    import_in: SleepLogImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SleepLog)
        .filter(SleepLog.user_id == current_user.id)
        .order_by(SleepLog.sleep_date.asc(), SleepLog.created_at.asc())
    )
    existing_logs = result.scalars().all()
    logs_by_date = {log.sleep_date: log for log in existing_logs}

    imported = 0
    updated = 0
    skipped = 0

    for item in import_in.sleep_logs:
        existing = logs_by_date.get(item.sleep_date)

        if existing and not import_in.overwrite_existing:
            skipped += 1
            continue

        if existing:
            existing.hours_slept = item.hours_slept
            existing.sleep_quality = item.sleep_quality
            updated += 1
            continue

        new_sleep_log = SleepLog(
            user_id=current_user.id,
            sleep_date=item.sleep_date,
            hours_slept=item.hours_slept,
            sleep_quality=item.sleep_quality,
        )
        db.add(new_sleep_log)
        logs_by_date[item.sleep_date] = new_sleep_log
        imported += 1

    if imported or updated:
        queue_log(
            db,
            current_user.id,
            "SLEEP_LOGS_IMPORTED",
            f"Imported sleep logs batch: imported={imported}, updated={updated}, skipped={skipped}",
        )
        await db.commit()
        await invalidate_sleep_logs_cache(current_user.id)

    return SleepLogImportResponse(
        total=len(import_in.sleep_logs),
        imported=imported,
        updated=updated,
        skipped=skipped,
    )


@router.put("/{sleep_log_id}", response_model=SleepLogResponse)
async def update_sleep_log(
    sleep_log_id: int,
    sleep_in: SleepLogUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SleepLog).filter(SleepLog.id == sleep_log_id))
    sleep_log = result.scalar_one_or_none()

    if not sleep_log:
        raise HTTPException(status_code=404, detail="Sleep log not found")

    if sleep_log.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No access to this sleep log")

    next_sleep_date = (
        _resolve_sleep_date(sleep_in.sleep_date, sleep_in.timezone)
        if sleep_in.sleep_date is not None
        else sleep_log.sleep_date
    )

    if next_sleep_date != sleep_log.sleep_date:
        existing_result = await db.execute(
            select(SleepLog).filter(
                SleepLog.user_id == current_user.id,
                SleepLog.sleep_date == next_sleep_date,
                SleepLog.id != sleep_log.id,
            )
        )
        existing_log = existing_result.scalar_one_or_none()
        if existing_log:
            await invalidate_sleep_logs_cache(current_user.id)
            raise HTTPException(
                status_code=400,
                detail="Sleep log for this day already exists. Use edit instead.",
            )
        sleep_log.sleep_date = next_sleep_date

    update_data = sleep_in.model_dump(exclude_unset=True, exclude={"sleep_date", "timezone"})
    for field, value in update_data.items():
        setattr(sleep_log, field, value)

    queue_log(
        db,
        current_user.id,
        "SLEEP_LOG_UPDATED",
        f"Sleep log {sleep_log.id} updated for date {sleep_log.sleep_date}",
    )
    await db.commit()
    await db.refresh(sleep_log)
    await invalidate_sleep_logs_cache(current_user.id)
    return sleep_log
