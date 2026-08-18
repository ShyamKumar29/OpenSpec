"""Pure evaluation metrics (`EVL`, M1). No I/O, no pipeline mutation (INV-6;
M1 brief: "Implement metrics as pure, independently testable functions. Do
not hide calculations inside API handlers.").

Outcome taxonomy mirrors `docs/04-data-model.md` §3.7's
`eval_result.outcome` enum verbatim (`TP`/`FP`/`FN`/`CORRECT_ABSTAIN`/
`OVER_ABSTAIN`) rather than inventing a parallel one.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.model.gold import GoldLabel, Prediction

_DEFAULT_Z = 1.959963984540054  # 95% two-sided normal quantile


class EvalOutcome(StrEnum):
    TP = "TP"
    FP = "FP"
    FN = "FN"
    CORRECT_ABSTAIN = "CORRECT_ABSTAIN"
    OVER_ABSTAIN = "OVER_ABSTAIN"


def classify_outcome(
    label: GoldLabel,
    prediction: Prediction | None,
    *,
    value_equal: Callable[[str, str], bool] | None = None,
) -> EvalOutcome:
    """Total: every `(label, prediction)` pair maps to exactly one outcome.

    - No prediction at all (the pipeline never touched this record/field)
      is `FN` regardless of what was expected — a coverage gap is always a
      failure to report, never silently folded into "correctly abstained".
    - `value_equal` defaults to exact string equality; a caller may inject a
      normalized comparator (fractions, casing, UOM) — "support normalized
      comparison only where the docs permit it" (M1 brief §6). This module
      never invents the normalization rule itself; it only accepts one.
    """
    equal = value_equal or (lambda a, b: a == b)
    expects_value = label.expected_value is not None

    if prediction is None:
        return EvalOutcome.FN

    if expects_value:
        assert label.expected_value is not None  # narrows for mypy; guarded by expects_value
        if prediction.value is None:
            return EvalOutcome.OVER_ABSTAIN
        return EvalOutcome.TP if equal(prediction.value, label.expected_value) else EvalOutcome.FP

    # Gold expects Unknown.
    if prediction.value is None:
        return EvalOutcome.CORRECT_ABSTAIN
    return EvalOutcome.FP


@dataclass(frozen=True, slots=True)
class ConfidenceInterval:
    """A Wilson score interval — `docs/10-roadmap.md` M1: "`make eval`
    produces a report with confidence intervals"; `docs/04-data-model.md`
    §3.7's `eval_metric.ci_low/ci_high` columns. Wilson, not the normal
    approximation, because it stays inside `[0,1]` and behaves sanely at
    small `n` and near 0%/100% — exactly the regime a young gold set lives
    in."""

    point: float
    low: float
    high: float
    n: int


def wilson_score_interval(successes: int, n: int, *, z: float = _DEFAULT_Z) -> ConfidenceInterval:
    if n == 0:
        return ConfidenceInterval(point=0.0, low=0.0, high=0.0, n=0)
    if successes < 0 or successes > n:
        raise ValueError(f"successes ({successes}) must be within [0, n={n}]")
    phat = successes / n
    denom = 1 + z**2 / n
    center = (phat + z**2 / (2 * n)) / denom
    margin = (z * ((phat * (1 - phat) / n + z**2 / (4 * n**2)) ** 0.5)) / denom
    return ConfidenceInterval(
        point=phat, low=max(0.0, center - margin), high=min(1.0, center + margin), n=n
    )


@dataclass(frozen=True, slots=True)
class PerFieldMetrics:
    field: str
    n: int
    accuracy: ConfidenceInterval
    unknown_rate: float
    tp: int
    fp: int
    fn: int
    correct_abstain: int
    over_abstain: int


@dataclass(frozen=True, slots=True)
class AggregateMetrics:
    n: int
    overall_accuracy: ConfidenceInterval
    unknown_rate: float
    review_rate: float
    evidence_coverage: float
    lov_membership_rate: float | None  # None = no field in this slice carries an LOV constraint
    compliance_rate: (
        float | None
    )  # None = no field in this slice carries a length/casing constraint


def _predictions_by_key(
    labels: tuple[GoldLabel, ...], predictions: dict[tuple[str, str], Prediction]
) -> list[Prediction | None]:
    return [predictions.get((label.record_id, label.field)) for label in labels]


def compute_per_field_metrics(
    labels: tuple[GoldLabel, ...],
    predictions: dict[tuple[str, str], Prediction],
    *,
    value_equal: Callable[[str, str], bool] | None = None,
) -> tuple[PerFieldMetrics, ...]:
    fields = sorted({label.field for label in labels})
    results: list[PerFieldMetrics] = []
    for field in fields:
        field_labels = tuple(label for label in labels if label.field == field)
        field_predictions = _predictions_by_key(field_labels, predictions)
        outcomes = [
            classify_outcome(label, pred, value_equal=value_equal)
            for label, pred in zip(field_labels, field_predictions, strict=True)
        ]
        tp = outcomes.count(EvalOutcome.TP)
        fp = outcomes.count(EvalOutcome.FP)
        fn = outcomes.count(EvalOutcome.FN)
        correct_abstain = outcomes.count(EvalOutcome.CORRECT_ABSTAIN)
        over_abstain = outcomes.count(EvalOutcome.OVER_ABSTAIN)
        n = len(field_labels)
        accuracy = wilson_score_interval(tp + correct_abstain, n)
        unknown_n = sum(1 for pred in field_predictions if pred is not None and pred.value is None)
        unknown_rate = unknown_n / n if n else 0.0
        results.append(
            PerFieldMetrics(
                field=field,
                n=n,
                accuracy=accuracy,
                unknown_rate=unknown_rate,
                tp=tp,
                fp=fp,
                fn=fn,
                correct_abstain=correct_abstain,
                over_abstain=over_abstain,
            )
        )
    return tuple(results)


def compute_aggregate_metrics(
    labels: tuple[GoldLabel, ...],
    predictions: dict[tuple[str, str], Prediction],
    *,
    value_equal: Callable[[str, str], bool] | None = None,
) -> AggregateMetrics:
    n = len(labels)
    preds = _predictions_by_key(labels, predictions)
    outcomes = [
        classify_outcome(label, pred, value_equal=value_equal)
        for label, pred in zip(labels, preds, strict=True)
    ]
    correct = outcomes.count(EvalOutcome.TP) + outcomes.count(EvalOutcome.CORRECT_ABSTAIN)
    overall_accuracy = wilson_score_interval(correct, n)

    present = [p for p in preds if p is not None]
    unknown_rate = (sum(1 for p in present if p.value is None) / n) if n else 0.0
    review_rate = (sum(1 for p in present if p.status == "NEEDS_REVIEW") / n) if n else 0.0

    asserted = [p for p in present if p.value is not None]
    # Vacuous compliance (no asserted values to check) is reported as full
    # coverage, not zero — the same "1000/1000 pass, vacuously" discipline
    # `docs/15-backend-implementation-status.md` §14 already established for
    # the Delivery Format export's item-features-no-duplicates check.
    evidence_coverage = (
        (sum(1 for p in asserted if p.evidence_count > 0) / len(asserted)) if asserted else 1.0
    )

    lov_checked = [p for p in present if p.lov_compliant is not None]
    lov_membership_rate = (
        (sum(1 for p in lov_checked if p.lov_compliant) / len(lov_checked)) if lov_checked else None
    )

    limit_checked = [p for p in present if p.char_limit_ok is not None]
    compliance_rate = (
        (sum(1 for p in limit_checked if p.char_limit_ok) / len(limit_checked))
        if limit_checked
        else None
    )

    return AggregateMetrics(
        n=n,
        overall_accuracy=overall_accuracy,
        unknown_rate=unknown_rate,
        review_rate=review_rate,
        evidence_coverage=evidence_coverage,
        lov_membership_rate=lov_membership_rate,
        compliance_rate=compliance_rate,
    )
