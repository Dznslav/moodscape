from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import xgboost as xgb

ML_DIR = Path(__file__).resolve().parent.parent / "app" / "ml"

MOOD_FEATURES = [
    "day_of_week", "is_weekend", "month", "season",
    "temp", "rain", "humidity", "clouds",
]
ENERGY_FEATURES = [
    "day_of_week", "is_weekend", "month", "season",
    "temp_cat", "humidity_cat", "clouds_cat", "rain_cat",
]

COLD_MOOD_TREND_THRESHOLD = 0.10
COLD_ENERGY_TREND_THRESHOLD = 0.05


def get_season(month: int) -> int:
    if month in (12, 1, 2):
        return 1
    if month in (3, 4, 5):
        return 2
    if month in (6, 7, 8):
        return 3
    return 4


def categorize_temp(t: float) -> int:
    if t < 10:
        return 1
    if t <= 25:
        return 2
    return 3


def categorize_humidity(h: float) -> int:
    if h < 40:
        return 1
    if h <= 70:
        return 2
    return 3


def categorize_clouds(c: float) -> int:
    if c < 30:
        return 1
    if c <= 70:
        return 2
    return 3


def categorize_rain(r: float) -> int:
    if r <= 0:
        return 0
    if r < 2.5:
        return 1
    return 2


def build_mood_row(d: date, weather: dict) -> pd.DataFrame:
    row = {
        "day_of_week": d.weekday(),
        "is_weekend": int(d.weekday() >= 5),
        "month": d.month,
        "season": get_season(d.month),
        "temp": float(weather.get("temp", 0)),
        "rain": float(weather.get("rain", 0)),
        "humidity": float(weather.get("humidity", 0)),
        "clouds": float(weather.get("clouds", 0)),
    }
    return pd.DataFrame([row])[MOOD_FEATURES]


def build_energy_row(d: date, weather: dict) -> pd.DataFrame:
    t = float(weather.get("temp", 0))
    h = float(weather.get("humidity", 0))
    c = float(weather.get("clouds", 0))
    r = float(weather.get("rain", 0))
    row = {
        "day_of_week": d.weekday(),
        "is_weekend": int(d.weekday() >= 5),
        "month": d.month,
        "season": get_season(d.month),
        "temp_cat": categorize_temp(t),
        "humidity_cat": categorize_humidity(h),
        "clouds_cat": categorize_clouds(c),
        "rain_cat": categorize_rain(r),
    }
    return pd.DataFrame([row])[ENERGY_FEATURES]


def _load(candidates: list[str]):
    for name in candidates:
        p = ML_DIR / name
        if p.exists():
            m = xgb.XGBRegressor()
            m.load_model(str(p))
            return m
    return None


@pytest.fixture(scope="module")
def mood_model():
    m = _load(["global_mood_model.json", "global_model.json"])
    if m is None:
        pytest.skip("Global mood model not found")
    return m


@pytest.fixture(scope="module")
def energy_model():
    m = _load(["global_energy_model.json"])
    if m is None:
        pytest.skip("Global energy model not found")
    return m


@pytest.fixture(scope="module")
def sample_data():
    csv = Path(__file__).resolve().parent.parent.parent / "sample-data" / "moodscape_synthetic_statistics_full.csv"
    if not csv.exists():
        pytest.skip("Sample CSV not found")
    df = pd.read_csv(csv)
    required = ["timestamp", "mood", "energy", "weather_temp", "weather_humidity", "weather_rain", "weather_clouds"]
    df = df.dropna(subset=required).copy()
    df["mood"] = df["mood"].astype(float)
    df["energy"] = df["energy"].astype(float)
    for c in ("weather_temp", "weather_humidity", "weather_rain", "weather_clouds"):
        df[c] = df[c].astype(float)
    return df


