"""`domain/evl/metrics.py` (`EVL`, M1 brief §6/§8: "exact match, mismatch,
unknown handling, missing values, per-field metrics, aggregate metrics,
compliance metrics")."""

from __future__ import annotations

import pytest

from openspec.domain.evl.metrics import (
    EvalOutcome,
    classify_outcome,
    compute_aggregate_metrics,
    compute_per_field_metrics,
    wilson_score_interval,
)
from openspec.domain.model.gold import GoldLabel, Prediction


def _label(
    record_id: str, field: str, *, value: str | None = None, reason: str | None = None
) -> GoldLabel:
    return GoldLabel(
        record_id=record_id,
        field=field,
        expected_value=value,
        expected_unknown_reason=reason,
        is_real=True,
    )


def _pred(
    record_id: str, field: str, *, value: str | None = None, reason: str | None = None, **kw: object
) -> Prediction:
    return Prediction(
        record_id=record_id,
        field=field,
        value=value,
        unknown_reason=reason,
        status=kw.pop("status", "ACCEPTED" if value is not None else "UNKNOWN"),  # type: ignore[arg-type]
        **kw,  # type: ignore[arg-type]
    )


# ---- classify_outcome ---------------------------------------------------


def test_tp_when_values_match() -> None:
    label = _label("r1", "A", value="X")
    pred = _pred("r1", "A", value="X")
    assert classify_outcome(label, pred) is EvalOutcome.TP


def test_fp_when_values_mismatch() -> None:
    label = _label("r1", "A", value="X")
    pred = _pred("r1", "A", value="Y")
    assert classify_outcome(label, pred) is EvalOutcome.FP


def test_fn_when_no_prediction_at_all() -> None:
    label = _label("r1", "A", value="X")
    assert classify_outcome(label, None) is EvalOutcome.FN


def test_fn_when_no_prediction_and_unknown_expected() -> None:
    label = _label("r1", "A", reason="NO_DOCUMENT_FOUND")
    assert classify_outcome(label, None) is EvalOutcome.FN


def test_over_abstain_when_value_expected_but_predicted_unknown() -> None:
    label = _label("r1", "A", value="X")
    pred = _pred("r1", "A", value=None, reason="NO_DOCUMENT_FOUND")
    assert classify_outcome(label, pred) is EvalOutcome.OVER_ABSTAIN


def test_correct_abstain_when_unknown_expected_and_predicted() -> None:
    label = _label("r1", "A", reason="NO_DOCUMENT_FOUND")
    pred = _pred("r1", "A", value=None, reason="NO_DOCUMENT_FOUND")
    assert classify_outcome(label, pred) is EvalOutcome.CORRECT_ABSTAIN


def test_fp_when_unknown_expected_but_a_value_was_produced() -> None:
    label = _label("r1", "A", reason="NO_DOCUMENT_FOUND")
    pred = _pred("r1", "A", value="X")
    assert classify_outcome(label, pred) is EvalOutcome.FP


def test_normalized_comparator_is_used_when_supplied() -> None:
    label = _label("r1", "A", value="1-1/4")
    pred = _pred("r1", "A", value="1.25")
    assert classify_outcome(label, pred) is EvalOutcome.FP
    assert (
        classify_outcome(label, pred, value_equal=lambda a, b: {a, b} == {"1-1/4", "1.25"})
        is EvalOutcome.TP
    )


# ---- wilson_score_interval ------------------------------------------------


def test_wilson_interval_zero_n() -> None:
    ci = wilson_score_interval(0, 0)
    assert ci.n == 0
    assert ci.point == 0.0


def test_wilson_interval_perfect_score_stays_within_bounds() -> None:
    ci = wilson_score_interval(10, 10)
    assert ci.point == 1.0
    assert 0.0 <= ci.low <= ci.high <= 1.0
    assert ci.high <= 1.0


def test_wilson_interval_widens_at_small_n() -> None:
    small = wilson_score_interval(5, 10)
    large = wilson_score_interval(500, 1000)
    assert (small.high - small.low) > (large.high - large.low)


