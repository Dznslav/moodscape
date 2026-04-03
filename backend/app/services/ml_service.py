import asyncio
import json
import logging
import math
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import BackgroundTasks, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.coordinates import format_coordinate, format_coordinate_pair
from app.core.redis import safe_delete, safe_get, safe_set
from app.models.models import ColdPrediction, Prediction, Record, User
from app.schemas.schemas import PredictionRequest, PredictionResponse
from app.services.log_service import queue_log

logger = logging.getLogger(__name__)


def _build_signal_feature_names(signal: str) -> list[str]:
    return [
        signal,
        f"{signal}_yesterday",
        f"{signal}_3d_avg",
        f"{signal}_7d_avg",
        f"{signal}_14d_avg",
        f"{signal}_momentum",
        f"{signal}_volatility_7d",
        f"{signal}_volatility_14d",
        f"{signal}_change_1d",
        f"{signal}_3v7_gap",
        f"{signal}_7v14_gap",
    ]


                                 
MOOD_FEATURES = ["day_of_week", "is_weekend", "month", "season", "temp", "rain", "humidity", "clouds"]
ENERGY_FEATURES = ["day_of_week", "is_weekend", "month", "season", "temp_cat", "humidity_cat", "clouds_cat", "rain_cat"]

                                   
PERSONAL_CONTEXT_FEATURES = [
    "day_of_week",
    "is_weekend",
    "month",
    "season",
    "temp_tom",
    "rain_tom",
    "humidity_tom",
    "clouds_tom",
    "temp_cat_tom",
    "humidity_cat_tom",
    "clouds_cat_tom",
    "rain_cat_tom",
    "temp_delta_tom",
    "rain_delta_tom",
    "humidity_delta_tom",
    "clouds_delta_tom",
]
PERSONAL_MOOD_FEATURES = _build_signal_feature_names("mood") + PERSONAL_CONTEXT_FEATURES
PERSONAL_ENERGY_FEATURES = _build_signal_feature_names("energy") + PERSONAL_CONTEXT_FEATURES

ML_DIR = Path(__file__).resolve().parent.parent / "ml"
RAW_WEATHER_KEYS = ("temp", "rain", "humidity", "clouds")
WARM_START_MIN_RECORDS = 30
RETRAIN_INTERVAL = 30
DELTA_THRESHOLD = 0.25
WARM_BASE_THRESHOLD = 0.20
COLD_MOOD_TREND_THRESHOLD = 0.10
COLD_ENERGY_TREND_THRESHOLD = 0.05
COLD_STEP_EPSILON = 0.05
COLD_DOUBLE_DELTA_THRESHOLD = 0.30
WARM_EDGE_NEAR_DISTANCE = 0.35
WARM_EDGE_MID_DISTANCE = 0.85
WARM_EDGE_NEAR_SCALE = 0.60
WARM_EDGE_MID_SCALE = 0.80
MIN_WARM_TREND_THRESHOLD = 0.12
MODEL_VERSION = "next_value_regression_v3"
FEATURE_SCHEMA_VERSION = "next_value_regression_features_v3"
RESIDUAL_SIGMA_EPSILON = 1e-6
COLD_PREDICTION_CACHE_VERSION = "v5"
WARM_PREDICTION_CACHE_VERSION = "v5"
PERSONAL_MODEL_PARAMS = {
    "objective": "reg:squarederror",
    "max_depth": 3,
    "learning_rate": 0.03,
    "n_estimators": 250,
    "subsample": 0.90,
    "colsample_bytree": 0.90,
    "min_child_weight": 5,
    "gamma": 1.0,
    "reg_alpha": 0.2,
    "reg_lambda": 3.0,
    "random_state": 42,
}


         

def _should_use_cached_prediction(payload: dict) -> bool:
    weather_info = payload.get("weather_info")

    if not isinstance(weather_info, dict):
        return True

    if weather_info.get("available") is False:
        return False

    if weather_info.get("reason") in {"missing_api_key", "api_error", "missing_location"}:
        return False

    return True


def _build_prediction_cache_key(prefix: str, user_id: int, request: PredictionRequest) -> str:
    lat_key = format_coordinate(request.latitude)
    lon_key = format_coordinate(request.longitude)
    return f"{prefix}:{user_id}:{request.target_date.isoformat()}:{lat_key}:{lon_key}"


def get_season(month: int) -> int:
    if month in [12, 1, 2]:
        return 1
    if month in [3, 4, 5]:
        return 2
    if month in [6, 7, 8]:
        return 3
    return 4


def _categorize_temp(temp: float) -> int:
    """1=cold (<10C), 2=moderate (10-25C), 3=hot (>25C)."""
    if temp < 10:
        return 1
    if temp <= 25:
        return 2
    return 3


def _categorize_humidity(humidity: float) -> int:
    """1=dry (<40%), 2=normal (40-70%), 3=humid (>70%)."""
    if humidity < 40:
        return 1
    if humidity <= 70:
        return 2
    return 3


