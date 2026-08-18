"""`EXT` candidate types (M3, `docs/10-roadmap.md` M3: "candidate value + mandatory
evidence"). Distinct from `AttributeValue` (`domain/model/attribute.py`) on purpose:
an `ExtractionCandidate` is *pre-verification* — it is what `EXT` proposes, not what
the system asserts. INV-2 ("no unverified source") means a candidate can never be
handed to a consumer as if it were an `AttributeValueAsserted`; only `VER`
(`domain/ver/`, `application/usecases/verify_extraction.py`) may mint one of those,
and only after independently checking the evidence.

Mirrors the `ClassificationResolved`/`ClassificationUnresolved` and
`AttributeValueAsserted`/`AttributeValueUnknown` sealed-union pattern already
established in this codebase: two shapes, no third one that could smuggle a
fabricated value through as if it were a legitimate abstention (or vice versa).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import AttributeRef, Evidence, UnknownReason


class ExtractionMethod(StrEnum):
    """How a candidate's `value_raw` was proposed. Recorded on every candidate so
    `VER` can choose the right independent check (`docs/10-roadmap.md` M3 §9:
    "where deterministic verification is possible, prefer deterministic checks") and
    so `provenance_kind` downstream is never guessed from context."""

    VERBATIM_ROW_FIELD = "VERBATIM_ROW_FIELD"  # the value *is* a source-row cell,
    # quoted with no transformation — the strongest possible case (UH4's
    # MFG_PART_NUM/ITEM_DESCRIPTION path, now expressed as a candidate rather than
    # skipping straight to an asserted value).
    RULE_BASED = "RULE_BASED"  # a deterministic pattern/lookup matched a span of the
    # source text (e.g. a connection-type synonym table hit) — no LLM involved.
    LLM_GROUNDED = "LLM_GROUNDED"  # an LLM proposed the value, constrained to a
    # supplied region/row and required to cite a verbatim span of it.


@dataclass(frozen=True, slots=True)
class ExtractionCandidate:
    """A proposed value with evidence, **not yet verified**. `__post_init__`
    enforces the same "fabrication is unrepresentable" shape `AttributeValueAsserted`
    already uses for evidence (INV-1's discipline applied one stage earlier) — a
    candidate with no evidence, or evidence with no snippet, cannot be constructed at
    all, regardless of which extractor produced it.

    `source_confidence` is the extractor's own signal (rule-match strength, or a
    fixed per-method constant for LLM-proposed candidates — **never the LLM's
    self-reported confidence**, per CLAUDE.md: "Confidence is a calibrated composite
    of measured signals, never a model self-report"). It is explicitly *not* the
    value that ends up on a final `AttributeValueAsserted.confidence` — that is
    `CNF`'s job (M4); `VER`/`VAL` here never read this field to decide accept/reject,
    only the evidence itself does (`docs/10-roadmap.md` M3 §9: "Do not make
    verification: candidate.confidence >= 0.8 -> accepted")."""

    id: str
    attribute: AttributeRef
    value_raw: str
    evidence: tuple[Evidence, ...]
    method: ExtractionMethod
    source_confidence: float
    rationale: str

    def __post_init__(self) -> None:
        if not self.evidence:
            raise InvariantViolation(
                f"ExtractionCandidate {self.id}: no evidence — "
                "EXT must never propose a value with nothing to cite"
            )
        if not self.value_raw.strip():
            raise InvariantViolation(f"ExtractionCandidate {self.id}: value_raw must be non-blank")
        if not self.rationale.strip():
            raise InvariantViolation(f"ExtractionCandidate {self.id}: rationale must be non-blank")
        if not (0.0 <= self.source_confidence <= 1.0):
            raise InvariantViolation(
                f"ExtractionCandidate {self.id}: source_confidence out of range "
                f"[0,1]: {self.source_confidence}"
            )


@dataclass(frozen=True, slots=True)
class ExtractionUnavailable:
    """EXT's abstention shape — mirrors `ClassificationUnresolved`. Used when the
    source material genuinely has nothing to cite (blank field, no bound document,
    no rule/LLM match) — never a placeholder candidate with an empty snippet."""

    attribute: AttributeRef
    reason: UnknownReason
    detail: str

    def __post_init__(self) -> None:
        if not self.detail.strip():
            raise InvariantViolation("ExtractionUnavailable.detail must be non-blank")


ExtractionResult = ExtractionCandidate | ExtractionUnavailable


def is_unavailable(result: ExtractionResult) -> bool:
    return isinstance(result, ExtractionUnavailable)
