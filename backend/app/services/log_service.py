from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Log


def queue_log(db: AsyncSession, user_id: int | None, event_type: str, description: str) -> None:
    db.add(
        Log(
            user_id=user_id,
            event_type=event_type[:45],
            description=description,
        )
    )
