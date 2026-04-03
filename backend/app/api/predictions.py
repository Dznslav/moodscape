from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User
from app.schemas.schemas import PredictionRequest, PredictionResponse
from app.api.deps import get_current_user
from app.db.database import get_db
from app.services.ml_service import generate_prediction
from app.services.weather_service import get_weather_for_date

router = APIRouter()

@router.post("/tomorrow", response_model=PredictionResponse)
async def predict_tomorrow(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Эндпоинт для прогнозирования самочувствия.
    Cold Start: осторожный 3-дневный прогноз только по настроению.
    Warm Start: более личный прогноз настроения и энергии на завтра.
    """
    if not current_user.analytics_consent:
        raise HTTPException(status_code=403, detail="Analytics consent required for predictions")

    if request.latitude is None or request.longitude is None:
        raise HTTPException(status_code=400, detail="Location is required for weather-aware predictions")
        
                                                                                        
    weather_features = await get_weather_for_date(request.latitude, request.longitude, request.target_date)
    
                                                                                  
    return await generate_prediction(current_user, request, weather_features, db, background_tasks)