@pytest.fixture(scope="module")
def sample_features(sample_data):
    ts = pd.to_datetime(sample_data["timestamp"])
    temp = sample_data["weather_temp"]
    humidity = sample_data["weather_humidity"]
    rain = sample_data["weather_rain"]
    clouds = sample_data["weather_clouds"]
    return pd.DataFrame({
        "day_of_week": ts.dt.weekday,
        "is_weekend": (ts.dt.weekday >= 5).astype(int),
        "month": ts.dt.month,
        "season": ts.dt.month.map(get_season),
        "temp": temp,
        "rain": rain,
        "humidity": humidity,
        "clouds": clouds,
        "temp_cat": temp.map(categorize_temp),
        "humidity_cat": humidity.map(categorize_humidity),
        "clouds_cat": clouds.map(categorize_clouds),
        "rain_cat": rain.map(categorize_rain),
    })


class TestModelLoading:
    def test_mood_model_loads(self, mood_model):
        assert mood_model is not None

    def test_energy_model_loads(self, energy_model):
        assert energy_model is not None

    def test_mood_model_has_correct_feature_count(self, mood_model):
        assert mood_model.n_features_in_ == len(MOOD_FEATURES)

    def test_energy_model_has_correct_feature_count(self, energy_model):
        assert energy_model.n_features_in_ == len(ENERGY_FEATURES)


class TestFeatureEngineering:
    def test_season_winter(self):
        assert get_season(12) == 1
        assert get_season(1) == 1
        assert get_season(2) == 1

    def test_season_spring(self):
        assert get_season(3) == 2
        assert get_season(5) == 2

    def test_season_summer(self):
        assert get_season(6) == 3
        assert get_season(8) == 3

    def test_season_autumn(self):
        assert get_season(9) == 4
        assert get_season(11) == 4

    def test_categorize_temp_boundaries(self):
        assert categorize_temp(5) == 1
        assert categorize_temp(10) == 2
        assert categorize_temp(25) == 2
        assert categorize_temp(30) == 3

    def test_categorize_rain_none(self):
        assert categorize_rain(0) == 0
        assert categorize_rain(-0.1) == 0

    def test_categorize_rain_light(self):
        assert categorize_rain(1.0) == 1

    def test_categorize_rain_heavy(self):
        assert categorize_rain(2.5) == 2
        assert categorize_rain(10) == 2

    def test_weekend_detection(self):
        row = build_mood_row(date(2026, 1, 3), {"temp": 5, "humidity": 70, "clouds": 50, "rain": 0})
        assert row["is_weekend"].iloc[0] == 1

    def test_weekday_detection(self):
        row = build_mood_row(date(2026, 1, 5), {"temp": 5, "humidity": 70, "clouds": 50, "rain": 0})
        assert row["is_weekend"].iloc[0] == 0


class TestPredictionRange:
    def test_mood_predictions_in_range(self, mood_model, sample_features):
        preds = mood_model.predict(sample_features[MOOD_FEATURES])
        assert preds.min() >= 0.0, f"Mood prediction below 0: {preds.min()}"
        assert preds.max() <= 6.0, f"Mood prediction above 6: {preds.max()}"

    def test_energy_predictions_in_range(self, energy_model, sample_features):
        preds = energy_model.predict(sample_features[ENERGY_FEATURES])
        assert preds.min() >= 0.0, f"Energy prediction below 0: {preds.min()}"
        assert preds.max() <= 6.0, f"Energy prediction above 6: {preds.max()}"


class TestSinglePrediction:
    WEATHER = {"temp": 12.0, "humidity": 70.0, "clouds": 50.0, "rain": 0.0}
    TARGET_DATE = date(2026, 3, 10)

    def test_mood_single(self, mood_model):
        feat = build_mood_row(self.TARGET_DATE, self.WEATHER)
        pred = mood_model.predict(feat)
        assert pred.shape == (1,)
        assert 0.5 <= pred[0] <= 5.5

    def test_energy_single(self, energy_model):
        feat = build_energy_row(self.TARGET_DATE, self.WEATHER)
        pred = energy_model.predict(feat)
        assert pred.shape == (1,)
        assert 0.5 <= pred[0] <= 5.5
