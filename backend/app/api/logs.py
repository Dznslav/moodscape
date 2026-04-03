from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.models import Log, User
from app.api.deps import get_current_user

router = APIRouter()

class LogCreate(BaseModel):
    event_type: str = Field(..., max_length=45)
    description: str

class LogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    event_type: str
    description: str
    timestamp: datetime

    class Config:
        from_attributes = True

@router.post("/", response_model=LogResponse)
async def create_log(
    log_in: LogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save a user log to the existing logs table."""
    new_log = Log(
        user_id=current_user.id,
        event_type=log_in.event_type,
        description=log_in.description
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log

@router.get("/", response_model=List[LogResponse])
async def get_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve user logs."""
    result = await db.execute(
        select(Log)
        .filter(Log.user_id == current_user.id)
        .order_by(Log.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()
