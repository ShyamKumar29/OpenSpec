"""Classification result value objects (`CLS`, M1 — docs/10-roadmap.md M1,
docs/02-architecture.md §4's `INGESTED --> CLASSIFIED: CLS` /
`INGESTED --> CLASS_UNRESOLVED: CLS abstains` transitions).

Mirrors the `AttributeValueUnknown` / `AttributeValueAsserted` sealed-union
pattern in `domain/model/attribute.py`: classification either resolves to a
class the taxonomy already knows about, evidenced and explainable, or it
abstains with a reason — there is no third shape that could hold a
fabricated class. This is what makes "an LLM may propose a class, it must
NOT create a class" (M1 brief) structural rather than a convention: nothing
in this module can represent a class outside whatever closed set the caller
validates against (`application/usecases/classify_record.py`).

`class_code` is deliberately a plain string, not `TaxonomyClass` or
`LovClasspath` — `CLS` is agnostic to *which* taxonomy source produced the
closed set of valid codes (the hand-authored ADR-0011 fixture today; a
`LovClasspath.render()` once the client's Unicat LOV exists, per
`docs/16-unilog-alignment.md` UH3). Coupling this module to one shape would
be "a second taxonomy system" the M1 brief explicitly forbids building.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import Evidence, UnknownReason


class ClassificationMethod(StrEnum):
    """Provenance of a classification decision (M1 brief: "Classification
    confidence + provenance (`rule` / `llm`)"). Mirrors `ProvenanceKind`'s
    role in `attribute.py` without reusing it directly — a class assignment
    isn't an `AttributeValue` and EXTRACTED/DERIVED/INFERRED don't fit its
    two real methods."""

    RULE = "RULE"
    LLM = "LLM"


@dataclass(frozen=True, slots=True)
class ClassificationCandidate:
    """One taxonomy class code under consideration, with the method and
    rationale that produced it — the explainability chain the M1 brief
    requires ("source input -> classification method -> candidate ->
    evidence/rationale -> confidence -> final decision"), one candidate at a
    time. `confidence` for an `LLM`-method candidate must never be the
    model's own self-report (CLAUDE.md: "Confidence is a calibrated
    composite of measured signals, never a model self-report") — the only
    measured signal available at classification time is "did this proposal
    survive taxonomy validation", so `application/usecases/classify_record.py`
    assigns a fixed, policy-configured confidence to a validated LLM
    proposal, never one read out of the response text."""

    class_code: str
    confidence: float
    method: ClassificationMethod
    rationale: str

    def __post_init__(self) -> None:
        if not self.class_code.strip():
            raise InvariantViolation("ClassificationCandidate.class_code must be non-blank")
        if not (0.0 <= self.confidence <= 1.0):
            raise InvariantViolation(f"confidence out of range [0,1]: {self.confidence}")
        if not self.rationale.strip():
            raise InvariantViolation(
                "ClassificationCandidate.rationale must be non-blank (explainability)"
            )


@dataclass(frozen=True, slots=True)
class ClassificationResolved:
    """A class assignment with evidence a human could audit — the
    `INGESTED --> CLASSIFIED` transition's payload. `evidence` extends
    INV-1's "no unsourced assertion" discipline to classification: a
    resolved class always cites the text that produced it."""

    record_id: str
    candidate: ClassificationCandidate
    evidence: tuple[Evidence, ...]

    def __post_init__(self) -> None:
        if not self.evidence:
            raise InvariantViolation(
                "ClassificationResolved requires at least one evidence item "
                "(INV-1's discipline extended to CLS)"
            )


@dataclass(frozen=True, slots=True)
class ClassificationUnresolved:
    """Abstention — the `INGESTED --> CLASS_UNRESOLVED` transition's payload
    (`PipelineState.CLASS_UNRESOLVED`, `domain/model/states.py`). `attempted`
    records every candidate considered and rejected (low confidence,
    ambiguous tie, taxonomy-rejected LLM proposal, LLM unavailable) so an
    unresolved classification is still explainable, never opaque — "do not
    produce opaque classifications" (M1 brief)."""

    record_id: str
    reason: UnknownReason
    attempted: tuple[ClassificationCandidate, ...]
    rationale: str

    def __post_init__(self) -> None:
        if not self.rationale.strip():
            raise InvariantViolation("ClassificationUnresolved.rationale must be non-blank")


ClassificationResult = ClassificationResolved | ClassificationUnresolved


def is_unresolved(result: ClassificationResult) -> bool:
    return isinstance(result, ClassificationUnresolved)
