"""Evaluation harness orchestration (`EVL`, M1 — docs/10-roadmap.md M1: "EVL
must exist before the extractor"). Ties together gold-set loading (an
injected port, never a concrete file reader — `application/` may not import
`infrastructure/`) and pure metric computation (`domain/evl/metrics.py`).

Deliberately separate from the production pipeline (M1 brief §4): this
module never constructs, mutates, or persists a `CatalogRecord` or
`AttributeValue` — it only reads predictions already produced elsewhere
(as plain `Prediction` values) and compares them against a gold set.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from openspec.domain.evl.metrics import (
    AggregateMetrics,
    PerFieldMetrics,
    compute_aggregate_metrics,
    compute_per_field_metrics,
)
from openspec.domain.model.gold import GoldSetAvailability, GoldSetLoadOutcome, Prediction


class GoldSetLoader(Protocol):
    """The port `run_evaluation` depends on.
    `infrastructure/reference_data/gold_set.py`'s `load_gold_set` satisfies
    this shape but is never imported here directly (`application/` never
    imports `infrastructure/`, `tests/architecture/test_layering.py`)."""

    def __call__(self) -> GoldSetLoadOutcome: ...


@dataclass(frozen=True, slots=True)
class EvalRunResult:
    """The typed, machine-readable result the M1 brief's §7 asks for.
    `aggregate_all`/`aggregate_real`/`per_field` are all `None`/empty exactly
    when `availability` is not `GOLD_SET_AVAILABLE` — 0% accuracy and
    unavailable accuracy are never the same shape (brief's own words).
    `aggregate_real` is additionally `None` when the gold set is available
    but contains no real (non-synthetic) labels, distinct from "no gold set
    at all" (docs/decisions.md 2026-08-07: "real and synthetic slices
    reported separately, real first")."""

    run_id: str
    dataset: str
    timestamp: str
    availability: GoldSetAvailability
    row_count: int
    field_count: int
    aggregate_all: AggregateMetrics | None
    aggregate_real: AggregateMetrics | None
    per_field: tuple[PerFieldMetrics, ...]
    failures: tuple[str, ...]
    warnings: tuple[str, ...]


def run_evaluation(
    *,
    run_id: str,
    dataset: str,
    timestamp: str,
    load_gold: GoldSetLoader,
    predictions: tuple[Prediction, ...],
    value_equal: Callable[[str, str], bool] | None = None,
) -> EvalRunResult:
    outcome = load_gold()

    if (
        outcome.availability is not GoldSetAvailability.GOLD_SET_AVAILABLE
        or outcome.gold_set is None
    ):
        return EvalRunResult(
            run_id=run_id,
            dataset=dataset,
            timestamp=timestamp,
            availability=outcome.availability,
            row_count=0,
            field_count=0,
            aggregate_all=None,
            aggregate_real=None,
            per_field=(),
            failures=(),
            warnings=outcome.errors,
        )

    gold_set = outcome.gold_set
    pred_index = {(p.record_id, p.field): p for p in predictions}

    aggregate_all = compute_aggregate_metrics(gold_set.labels, pred_index, value_equal=value_equal)
    real_labels = gold_set.real_labels()
    aggregate_real = (
        compute_aggregate_metrics(real_labels, pred_index, value_equal=value_equal)
        if real_labels
        else None
    )
    per_field = compute_per_field_metrics(gold_set.labels, pred_index, value_equal=value_equal)

    failures = tuple(
        f"{label.record_id}/{label.field}: expected={label.expected_value!r} "
        f"unknown_reason={label.expected_unknown_reason!r} — no prediction produced"
        for label in gold_set.labels
        if (label.record_id, label.field) not in pred_index
    )

    warnings: tuple[str, ...] = ()
    if not real_labels:
        warnings = ("gold set contains no real (non-synthetic) labels — reporting synthetic only",)

    return EvalRunResult(
        run_id=run_id,
        dataset=dataset,
        timestamp=timestamp,
        availability=GoldSetAvailability.GOLD_SET_AVAILABLE,
        row_count=len(gold_set.record_ids()),
        field_count=len(gold_set.fields()),
        aggregate_all=aggregate_all,
        aggregate_real=aggregate_real,
        per_field=per_field,
        failures=failures,
        warnings=warnings,
    )
