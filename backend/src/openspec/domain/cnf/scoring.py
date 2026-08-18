"""Composite confidence scoring (`CNF`, UH6 — docs/16-unilog-alignment.md
UH6). A raw score is a weighted average of named, individually-measured
signals — never a single model-reported number (CLAUDE.md: "Confidence is a
calibrated composite of measured signals, never a model self-report").
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.errors import InvariantViolation


@dataclass(frozen=True, slots=True)
class ConfidenceSignal:
    """One measured signal feeding the composite score — e.g.
    `"deterministic_match_strength"`, `"lov_membership"`,
    `"source_agreement"`. `value` is the signal itself (already normalised to
    `[0, 1]` by whatever measured it); `weight` is this signal's contribution
    to the composite, config-driven, never a literal buried in a stage."""

    name: str
    value: float
    weight: float

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise InvariantViolation("ConfidenceSignal.name must be non-blank")
        if not (0.0 <= self.value <= 1.0):
            raise InvariantViolation(f"ConfidenceSignal.value out of range [0,1]: {self.value}")
        if self.weight < 0:
            raise InvariantViolation(f"ConfidenceSignal.weight must be >= 0: {self.weight}")


def composite_raw_score(signals: tuple[ConfidenceSignal, ...]) -> float:
    """Weighted average of `signals`, in `[0, 1]`. Deterministic: identical
    input always produces the identical output (no clock, no randomness)."""
    if not signals:
        raise InvariantViolation("composite_raw_score requires at least one signal")
    total_weight = sum(s.weight for s in signals)
    if total_weight <= 0:
        raise InvariantViolation("composite_raw_score requires total weight > 0")
    return sum(s.value * s.weight for s in signals) / total_weight
