from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.database import engine, get_db
from app.models import models
from app.api import auth, predictions, records, sleep_logs, users, weather, logs
from app.core.config import settings

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield

from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="Moodscape API",
    description="API Moodscape super mood tracking ultra mega app with ML integration",
    version="1.0.0",
    lifespan=lifespan
)

origins = [
    origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(records.router, prefix="/records", tags=["records"])
app.include_router(sleep_logs.router, prefix="/sleep-logs", tags=["sleep-logs"])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"])
app.include_router(weather.router, prefix="/weather", tags=["weather"])
app.include_router(logs.router, prefix="/logs", tags=["logs"])

@app.get("/")
async def root():
    return {"message": "Backend is working"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Backend is alive"}

@app.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Backend and DB are awake"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "error", "message": "Database error", "details": str(e)}
        )
