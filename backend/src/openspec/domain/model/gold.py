"""Gold-set + prediction value objects (`EVL`, M1 — docs/10-roadmap.md M1:
"EVL must exist before the extractor"). Pure domain shapes, independent of
*how* a gold set or a prediction is produced (CSV file, live pipeline run,
...) — that's infrastructure's/application's job. Mirrors
`docs/04-data-model.md` §3.7's `gold_label` table, minus DB-only bookkeeping.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation


class GoldSetAvailability(StrEnum):
    """The three states the M1 brief requires be distinguished (§5): a gold
    set may be present and valid, absent, or present but malformed. These
    are not the same outcome and must never be collapsed into one boolean —
    "0% accuracy and unavailable accuracy are NOT the same thing" (brief §7)."""

    GOLD_SET_AVAILABLE = "GOLD_SET_AVAILABLE"
    GOLD_SET_UNAVAILABLE = "GOLD_SET_UNAVAILABLE"
    INVALID_GOLD_SET = "INVALID_GOLD_SET"


@dataclass(frozen=True, slots=True)
class GoldLabel:
    """One expected value for one `(record_id, field)` pair — the atomic
    unit a gold set is made of. Exactly one of `expected_value` /
    `expected_unknown_reason` is set, mirroring INV-4's "Unknown is
    first-class, never null" discipline extended to an *expectation*: a
    label is never ambiguous about whether it expects a value or an
    abstention."""

    record_id: str
    field: str
    expected_value: str | None
    expected_unknown_reason: str | None
    is_real: bool  # real client-labelled vs. a synthetic fixture used only to
    # test the evaluator itself (docs/decisions.md 2026-08-07: "real and
    # synthetic slices reported separately, real first").

    def __post_init__(self) -> None:
        if not self.record_id.strip():
            raise InvariantViolation("GoldLabel.record_id must be non-blank")
        if not self.field.strip():
            raise InvariantViolation("GoldLabel.field must be non-blank")
        if self.expected_value is None and self.expected_unknown_reason is None:
            raise InvariantViolation(
                "GoldLabel must carry either expected_value or expected_unknown_reason"
            )
        if self.expected_value is not None and self.expected_unknown_reason is not None:
            raise InvariantViolation(
                "GoldLabel cannot carry both expected_value and expected_unknown_reason"
            )


@dataclass(frozen=True, slots=True)
class GoldSet:
    """A validated collection of labels — only constructible via
    `domain.evl.gold_validation.validate_gold_rows`, which is the sole place
    duplicate/malformed-row checking happens (mirrors
    `AttributeValueFactory`'s "only documented construction path"
    discipline)."""

    labels: tuple[GoldLabel, ...]
    source_name: str
    label_version: str

    def __post_init__(self) -> None:
        if not self.labels:
            raise InvariantViolation("GoldSet must contain at least one label")

    def record_ids(self) -> frozenset[str]:
        return frozenset(label.record_id for label in self.labels)

    def fields(self) -> frozenset[str]:
        return frozenset(label.field for label in self.labels)

    def real_labels(self) -> tuple[GoldLabel, ...]:
        return tuple(label for label in self.labels if label.is_real)


@dataclass(frozen=True, slots=True)
class GoldSetLoadOutcome:
    """The typed three-way result a gold-set loader port returns
    (`application/usecases/run_evaluation.py`'s `GoldSetLoader` Protocol;
    implemented for real by `infrastructure/reference_data/gold_set.py`).
    Defined here, not in `infrastructure/`, so `application/` can depend on
    its shape without importing `infrastructure/` (`tests/architecture/
    test_layering.py`) — a raised exception is never the interface between
    a loader and the use case that calls it; the three
    `GoldSetAvailability` states are always explicit."""

    availability: GoldSetAvailability
    gold_set: GoldSet | None
    errors: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Prediction:
    """One produced value for one `(record_id, field)` pair — the
    prediction-side mirror of `GoldLabel`. `value is None` means the
    pipeline abstained (produced `Unknown`); exactly one of `value` /
    `unknown_reason` is set, same discipline as `GoldLabel`.

    `evidence_count`, `lov_compliant`, and `char_limit_ok` are optional
    signals a caller may not always have: `lov_compliant`/`char_limit_ok`
    are `None` when the field has no such constraint to check (not
    "checked and passed") — `domain/evl/metrics.py` treats that as "not
    applicable", never as compliant by default."""

    record_id: str
    field: str
    value: str | None
    unknown_reason: str | None
    status: str  # AttributeValueStatus.value, kept as plain text — this
    # module doesn't need the domain enum's identity, just its wire value.
    evidence_count: int = 0
    lov_compliant: bool | None = None
    char_limit_ok: bool | None = None

    def __post_init__(self) -> None:
        if not self.record_id.strip():
            raise InvariantViolation("Prediction.record_id must be non-blank")
        if not self.field.strip():
            raise InvariantViolation("Prediction.field must be non-blank")
        if self.value is not None and self.unknown_reason is not None:
            raise InvariantViolation("Prediction cannot carry both value and unknown_reason")
        if self.evidence_count < 0:
            raise InvariantViolation("Prediction.evidence_count cannot be negative")