def _categorize_clouds(clouds: float) -> int:
    """1=clear (<30%), 2=partly (30-70%), 3=overcast (>70%)."""
    if clouds < 30:
        return 1
    if clouds <= 70:
        return 2
    return 3


def _categorize_rain(rain: float) -> int:
    """0=none, 1=light (<2.5mm), 2=moderate/heavy (>=2.5mm)."""
    if rain <= 0:
        return 0
    if rain < 2.5:
        return 1
    return 2


def build_all_features_dict(target_date: date, weather: dict) -> dict:
    """Build a combined dictionary of calendar and weather features."""
    return {
        "day_of_week": target_date.weekday(),
        "is_weekend": int(target_date.weekday() >= 5),
        "month": target_date.month,
        "season": get_season(target_date.month),
        "temp": float(weather.get("temp", 0.0) or 0.0),
        "humidity": float(weather.get("humidity", 0.0) or 0.0),
        "rain": float(weather.get("rain", 0.0) or 0.0),
        "clouds": float(weather.get("clouds", 0.0) or 0.0),
        "temp_cat": _categorize_temp(float(weather.get("temp", 0.0) or 0.0)),
        "humidity_cat": _categorize_humidity(float(weather.get("humidity", 0.0) or 0.0)),
        "clouds_cat": _categorize_clouds(float(weather.get("clouds", 0.0) or 0.0)),
        "rain_cat": _categorize_rain(float(weather.get("rain", 0.0) or 0.0)),
    }


def _build_mood_features(target_date: date, weather: dict) -> pd.DataFrame:
    """Legacy global mood model features."""
    row = build_all_features_dict(target_date, weather)
    df = pd.DataFrame([row])
    for col in MOOD_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    df = df[MOOD_FEATURES]
    df.fillna(0.0, inplace=True)
    return df


def _build_energy_features(target_date: date, weather: dict) -> pd.DataFrame:
    """Legacy global energy model features."""
    row = build_all_features_dict(target_date, weather)
    df = pd.DataFrame([row])
    for col in ENERGY_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    df = df[ENERGY_FEATURES]
    df.fillna(0.0, inplace=True)
    return df


def _clip_score(value: float) -> float:
    return max(1.0, min(5.0, float(value)))


