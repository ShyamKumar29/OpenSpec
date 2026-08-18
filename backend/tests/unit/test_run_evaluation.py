"""`application/usecases/run_evaluation.py` (`EVL`, M1 brief §8: "unavailable
gold set, deterministic repeated evaluation")."""

from __future__ import annotations

from pathlib import Path

from openspec.application.usecases.run_evaluation import run_evaluation
from openspec.domain.model.gold import GoldSetAvailability, Prediction
from openspec.infrastructure.reference_data.gold_set import load_gold_set

_FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "evl"


def _loader(path: Path):
    def _load():
        return load_gold_set(path)

    return _load


def test_unavailable_gold_set_yields_no_metrics() -> None:
    result = run_evaluation(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        load_gold=_loader(_FIXTURE_DIR / "does_not_exist.csv"),
        predictions=(),
    )
    assert result.availability is GoldSetAvailability.GOLD_SET_UNAVAILABLE
    assert result.aggregate_all is None
    assert result.aggregate_real is None
    assert result.per_field == ()
    assert result.row_count == 0


def test_invalid_gold_set_yields_no_metrics_but_warnings() -> None:
    result = run_evaluation(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        load_gold=_loader(_FIXTURE_DIR / "malformed_gold_set.csv"),
        predictions=(),
    )
    assert result.availability is GoldSetAvailability.INVALID_GOLD_SET
    assert result.aggregate_all is None
    assert result.warnings != ()


def test_available_gold_set_with_predictions_computes_metrics() -> None:
    predictions = (
        Prediction(
            record_id="r1",
            field="MFG_PART_NUM",
            value="ABC-123",
            unknown_reason=None,
            status="ACCEPTED",
        ),
        Prediction(
            record_id="r1",
            field="MANUFACTURER_NAME",
            value=None,
            unknown_reason="REFERENCE_DATA_UNAVAILABLE",
            status="UNKNOWN",
        ),
        Prediction(
            record_id="r2",
            field="MFG_PART_NUM",
            value="WRONG",
            unknown_reason=None,
            status="ACCEPTED",
        ),
    )
    result = run_evaluation(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        load_gold=_loader(_FIXTURE_DIR / "valid_gold_set.csv"),
        predictions=predictions,
    )
    assert result.availability is GoldSetAvailability.GOLD_SET_AVAILABLE
    assert result.row_count == 2
    assert result.field_count == 2
    assert result.aggregate_all is not None
    # r1/MFG_PART_NUM=TP, r1/MANUFACTURER_NAME=CORRECT_ABSTAIN, r2/MFG_PART_NUM=FP
    assert result.aggregate_all.overall_accuracy.n == 3
    assert result.failures == ()
    # r2's label is synthetic (is_real=false); real slice excludes it.
    assert result.aggregate_real is not None
    assert result.aggregate_real.overall_accuracy.n == 2


def test_missing_prediction_is_reported_as_failure() -> None:
    result = run_evaluation(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        load_gold=_loader(_FIXTURE_DIR / "valid_gold_set.csv"),
        predictions=(),
    )
    assert len(result.failures) == 3


def test_deterministic_repeated_evaluation() -> None:
    predictions = (
        Prediction(
            record_id="r1",
            field="MFG_PART_NUM",
            value="ABC-123",
            unknown_reason=None,
            status="ACCEPTED",
        ),
    )
    kwargs = dict(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        load_gold=_loader(_FIXTURE_DIR / "valid_gold_set.csv"),
        predictions=predictions,
    )
    first = run_evaluation(**kwargs)  # type: ignore[arg-type]
    second = run_evaluation(**kwargs)  # type: ignore[arg-type]
    assert first == second
