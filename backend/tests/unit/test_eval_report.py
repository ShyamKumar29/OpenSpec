"""`application/usecases/eval_report.py` (`EVL`, M1)."""

from __future__ import annotations

import json

from openspec.application.usecases.eval_report import render_eval_json, render_eval_markdown
from openspec.application.usecases.run_evaluation import EvalRunResult
from openspec.domain.evl.metrics import compute_aggregate_metrics, compute_per_field_metrics
from openspec.domain.model.gold import GoldLabel, GoldSetAvailability, Prediction


def _unavailable_result() -> EvalRunResult:
    return EvalRunResult(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        availability=GoldSetAvailability.GOLD_SET_UNAVAILABLE,
        row_count=0,
        field_count=0,
        aggregate_all=None,
        aggregate_real=None,
        per_field=(),
        failures=(),
        warnings=(),
    )


def _available_result() -> EvalRunResult:
    labels = (
        GoldLabel(
            record_id="r1",
            field="A",
            expected_value="X",
            expected_unknown_reason=None,
            is_real=True,
        ),
    )
    preds = {
        ("r1", "A"): Prediction(
            record_id="r1", field="A", value="X", unknown_reason=None, status="ACCEPTED"
        )
    }
    return EvalRunResult(
        run_id="run1",
        dataset="ds",
        timestamp="2026-08-14T00:00:00Z",
        availability=GoldSetAvailability.GOLD_SET_AVAILABLE,
        row_count=1,
        field_count=1,
        aggregate_all=compute_aggregate_metrics(labels, preds),
        aggregate_real=compute_aggregate_metrics(labels, preds),
        per_field=compute_per_field_metrics(labels, preds),
        failures=(),
        warnings=(),
    )


def test_markdown_reports_unavailable_without_fabricating_a_score() -> None:
    text = render_eval_markdown(_unavailable_result())
    assert "GOLD_SET_UNAVAILABLE" in text
    assert "No accuracy is reported" in text
    # The disclaimer itself names "0%" to explain the distinction — but no
    # actual metrics table/section (which "0%"/"not the same as" isn't part
    # of) is rendered for an unavailable gold set.
    assert "Overall accuracy" not in text
    assert "## Per-field" not in text


def test_markdown_reports_metrics_when_available() -> None:
    text = render_eval_markdown(_available_result())
    assert "GOLD_SET_AVAILABLE" in text
    assert "Overall accuracy" in text
    assert "| A |" in text


def test_json_unavailable_has_null_aggregates() -> None:
    payload = json.loads(render_eval_json(_unavailable_result()))
    assert payload["availability"] == "GOLD_SET_UNAVAILABLE"
    assert payload["aggregate_all"] is None
    assert payload["aggregate_real"] is None


def test_json_available_has_populated_aggregates() -> None:
    payload = json.loads(render_eval_json(_available_result()))
    assert payload["availability"] == "GOLD_SET_AVAILABLE"
    assert payload["aggregate_all"]["n"] == 1
    assert payload["per_field"][0]["field"] == "A"


def test_json_is_valid_json_and_deterministic() -> None:
    result = _available_result()
    a = render_eval_json(result)
    b = render_eval_json(result)
    assert a == b
    json.loads(a)  # does not raise