def _round_score(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def _compute_trend(delta: float, threshold: float = DELTA_THRESHOLD) -> str:
    if delta <= -threshold:
        return "drop"
    if delta >= threshold:
        return "rise"
    return "stable"


def _compute_warm_effective_threshold(actual_today: float, base_threshold: float) -> float:
    clipped_today = _clip_score(actual_today)
    distance_to_edge = min(clipped_today - 1.0, 5.0 - clipped_today)
    threshold = max(float(base_threshold), RESIDUAL_SIGMA_EPSILON)

    if distance_to_edge <= WARM_EDGE_NEAR_DISTANCE:
        return max(MIN_WARM_TREND_THRESHOLD, threshold * WARM_EDGE_NEAR_SCALE)

    if distance_to_edge <= WARM_EDGE_MID_DISTANCE:
        return max(MIN_WARM_TREND_THRESHOLD, threshold * WARM_EDGE_MID_SCALE)

    return threshold


def _compute_cold_window_trend(pred_today: float, pred_tomorrow: float, pred_day_after: float) -> tuple[str, float]:
    first_step = pred_tomorrow - pred_today
    second_step = pred_day_after - pred_tomorrow
    double_delta = pred_day_after - pred_today

    if (
        first_step <= -COLD_STEP_EPSILON
        and second_step <= -COLD_STEP_EPSILON
        and double_delta <= -COLD_DOUBLE_DELTA_THRESHOLD
    ):
        return "drop", double_delta

    if (
        first_step >= COLD_STEP_EPSILON
        and second_step >= COLD_STEP_EPSILON
        and double_delta >= COLD_DOUBLE_DELTA_THRESHOLD
    ):
        return "rise", double_delta

    return "stable", double_delta


def should_schedule_retrain(record_count: int) -> bool:
    return record_count >= WARM_START_MIN_RECORDS and record_count % RETRAIN_INTERVAL == 0


def _latest_retrain_milestone(record_count: int) -> int:
    if record_count < WARM_START_MIN_RECORDS:
        return 0
    return (record_count // RETRAIN_INTERVAL) * RETRAIN_INTERVAL


def _should_retrain(user: User, current_record_count: int) -> bool:
    if current_record_count < WARM_START_MIN_RECORDS:
        return False

    stored_payload = user.trained_model if isinstance(user.trained_model, dict) else {}
    if stored_payload.get("model_version") != MODEL_VERSION:
        return True

    stored_count = int(stored_payload.get("record_count", 0) or 0)
    return stored_count < _latest_retrain_milestone(current_record_count)


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _coerce_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            logger.warning("Falling back to utcnow() for unparsable timestamp: %s", value)
    return datetime.utcnow()


def _extract_history_weather(features: Any) -> dict[str, float]:
    payload = features if isinstance(features, dict) else {}
    return {key: _coerce_float(payload.get(key, 0.0)) for key in RAW_WEATHER_KEYS}


def _build_history_frame(records: list[Record]) -> pd.DataFrame:
    rows = []
    for record in records:
        ts = _coerce_timestamp(record.timestamp)
        weather = _extract_history_weather(record.features)
        rows.append(
            {
                "record_date": pd.Timestamp(ts.date()),
                "mood": _coerce_float(record.mood),
                "energy": _coerce_float(record.energy),
                **weather,
            }
        )

    if not rows:
        return pd.DataFrame(columns=["record_date", "mood", "energy", *RAW_WEATHER_KEYS])

    df = pd.DataFrame(rows)
    df = df.sort_values("record_date").drop_duplicates(subset=["record_date"], keep="last").reset_index(drop=True)
    return df


def _add_signal_history_features(df: pd.DataFrame, signal: str) -> pd.DataFrame:
    signal_series = df[signal].astype(float)
    signal_yesterday = signal_series.shift(1)

    df[f"{signal}_yesterday"] = signal_yesterday.fillna(signal_series)
    df[f"{signal}_3d_avg"] = signal_series.rolling(window=3, min_periods=1).mean()
    df[f"{signal}_7d_avg"] = signal_series.rolling(window=7, min_periods=1).mean()
    df[f"{signal}_14d_avg"] = signal_series.rolling(window=14, min_periods=1).mean()
    df[f"{signal}_momentum"] = signal_series - df[f"{signal}_7d_avg"]
    df[f"{signal}_volatility_7d"] = signal_series.rolling(window=7, min_periods=1).std(ddof=0).fillna(0.0)
    df[f"{signal}_volatility_14d"] = signal_series.rolling(window=14, min_periods=1).std(ddof=0).fillna(0.0)
    df[f"{signal}_change_1d"] = (signal_series - signal_yesterday).fillna(0.0)
    df[f"{signal}_3v7_gap"] = df[f"{signal}_3d_avg"] - df[f"{signal}_7d_avg"]
    df[f"{signal}_7v14_gap"] = df[f"{signal}_7d_avg"] - df[f"{signal}_14d_avg"]
    return df


def _add_tomorrow_training_features(df: pd.DataFrame) -> pd.DataFrame:
    next_record_date = df["record_date"].shift(-1)
    temp_tom = df["temp"].shift(-1).fillna(0.0)
    rain_tom = df["rain"].shift(-1).fillna(0.0)
    humidity_tom = df["humidity"].shift(-1).fillna(0.0)
    clouds_tom = df["clouds"].shift(-1).fillna(0.0)

    df["next_record_date"] = next_record_date
    df["day_of_week"] = next_record_date.dt.weekday.fillna(0).astype(int)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["month"] = next_record_date.dt.month.fillna(0).astype(int)
    df["season"] = df["month"].apply(lambda month: get_season(int(month)) if month else 0)
    df["temp_tom"] = temp_tom
    df["rain_tom"] = rain_tom
    df["humidity_tom"] = humidity_tom
    df["clouds_tom"] = clouds_tom
    df["temp_cat_tom"] = temp_tom.apply(_categorize_temp)
    df["humidity_cat_tom"] = humidity_tom.apply(_categorize_humidity)
    df["clouds_cat_tom"] = clouds_tom.apply(_categorize_clouds)
    df["rain_cat_tom"] = rain_tom.apply(_categorize_rain)
    df["temp_delta_tom"] = temp_tom - df["temp"]
    df["rain_delta_tom"] = rain_tom - df["rain"]
    df["humidity_delta_tom"] = humidity_tom - df["humidity"]
    df["clouds_delta_tom"] = clouds_tom - df["clouds"]
    return df


def _build_tomorrow_context_dict(target_date: date, weather_tomorrow: dict, current_weather: dict[str, float]) -> dict[str, float]:
    tomorrow_features = build_all_features_dict(target_date, weather_tomorrow)
    temp_tom = tomorrow_features["temp"]
    rain_tom = tomorrow_features["rain"]
    humidity_tom = tomorrow_features["humidity"]
    clouds_tom = tomorrow_features["clouds"]

    return {
        "day_of_week": tomorrow_features["day_of_week"],
        "is_weekend": tomorrow_features["is_weekend"],
        "month": tomorrow_features["month"],
        "season": tomorrow_features["season"],
        "temp_tom": temp_tom,
        "rain_tom": rain_tom,
        "humidity_tom": humidity_tom,
        "clouds_tom": clouds_tom,
        "temp_cat_tom": tomorrow_features["temp_cat"],
        "humidity_cat_tom": tomorrow_features["humidity_cat"],
        "clouds_cat_tom": tomorrow_features["clouds_cat"],
        "rain_cat_tom": tomorrow_features["rain_cat"],
        "temp_delta_tom": temp_tom - _coerce_float(current_weather.get("temp", 0.0)),
        "rain_delta_tom": rain_tom - _coerce_float(current_weather.get("rain", 0.0)),
        "humidity_delta_tom": humidity_tom - _coerce_float(current_weather.get("humidity", 0.0)),
        "clouds_delta_tom": clouds_tom - _coerce_float(current_weather.get("clouds", 0.0)),
    }


def _build_personal_training_frame(records: list[Record], signal: str, feature_names: list[str]) -> pd.DataFrame:
    history_df = _build_history_frame(records)
    if len(history_df) < 2:
        return pd.DataFrame(columns=[*feature_names, f"target_{signal}_next", f"target_{signal}_delta"])

    train_df = _add_signal_history_features(history_df.copy(), signal)
    train_df = _add_tomorrow_training_features(train_df)
    train_df[f"target_{signal}_next"] = train_df[signal].shift(-1)
    train_df[f"target_{signal}_delta"] = train_df[f"target_{signal}_next"] - train_df[signal]
    train_df["is_consecutive_next"] = (
        (train_df["next_record_date"] - train_df["record_date"]).dt.days == 1
    ).fillna(False)
    train_df = train_df[train_df["is_consecutive_next"]].copy()

    for feature_name in feature_names:
        if feature_name not in train_df.columns:
            train_df[feature_name] = 0.0

    if train_df.empty:
        return pd.DataFrame(columns=[*feature_names, f"target_{signal}_next", f"target_{signal}_delta"])

    train_df[feature_names] = train_df[feature_names].fillna(0.0)
    train_df[f"target_{signal}_next"] = train_df[f"target_{signal}_next"].fillna(train_df[signal])
    train_df[f"target_{signal}_delta"] = train_df[f"target_{signal}_delta"].fillna(0.0)
    return train_df


def _build_personal_prediction_frame(
    records: list[Record],
    signal: str,
    feature_names: list[str],
    target_date: date,
    weather_tomorrow: dict,
) -> pd.DataFrame:
    history_df = _build_history_frame(records)
    if history_df.empty:
        raise ValueError("Cannot build personal prediction features without history.")

    feature_df = _add_signal_history_features(history_df.copy(), signal)
    latest_row = feature_df.iloc[-1].to_dict()
    tomorrow_context = _build_tomorrow_context_dict(target_date, weather_tomorrow, history_df.iloc[-1].to_dict())
    latest_row.update(tomorrow_context)

    payload = {feature_name: latest_row.get(feature_name, 0.0) for feature_name in feature_names}
    return pd.DataFrame([payload]).fillna(0.0)


def _compute_residual_sigma(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    residuals = np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float)
    if residuals.size == 0:
        return RESIDUAL_SIGMA_EPSILON

    sigma = float(np.std(residuals))
    if not math.isfinite(sigma) or sigma < RESIDUAL_SIGMA_EPSILON:
        return RESIDUAL_SIGMA_EPSILON
    return sigma


def _build_model_diagnostics(model: xgb.XGBRegressor, feature_names: list[str]) -> dict[str, Any]:
    booster = model.get_booster()
    gain_scores = booster.get_score(importance_type="gain")
    importance_by_feature = {feature_name: float(gain_scores.get(feature_name, 0.0)) for feature_name in feature_names}
    top_features = [
        {"feature": feature_name, "gain": gain}
        for feature_name, gain in sorted(
            importance_by_feature.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
    ]
    return {
        "feature_gain": importance_by_feature,
        "top_features": top_features,
    }


def _normal_cdf(x: float, mean: float, sigma: float) -> float:
    sigma = max(float(sigma), RESIDUAL_SIGMA_EPSILON)
    z_score = (float(x) - float(mean)) / (sigma * math.sqrt(2.0))
    return 0.5 * (1.0 + math.erf(z_score))


def _compute_delta_probabilities(predicted_delta: float, residual_sigma: float, threshold: float) -> dict[str, float]:
    p_drop = _normal_cdf(-threshold, predicted_delta, residual_sigma)
    p_rise = 1.0 - _normal_cdf(threshold, predicted_delta, residual_sigma)
    p_drop = min(max(p_drop, 0.0), 1.0)
    p_rise = min(max(p_rise, 0.0), 1.0)
    p_stable = min(max(1.0 - p_drop - p_rise, 0.0), 1.0)
    return {
        "drop": p_drop,
        "stable": p_stable,
        "rise": p_rise,
    }


def _train_personal_signal_model(records: list[Record], signal: str, feature_names: list[str]) -> dict[str, Any]:
    train_df = _build_personal_training_frame(records, signal, feature_names)
    if train_df.empty:
        raise ValueError(f"Not enough consecutive history to train {signal} next-day model.")

    target_name = f"target_{signal}_next"
    X_train = train_df[feature_names]
    y_train = train_df[target_name].astype(float)

    model = xgb.XGBRegressor(**PERSONAL_MODEL_PARAMS)
    model.fit(X_train, y_train)

    train_predictions = model.predict(X_train)
    residual_sigma = _compute_residual_sigma(y_train.to_numpy(), train_predictions)
    diagnostics = _build_model_diagnostics(model, feature_names)
    logger.debug("Personal %s diagnostics: %s", signal, diagnostics["top_features"])

    return {
        "model": model,
        "residual_sigma": residual_sigma,
        "train_rows": len(train_df),
        "diagnostics": diagnostics,
    }


def _train_personal_model_bundle(records: list[Record]) -> dict[str, Any]:
    mood_bundle = _train_personal_signal_model(records, "mood", PERSONAL_MOOD_FEATURES)
    energy_bundle = _train_personal_signal_model(records, "energy", PERSONAL_ENERGY_FEATURES)
    return {
        "mood_model": mood_bundle["model"],
        "energy_model": energy_bundle["model"],
        "record_count": len(records),
        "mood_threshold": WARM_BASE_THRESHOLD,
        "energy_threshold": WARM_BASE_THRESHOLD,
        "mood_residual_sigma": mood_bundle["residual_sigma"],
        "energy_residual_sigma": energy_bundle["residual_sigma"],
        "model_version": MODEL_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "diagnostics": {
            "mood": mood_bundle["diagnostics"],
            "energy": energy_bundle["diagnostics"],
        },
    }


                   

def _serialize_model(model: xgb.XGBRegressor) -> str:
    return model.get_booster().save_raw("json").decode("utf-8")


def _save_models_to_user(user: User, bundle: dict[str, Any]) -> None:
    user.trained_model = {
        "mood_model": _serialize_model(bundle["mood_model"]),
        "energy_model": _serialize_model(bundle["energy_model"]),
        "record_count": int(bundle["record_count"]),
        "mood_threshold": float(bundle["mood_threshold"]),
        "energy_threshold": float(bundle["energy_threshold"]),
        "mood_residual_sigma": float(bundle["mood_residual_sigma"]),
        "energy_residual_sigma": float(bundle["energy_residual_sigma"]),
        "model_version": bundle["model_version"],
        "feature_schema_version": bundle["feature_schema_version"],
    }
    user.model_trained_at = datetime.utcnow()


def _load_model_from_json(model_json: str) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor()
    model.load_model(bytearray(model_json.encode("utf-8")))
    return model


def _load_personal_bundle_from_user(user: User) -> dict[str, Any] | None:
    payload = user.trained_model if isinstance(user.trained_model, dict) else None
    if not payload or payload.get("model_version") != MODEL_VERSION:
        return None

    mood_model_json = payload.get("mood_model")
    energy_model_json = payload.get("energy_model")
    if not mood_model_json or not energy_model_json:
        return None

    try:
        return {
            "mood_model": _load_model_from_json(mood_model_json),
            "energy_model": _load_model_from_json(energy_model_json),
            "record_count": int(payload.get("record_count", 0) or 0),
            "mood_threshold": float(payload.get("mood_threshold", WARM_BASE_THRESHOLD) or WARM_BASE_THRESHOLD),
            "energy_threshold": float(payload.get("energy_threshold", WARM_BASE_THRESHOLD) or WARM_BASE_THRESHOLD),
            "mood_residual_sigma": max(
                _coerce_float(payload.get("mood_residual_sigma", RESIDUAL_SIGMA_EPSILON)),
                RESIDUAL_SIGMA_EPSILON,
            ),
            "energy_residual_sigma": max(
                _coerce_float(payload.get("energy_residual_sigma", RESIDUAL_SIGMA_EPSILON)),
                RESIDUAL_SIGMA_EPSILON,
            ),
            "model_version": payload.get("model_version"),
            "feature_schema_version": payload.get("feature_schema_version"),
        }
    except Exception:
        logger.exception("Failed to load personal v3 model bundle for user %s", user.id)
        return None


def _load_first_available_global_model(candidate_names: list[str]) -> xgb.XGBRegressor | None:
    last_error = None

    for candidate_name in candidate_names:
        candidate_path = ML_DIR / candidate_name
        if not candidate_path.exists():
            continue

        try:
            model = xgb.XGBRegressor()
            model.load_model(str(candidate_path))
            return model
        except Exception as exc:
            last_error = exc
            logger.exception("Failed to load global model from %s", candidate_path)

    if last_error:
        raise last_error
    return None


def _build_neutral_signal_prediction(actual_today: float) -> dict[str, Any]:
    return {
        "predicted_delta": 0.0,
        "predicted_tomorrow": _clip_score(actual_today),
        "trend": _compute_trend(0.0),
        "probabilities": {"drop": 0.0, "stable": 1.0, "rise": 0.0},
    }


def _build_prediction_metadata(
    model_bundle: dict[str, Any] | None,
    history_len: int,
    fallback_mode: str | None = None,
) -> dict[str, Any]:
    bundle = model_bundle or {}
    mood_residual_sigma = bundle.get("mood_residual_sigma")
    energy_residual_sigma = bundle.get("energy_residual_sigma")

    metadata = {
        "model_version": bundle.get("model_version", MODEL_VERSION),
        "feature_schema_version": bundle.get("feature_schema_version", FEATURE_SCHEMA_VERSION),
        "mood_threshold": float(bundle.get("mood_threshold", WARM_BASE_THRESHOLD)),
        "energy_threshold": float(bundle.get("energy_threshold", WARM_BASE_THRESHOLD)),
        "mood_residual_sigma": float(mood_residual_sigma) if mood_residual_sigma is not None else None,
        "energy_residual_sigma": float(energy_residual_sigma) if energy_residual_sigma is not None else None,
        "record_count": int(bundle.get("record_count", history_len)),
    }
    if fallback_mode:
        metadata["fallback_mode"] = fallback_mode
    return metadata


def _build_cold_prediction_metadata(history_len: int, mood_delta: float, energy_available: bool) -> dict[str, Any]:
    return {
        "record_count": int(history_len),
        "signal": "mood+energy",
        "mood_delta": float(mood_delta),
        "energy_available": energy_available,
        "message_tone": "cautious",
    }


def _build_warm_prediction_record_payload(
    *,
    user_id: int,
    request: PredictionRequest,
    actual_mood: float,
    actual_energy: float,
    mood_prediction: dict[str, Any],
    energy_prediction: dict[str, Any],
    weather_tomorrow: dict,
    model_bundle: dict[str, Any] | None,
    history_len: int,
    fallback_mode: str | None = None,
) -> dict[str, Any]:
    mood_trend = str(mood_prediction["trend"])
    energy_trend = str(energy_prediction["trend"])
    mood_predicted_value = float(mood_prediction["predicted_tomorrow"])
    energy_predicted_value = float(energy_prediction["predicted_tomorrow"])
    prediction_metadata = _build_prediction_metadata(model_bundle, history_len, fallback_mode)
    prediction_metadata["warm_trend_mode"] = "bounded_next_value_edge_aware_v1"
    prediction_metadata["mood_effective_threshold"] = float(
        mood_prediction.get("effective_threshold", prediction_metadata["mood_threshold"])
    )
    prediction_metadata["energy_effective_threshold"] = float(
        energy_prediction.get("effective_threshold", prediction_metadata["energy_threshold"])
    )

    return {
        "user_id": user_id,
        "target_date": request.target_date,
        "model_type": "warm",
        "predicted_trend": {"rise": 1, "drop": -1, "stable": 0}[mood_trend],
        "predicted_value": mood_predicted_value,
        "mood_actual_today": float(actual_mood),
        "energy_actual_today": float(actual_energy),
        "mood_predicted_value": mood_predicted_value,
        "energy_predicted_value": energy_predicted_value,
        "mood_delta": float(mood_prediction["predicted_delta"]),
        "energy_delta": float(energy_prediction["predicted_delta"]),
        "mood_trend": mood_trend,
        "energy_trend": energy_trend,
        "location": format_coordinate_pair(request.latitude, request.longitude),
        "weather_info": weather_tomorrow,
        "probabilities": {
            "mood": {label: float(value) for label, value in (mood_prediction.get("probabilities") or {}).items()},
            "energy": {label: float(value) for label, value in (energy_prediction.get("probabilities") or {}).items()},
        },
        "prediction_metadata": prediction_metadata,
    }


def _finalize_warm_signal_prediction(
    actual_today: float,
    raw_predicted_tomorrow: float,
    threshold: float,
    residual_sigma: float,
) -> dict[str, Any]:
    predicted_tomorrow = _clip_score(float(raw_predicted_tomorrow))
    predicted_delta = predicted_tomorrow - float(actual_today)
    effective_threshold = _compute_warm_effective_threshold(actual_today, threshold)
    probabilities = _compute_delta_probabilities(predicted_delta, residual_sigma, effective_threshold)
    return {
        "predicted_delta": predicted_delta,
        "predicted_tomorrow": predicted_tomorrow,
        "trend": _compute_trend(predicted_delta, effective_threshold),
        "effective_threshold": effective_threshold,
        "probabilities": probabilities,
    }


def _predict_personal_signal(
    records: list[Record],
    signal: str,
    feature_names: list[str],
    model: xgb.XGBRegressor,
    actual_today: float,
    target_date: date,
    weather_tomorrow: dict,
    threshold: float,
    residual_sigma: float,
) -> dict[str, Any]:
    X_pred = _build_personal_prediction_frame(records, signal, feature_names, target_date, weather_tomorrow)
    return _finalize_warm_signal_prediction(
        actual_today=actual_today,
        raw_predicted_tomorrow=float(model.predict(X_pred)[0]),
        threshold=threshold,
        residual_sigma=residual_sigma,
    )


def _predict_global_signal_for_date(
    model: xgb.XGBRegressor | None,
    target_date: date,
    weather: dict,
    feature_builder,
    fallback_value: float,
) -> float:
    if model is None:
        return _clip_score(fallback_value)

    features = feature_builder(target_date, weather)
    return _clip_score(float(model.predict(features)[0]))


def _run_cold_start_prediction(
    anchor_date: date,
    target_date: date,
    day_after_date: date,
    weather_today: dict,
    weather_tomorrow: dict,
    weather_day_after: dict,
    history_len: int,
) -> tuple[dict[str, Any], float, float, float]:
    mood_model = _load_first_available_global_model(["global_mood_model.json", "global_model.json"])
    if mood_model is None:
        raise HTTPException(status_code=500, detail="Global mood model is not available.")

    energy_model = _load_first_available_global_model(["global_energy_model.json"])

    pred_mood_today = _predict_global_signal_for_date(
        mood_model,
        anchor_date,
        weather_today,
        _build_mood_features,
        fallback_value=3.0,
    )
    pred_mood_tomorrow = _predict_global_signal_for_date(
        mood_model,
        target_date,
        weather_tomorrow,
        _build_mood_features,
        fallback_value=pred_mood_today,
    )
    pred_mood_day_after = _predict_global_signal_for_date(
        mood_model,
        day_after_date,
        weather_day_after,
        _build_mood_features,
        fallback_value=pred_mood_tomorrow,
    )

                                                                         
    mood_delta = pred_mood_tomorrow - pred_mood_today
    mood_trend = _compute_trend(mood_delta, COLD_MOOD_TREND_THRESHOLD)

                                       
    energy_has_model = energy_model is not None
    pred_energy_today = _predict_global_signal_for_date(
        energy_model,
        anchor_date,
        weather_today,
        _build_energy_features,
        fallback_value=3.0,
    )
    pred_energy_tomorrow = _predict_global_signal_for_date(
        energy_model,
        target_date,
        weather_tomorrow,
        _build_energy_features,
        fallback_value=pred_energy_today,
    )

    energy_delta = pred_energy_tomorrow - pred_energy_today
    energy_trend = _compute_trend(energy_delta, COLD_ENERGY_TREND_THRESHOLD) if energy_has_model else None

    response_data = {
        "model_type": "cold",
        "mood_trend": mood_trend,
        "energy_trend": energy_trend,
        "mood_delta": round(mood_delta, 3),
        "energy_delta": round(energy_delta, 3) if energy_has_model else None,
        "weather_info": weather_tomorrow,
        "energy_available": energy_has_model,
        "probabilities": None,
        "mood_timeline": [
            {"slot": "today", "value": _round_score(pred_mood_today)},
            {"slot": "tomorrow", "value": _round_score(pred_mood_tomorrow)},
            {"slot": "day_after", "value": _round_score(pred_mood_day_after)},
        ],
        "prediction_metadata": _build_cold_prediction_metadata(history_len, mood_delta, energy_has_model),
        "mood_predicted_value": _round_score(pred_mood_tomorrow),
        "energy_predicted_value": _round_score(pred_energy_tomorrow) if energy_has_model else None,
        "mood_actual_today": None,
        "energy_actual_today": None,
    }
    return response_data, pred_mood_today, pred_mood_tomorrow, pred_mood_day_after, pred_energy_today, pred_energy_tomorrow


async def background_retrain_task(user_id: int):
    """Background task that refreshes personal next-day warm models."""
    from app.db.database import SessionLocal

    async with SessionLocal() as db:
        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.analytics_consent:
            return

        result_rec = await db.execute(
            select(Record).filter(Record.user_id == user_id).order_by(Record.timestamp.asc())
        )
        records = result_rec.scalars().all()
        if len(records) < WARM_START_MIN_RECORDS:
            return

        try:
            bundle = await run_in_threadpool(_train_personal_model_bundle, records)
        except ValueError as exc:
            logger.warning("Skipping personal retrain for user %s: %s", user_id, exc)
            return
        except Exception:
            logger.exception("Unexpected error during personal retrain for user %s", user_id)
            return

        _save_models_to_user(user, bundle)
        await db.commit()


                          

async def generate_prediction(
    current_user: User,
    request: PredictionRequest,
    weather_tomorrow: dict,
    db: AsyncSession,
    background_tasks: BackgroundTasks = None,
) -> PredictionResponse:
    result = await db.execute(
        select(Record).filter(Record.user_id == current_user.id).order_by(Record.timestamp.asc())
    )
    records = result.scalars().all()
    if not records:
        raise HTTPException(status_code=400, detail="Cannot generate prediction: user has no past records.")

    actual_mood = float(records[-1].mood)
    actual_energy = float(records[-1].energy)
    history_len = len(records)
    target_date = request.target_date

    if history_len < WARM_START_MIN_RECORDS:
        cache_key = _build_prediction_cache_key(
            f"cold_prediction_{COLD_PREDICTION_CACHE_VERSION}",
            current_user.id,
            request,
        )
        cached = await safe_get(cache_key)
        if cached:
            cached_payload = json.loads(cached)
            if _should_use_cached_prediction(cached_payload):
                return PredictionResponse(**cached_payload)
            await safe_delete(cache_key)

        from app.services.weather_service import get_weather_for_date

        anchor_date = target_date - timedelta(days=1)
        day_after_date = target_date + timedelta(days=1)
        weather_today, weather_day_after = await asyncio.gather(
            get_weather_for_date(request.latitude, request.longitude, anchor_date),
            get_weather_for_date(request.latitude, request.longitude, day_after_date),
        )

        response_data, pred_mood_today, pred_mood_tomorrow, pred_mood_day_after, pred_energy_today, pred_energy_tomorrow = _run_cold_start_prediction(
            anchor_date,
            target_date,
            day_after_date,
            weather_today,
            weather_tomorrow,
            weather_day_after,
            history_len,
        )

        cold_record = ColdPrediction(
            user_id=current_user.id,
            prediction_today=_round_score(pred_mood_today),
            prediction_tomorrow=_round_score(pred_mood_tomorrow),
            prediction_day_after=_round_score(pred_mood_day_after),
            trend=response_data["mood_trend"],
            energy_prediction_today=_round_score(pred_energy_today),
            energy_prediction_tomorrow=_round_score(pred_energy_tomorrow),
            energy_trend=response_data.get("energy_trend"),
            location=format_coordinate_pair(request.latitude, request.longitude),
        )
        db.add(cold_record)
        queue_log(
            db,
            current_user.id,
            "PREDICTION_GENERATED",
            f"Cold prediction generated for {target_date}: mood_trend={response_data['mood_trend']}, energy_trend={response_data['energy_trend']}",
        )
        await db.commit()

        if _should_use_cached_prediction(response_data):
            await safe_set(cache_key, json.dumps(response_data), ex=21600)
        return PredictionResponse(**response_data)

    cache_key = _build_prediction_cache_key(
        f"warm_prediction_{WARM_PREDICTION_CACHE_VERSION}",
        current_user.id,
        request,
    )
    cached = await safe_get(cache_key)
    if cached:
        cached_payload = json.loads(cached)
        if _should_use_cached_prediction(cached_payload):
            return PredictionResponse(**cached_payload)
        await safe_delete(cache_key)

    fallback_mode = None
    active_bundle = _load_personal_bundle_from_user(current_user)
    if active_bundle is None:
        logger.info("Training personal v3 next-value models synchronously for user %s", current_user.id)
        try:
            active_bundle = await run_in_threadpool(_train_personal_model_bundle, records)
            _save_models_to_user(current_user, active_bundle)
        except ValueError as exc:
            logger.warning("Falling back to neutral warm prediction for user %s: %s", current_user.id, exc)
            active_bundle = None
        except Exception:
            logger.exception("Unexpected error while training personal models for user %s", current_user.id)
            active_bundle = None
    elif _should_retrain(current_user, history_len):
        logger.info("Triggering background retraining for user %s", current_user.id)
        if background_tasks:
            background_tasks.add_task(background_retrain_task, current_user.id)

    if active_bundle is None:
        fallback_mode = "neutral_warm_fallback"
        mood_prediction = _build_neutral_signal_prediction(actual_mood)
        energy_prediction = _build_neutral_signal_prediction(actual_energy)
    else:
        mood_prediction = _predict_personal_signal(
            records=records,
            signal="mood",
            feature_names=PERSONAL_MOOD_FEATURES,
            model=active_bundle["mood_model"],
            actual_today=actual_mood,
            target_date=target_date,
            weather_tomorrow=weather_tomorrow,
            threshold=float(active_bundle["mood_threshold"]),
            residual_sigma=float(active_bundle["mood_residual_sigma"]),
        )
        energy_prediction = _predict_personal_signal(
            records=records,
            signal="energy",
            feature_names=PERSONAL_ENERGY_FEATURES,
            model=active_bundle["energy_model"],
            actual_today=actual_energy,
            target_date=target_date,
            weather_tomorrow=weather_tomorrow,
            threshold=float(active_bundle["energy_threshold"]),
            residual_sigma=float(active_bundle["energy_residual_sigma"]),
        )

    prediction_payload = _build_warm_prediction_record_payload(
        user_id=current_user.id,
        request=request,
        actual_mood=actual_mood,
        actual_energy=actual_energy,
        mood_prediction=mood_prediction,
        energy_prediction=energy_prediction,
        weather_tomorrow=weather_tomorrow,
        model_bundle=active_bundle,
        history_len=history_len,
        fallback_mode=fallback_mode,
    )
    prediction_record = Prediction(**prediction_payload)
    db.add(prediction_record)
    queue_log(
        db,
        current_user.id,
        "PREDICTION_GENERATED",
        f"Warm prediction generated for {target_date}: mood_trend={mood_prediction['trend']}, energy_trend={energy_prediction['trend']}",
    )
    await db.commit()

    response_data = {
        "model_type": "warm",
        "mood_trend": mood_prediction["trend"],
        "energy_trend": energy_prediction["trend"],
        "mood_delta": round(float(mood_prediction["predicted_delta"]), 3),
        "energy_delta": round(float(energy_prediction["predicted_delta"]), 3),
        "weather_info": weather_tomorrow,
        "energy_available": True,
        "probabilities": prediction_payload["probabilities"],
        "mood_timeline": [],
        "prediction_metadata": prediction_payload["prediction_metadata"],
        "mood_actual_today": round(float(actual_mood), 3),
        "mood_predicted_value": round(float(mood_prediction["predicted_tomorrow"]), 3),
        "energy_actual_today": round(float(actual_energy), 3),
        "energy_predicted_value": round(float(energy_prediction["predicted_tomorrow"]), 3),
    }

    if _should_use_cached_prediction(response_data):
        await safe_set(cache_key, json.dumps(response_data), ex=21600)
    return PredictionResponse(**response_data)
