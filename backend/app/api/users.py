from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.redis import delete_by_pattern, safe_delete
from app.db.database import get_db
from app.models.models import ColdPrediction, Log, Prediction, Record, SleepLog, User
from app.schemas.schemas import UserResponse, UserUpdate
from app.services.log_service import queue_log

router = APIRouter()


async def invalidate_user_account_cache(user_id: int) -> None:
    await safe_delete(f"records:{user_id}", f"sleep_logs:{user_id}")
    await delete_by_pattern(f"records:today:{user_id}:*")
    await delete_by_pattern(f"cold_prediction*:{user_id}:*")
    await delete_by_pattern(f"warm_prediction*:{user_id}:*")


async def purge_user_personal_data(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(Record).where(Record.user_id == user_id))
    await db.execute(delete(SleepLog).where(SleepLog.user_id == user_id))
    await db.execute(delete(Prediction).where(Prediction.user_id == user_id))
    await db.execute(delete(ColdPrediction).where(ColdPrediction.user_id == user_id))
    await db.execute(delete(Log).where(Log.user_id == user_id))


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_users_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields."""
    changes = []
    if data.name is not None:
        current_user.name = data.name
        changes.append("name")
    if data.email is not None:
        existing = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already used by another user.",
            )
        current_user.email = data.email
        changes.append("email")
    if data.analytics_consent is not None:
        current_user.analytics_consent = data.analytics_consent
        changes.append("analytics_consent")
    if changes:
        queue_log(
            db,
            current_user.id,
            "PROFILE_UPDATED",
            f"Profile updated fields: {', '.join(changes)}",
        )
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the current account and related personal data."""
    user_id = current_user.id

    await purge_user_personal_data(db, user_id)
    await db.delete(current_user)
    queue_log(
        db,
        None,
        "ACCOUNT_DELETED",
        "Completed account deletion and personal data purge",
    )
    await db.commit()

    await invalidate_user_account_cache(user_id)
    return None