def test_wilson_interval_rejects_invalid_successes() -> None:
    with pytest.raises(ValueError):
        wilson_score_interval(11, 10)
    with pytest.raises(ValueError):
        wilson_score_interval(-1, 10)


# ---- aggregate / per-field metrics ----------------------------------------


def test_per_field_metrics_basic() -> None:
    labels = (
        _label("r1", "A", value="X"),
        _label("r2", "A", value="X"),
        _label("r1", "B", reason="NO_DOCUMENT_FOUND"),
    )
    preds = {
        ("r1", "A"): _pred("r1", "A", value="X"),
        ("r2", "A"): _pred("r2", "A", value="Y"),
        ("r1", "B"): _pred("r1", "B", value=None, reason="NO_DOCUMENT_FOUND"),
    }
    per_field = compute_per_field_metrics(labels, preds)
    by_field = {m.field: m for m in per_field}
    assert by_field["A"].tp == 1
    assert by_field["A"].fp == 1
    assert by_field["A"].n == 2
    assert by_field["B"].correct_abstain == 1
    assert by_field["B"].n == 1


def test_aggregate_metrics_unknown_and_review_rate() -> None:
    labels = (_label("r1", "A", value="X"), _label("r2", "A", value="Y"))
    preds = {
        ("r1", "A"): _pred("r1", "A", value="X"),
        ("r2", "A"): _pred("r2", "A", value=None, reason="NO_DOCUMENT_FOUND", status="UNKNOWN"),
    }
    agg = compute_aggregate_metrics(labels, preds)
    assert agg.n == 2
    assert agg.unknown_rate == 0.5
    assert agg.review_rate == 0.0


def test_aggregate_metrics_evidence_coverage() -> None:
    labels = (_label("r1", "A", value="X"), _label("r2", "A", value="Y"))
    preds = {
        ("r1", "A"): _pred("r1", "A", value="X", evidence_count=1),
        ("r2", "A"): _pred("r2", "A", value="Y", evidence_count=0),
    }
    agg = compute_aggregate_metrics(labels, preds)
    assert agg.evidence_coverage == 0.5


def test_aggregate_metrics_evidence_coverage_vacuous_when_nothing_asserted() -> None:
    labels = (_label("r1", "A", reason="NO_DOCUMENT_FOUND"),)
    preds = {("r1", "A"): _pred("r1", "A", value=None, reason="NO_DOCUMENT_FOUND")}
    agg = compute_aggregate_metrics(labels, preds)
    assert agg.evidence_coverage == 1.0


def test_aggregate_metrics_lov_and_compliance_none_when_not_applicable() -> None:
    labels = (_label("r1", "A", value="X"),)
    preds = {("r1", "A"): _pred("r1", "A", value="X")}
    agg = compute_aggregate_metrics(labels, preds)
    assert agg.lov_membership_rate is None
    assert agg.compliance_rate is None


def test_aggregate_metrics_lov_and_compliance_rates() -> None:
    labels = (_label("r1", "A", value="X"), _label("r2", "A", value="Y"))
    preds = {
        ("r1", "A"): _pred("r1", "A", value="X", lov_compliant=True, char_limit_ok=True),
        ("r2", "A"): _pred("r2", "A", value="Y", lov_compliant=False, char_limit_ok=True),
    }
    agg = compute_aggregate_metrics(labels, preds)
    assert agg.lov_membership_rate == 0.5
    assert agg.compliance_rate == 1.0


def test_aggregate_metrics_deterministic() -> None:
    labels = (_label("r1", "A", value="X"),)
    preds = {("r1", "A"): _pred("r1", "A", value="X")}
    assert compute_aggregate_metrics(labels, preds) == compute_aggregate_metrics(labels, preds)


def test_aggregate_metrics_missing_prediction_counts_as_fn_not_unknown() -> None:
    labels = (_label("r1", "A", value="X"),)
    agg = compute_aggregate_metrics(labels, {})
    assert agg.overall_accuracy.point == 0.0
    assert agg.unknown_rate == 0.0  # no prediction present at all, not an explicit Unknown
