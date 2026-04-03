import pytest

from app.services.ml_service import (
    WARM_BASE_THRESHOLD,
    _compute_warm_effective_threshold,
    _finalize_warm_signal_prediction,
)


def test_warm_threshold_shrinks_near_scale_edges() -> None:
    edge_threshold = _compute_warm_effective_threshold(1.0, WARM_BASE_THRESHOLD)
    center_threshold = _compute_warm_effective_threshold(3.0, WARM_BASE_THRESHOLD)

    assert edge_threshold == pytest.approx(0.12)
    assert center_threshold == pytest.approx(WARM_BASE_THRESHOLD)


def test_finalize_warm_prediction_marks_edge_reversion_as_trend() -> None:
    prediction = _finalize_warm_signal_prediction(
        actual_today=5.0,
        raw_predicted_tomorrow=4.82,
        threshold=WARM_BASE_THRESHOLD,
        residual_sigma=0.30,
    )

    assert prediction["predicted_tomorrow"] == pytest.approx(4.82)
    assert prediction["predicted_delta"] == pytest.approx(-0.18)
    assert prediction["effective_threshold"] == pytest.approx(0.12)
    assert prediction["trend"] == "drop"


def test_finalize_warm_prediction_uses_clipped_score_for_delta() -> None:
    prediction = _finalize_warm_signal_prediction(
        actual_today=5.0,
        raw_predicted_tomorrow=5.40,
        threshold=WARM_BASE_THRESHOLD,
        residual_sigma=0.30,
    )

    assert prediction["predicted_tomorrow"] == pytest.approx(5.0)
    assert prediction["predicted_delta"] == pytest.approx(0.0)
    assert prediction["trend"] == "stable"
