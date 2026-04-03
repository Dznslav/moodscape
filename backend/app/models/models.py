                              
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(45))
    email = Column(String(45), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False) 
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)                         
    analytics_consent = Column(Boolean, default=False, server_default='false', nullable=False)
    trained_model = Column(JSONB, nullable=True)                                               
    model_trained_at = Column(DateTime, nullable=True)                                   

    records = relationship("Record", back_populates="owner")
    sleep_logs = relationship("SleepLog", back_populates="user")
    logs = relationship("Log", back_populates="user")
    predictions = relationship("Prediction", back_populates="user")
    cold_predictions = relationship("ColdPrediction", back_populates="user")

class Record(Base):
    __tablename__ = "records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    mood = Column(Integer, nullable=False)    
    energy = Column(Integer, nullable=False)  
    note = Column(Text, nullable=True)        
    location_city = Column(String(100), nullable=True)
    features = Column(JSONB, nullable=True)                                                           
    tags = Column(JSONB, nullable=True)                                                     
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    owner = relationship("User", back_populates="records")

class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    target_date = Column(DateTime, index=True, nullable=False)
    model_type = Column(String(50))             
    predicted_trend = Column(Integer)
    predicted_value = Column(Float, nullable=True)
    mood_actual_today = Column(Float, nullable=True)
    energy_actual_today = Column(Float, nullable=True)
    mood_predicted_value = Column(Float, nullable=True)
    energy_predicted_value = Column(Float, nullable=True)
    mood_delta = Column(Float, nullable=True)
    energy_delta = Column(Float, nullable=True)
    mood_trend = Column(String(20), nullable=True)
    energy_trend = Column(String(20), nullable=True)
    location = Column(String(200), nullable=True)
    weather_info = Column(JSONB, nullable=True)
    probabilities = Column(JSONB, nullable=True)
    prediction_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="predictions")


class SleepLog(Base):
    __tablename__ = "sleep_logs"
    __table_args__ = (
        CheckConstraint("sleep_quality >= 1 AND sleep_quality <= 3", name="ck_sleep_logs_quality_range"),
        UniqueConstraint("user_id", "sleep_date", name="uq_sleep_logs_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    sleep_date = Column(Date, index=True, nullable=False)
    hours_slept = Column(Float, nullable=False)
    sleep_quality = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="sleep_logs")

class ColdPrediction(Base):
    __tablename__ = "cold_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    prediction_today = Column(Float, nullable=False)
    prediction_tomorrow = Column(Float, nullable=False)
    prediction_day_after = Column(Float, nullable=False)
    trend = Column(String(20), nullable=False)                            
    energy_prediction_today = Column(Float, nullable=True)
    energy_prediction_tomorrow = Column(Float, nullable=True)
    energy_trend = Column(String(20), nullable=True)
    location = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="cold_predictions")

class Log(Base):
    __tablename__ = "logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    event_type = Column(String(45))
    description = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="logs")
