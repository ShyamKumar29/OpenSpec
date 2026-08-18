"""`AttributeValue` — the central domain type (docs/api.md, docs/04-data-model.md §3.4).

Mirrors `frontend/lib/contracts/attribute-value.ts` field-for-field so the API layer
can serialise this straight onto the wire shape the frontend already expects.

**INV-1 is structural here, not merely validated.** `AttributeValueAsserted` cannot
exist with empty evidence — its `__post_init__` raises `InvariantViolation` the
instant such an object would come into being, regardless of which code path
constructed it. **INV-4** is structural the same way: `AttributeValueUnknown` has no
field to hold a value, only a `reason_code`. There is no way to build a plain
"AttributeValue" with a value and no evidence — the two are different types, and the
factories below (the only documented construction path, docs/05-backend.md §3.1) are
the sole intended entry point.

**Evidence is a tagged union (UH1, `docs/16-unilog-alignment.md` G1).** The original
design assumed every value traces to a PDF span. The UniHack dataset proved that
assumption too narrow: most ground-truth values here come from the supplier's own
input row or an approved reference table (LOV, manufacturer list), never a
manufacturer PDF. `Evidence` is therefore `DocumentSpan | SourceRowSpan |
ReferenceTableRow` — INV-1 ("no unsourced assertion") and INV-3 ("the cited span
must deterministically contain/entail the value") apply identically to all three;
only what "the cited span" *is* differs. This widens what counts as evidence — it
does not weaken the requirement that evidence exist and be checkable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from openspec.domain.errors import InvariantViolation

# ---- Enums (closed sets — INV-4's reason codes, INV-5's provenance kinds) --------


class UnknownReason(StrEnum):
    NO_DOCUMENT_FOUND = "NO_DOCUMENT_FOUND"
    DOCUMENT_LOW_CONFIDENCE = "DOCUMENT_LOW_CONFIDENCE"
    DOCUMENT_UNPARSEABLE = "DOCUMENT_UNPARSEABLE"
    ATTRIBUTE_NOT_IN_DOCUMENT = "ATTRIBUTE_NOT_IN_DOCUMENT"
    AMBIGUOUS_CANDIDATES = "AMBIGUOUS_CANDIDATES"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    NORMALIZATION_FAILED = "NORMALIZATION_FAILED"
    BELOW_CONFIDENCE_THRESHOLD = "BELOW_CONFIDENCE_THRESHOLD"
    CLASS_UNRESOLVED = "CLASS_UNRESOLVED"
    CONFLICTING_SOURCES = "CONFLICTING_SOURCES"
    POLICY_BLOCKED = "POLICY_BLOCKED"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    # UH2 (docs/16-unilog-alignment.md G3) — manufacturer/brand resolution (`RES`).
    # Three additions, each a distinct semantic `AMBIGUOUS_CANDIDATES` cannot cover:
    NO_BRAND_DECLARED = "NO_BRAND_DECLARED"  # source explicitly says "no brand" (a placeholder
    # token like `-- Unbranded --`) — a known absence, not a resolver failure.
    NO_CANDIDATE_MATCH = "NO_CANDIDATE_MATCH"  # reference data was available but nothing —
    # not even a low-confidence fuzzy candidate — cleared the resolution policy's floor.
    REFERENCE_DATA_UNAVAILABLE = "REFERENCE_DATA_UNAVAILABLE"  # the approved reference table
    # itself is missing in this environment (see infrastructure/reference_data/
    # missing_datasets.py) — an environment gap, not a resolution outcome. Distinct from
    # `NO_CANDIDATE_MATCH`: here the resolver never got to look.
    # UH4 (docs/16-unilog-alignment.md UH4) — verbatim source-row extraction (`EXT`).
    SOURCE_FIELD_BLANK = "SOURCE_FIELD_BLANK"  # the source row's own cell for this attribute
    # is empty — there is nothing to cite, so extraction abstains rather than asserting an
    # empty string. Distinct from `NO_DOCUMENT_FOUND`: there is no document in play at all
    # for a source-row-derived attribute.


class ProvenanceKind(StrEnum):
    """INV-5: ranked EXTRACTED > DERIVED > INFERRED; HUMAN stands apart and is never
    compared on this scale (see `provenance_rank` below)."""

    EXTRACTED = "EXTRACTED"
    DERIVED = "DERIVED"
    INFERRED = "INFERRED"
    HUMAN = "HUMAN"


_PROVENANCE_RANK = {
    ProvenanceKind.INFERRED: 0,
    ProvenanceKind.DERIVED: 1,
    ProvenanceKind.EXTRACTED: 2,
}


def provenance_rank(kind: ProvenanceKind) -> int:
    """Ordinal for INV-5's "never upgraded" rule. Raises for `HUMAN`, which a
    correction always supersedes regardless of the prior kind — it is not part of
    this ordering (docs/04-data-model.md §5: human corrections always supersede)."""
    if kind is ProvenanceKind.HUMAN:
        raise InvariantViolation("HUMAN provenance is not ranked; it always supersedes")
    return _PROVENANCE_RANK[kind]


def assert_no_provenance_downgrade(current: ProvenanceKind, proposed: ProvenanceKind) -> None:
    """INV-5 as a callable guard: a superseding value's provenance must never rank
    below the value it replaces (HUMAN is exempt — a human correction always wins)."""
    if proposed is ProvenanceKind.HUMAN or current is ProvenanceKind.HUMAN:
        return
    if provenance_rank(proposed) < provenance_rank(current):
        raise InvariantViolation(
            f"INV-5 violation: cannot supersede {current.value} with lower-ranked {proposed.value}"
        )


class AttributeValueStatus(StrEnum):
    ACCEPTED = "ACCEPTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"
    UNKNOWN = "UNKNOWN"
    SUPERSEDED = "SUPERSEDED"


# ---- Supporting value objects -----------------------------------------------------


class EvidenceKind(StrEnum):
    """Discriminator for the `Evidence` tagged union (UH1). Stored directly on each
    variant (`init=False`, like `AttributeValueUnknown.status`) so a serialiser never
    has to infer the kind from field presence or a `type()` check."""

    DOCUMENT_SPAN = "DOCUMENT_SPAN"
    SOURCE_ROW_SPAN = "SOURCE_ROW_SPAN"
    REFERENCE_TABLE_ROW = "REFERENCE_TABLE_ROW"


@dataclass(frozen=True, slots=True)
class DocumentSpan:
    """Evidence anchored in a parsed manufacturer document. `bbox` is
    `(x0, y0, x1, y1)` in the same pixel space as the rendered page image for
    `(document_version_id, page, dpi)` — docs/api.md §Documents. The original (and,
    pre-UH1, only) `Evidence` shape — unchanged in field-for-field terms."""

    document_version_id: str
    page: int
    region_id: str
    char_start: int
    char_end: int
    snippet_text: str
    bbox: tuple[float, float, float, float]
    kind: EvidenceKind = field(default=EvidenceKind.DOCUMENT_SPAN, init=False)

    def __post_init__(self) -> None:
        if self.page < 1:
            raise InvariantViolation("DocumentSpan.page must be >= 1")
        if self.char_start < 0 or self.char_end < self.char_start:
            raise InvariantViolation("DocumentSpan char_start/char_end out of order")
        if not self.snippet_text:
            raise InvariantViolation("Evidence.snippet_text must be non-empty (INV-3)")


@dataclass(frozen=True, slots=True)
class SourceRowSpan:
    """Evidence read straight from the supplier/input dataset row itself — e.g. a
    `sample_input.csv` row's `Part_Desc` cell — never a document, never a curated
    reference table. `source_dataset` + `row_identifier` distinguish *which* input
    file and row (traceability); `source_column` + `snippet_text` distinguish
    *which* field and its verbatim value (what was actually cited).

    Named `source_column`, not `column` — a bare `column` field on a dataclass in
    this module would shadow the `dataclasses.field` helper used two lines below
    for `kind`, which is a real `mypy --strict` error (`"str" not callable`), not
    just a style preference."""

    source_dataset: str
    row_identifier: str
    source_column: str
    snippet_text: str
    kind: EvidenceKind = field(default=EvidenceKind.SOURCE_ROW_SPAN, init=False)

    def __post_init__(self) -> None:
        if not self.source_dataset:
            raise InvariantViolation("SourceRowSpan.source_dataset must be non-empty")
        if not self.row_identifier:
            raise InvariantViolation("SourceRowSpan.row_identifier must be non-empty")
        if not self.source_column:
            raise InvariantViolation("SourceRowSpan.source_column must be non-empty")
        if not self.snippet_text:
            raise InvariantViolation("Evidence.snippet_text must be non-empty (INV-3)")


@dataclass(frozen=True, slots=True)
class ReferenceTableRow:
    """Evidence read from an approved, curated reference table/LOV — e.g. a row of
    `UniCat_Manufacturer_and_Brand_List.xlsx` or `Fittings_LOV.xlsx` — distinct from
    `SourceRowSpan` because this is client-supplied controlled vocabulary, not
    supplier-submitted data. `reference_dataset` + `row_key` distinguish *which*
    table and row; `reference_field` + `snippet_text` distinguish *which* column
    and its verbatim value. Named `reference_field`, not `field`, for the same
    reason `SourceRowSpan` uses `source_column` — see that docstring."""

    reference_dataset: str
    row_key: str
    reference_field: str
    snippet_text: str
    kind: EvidenceKind = field(default=EvidenceKind.REFERENCE_TABLE_ROW, init=False)

    def __post_init__(self) -> None:
        if not self.reference_dataset:
            raise InvariantViolation("ReferenceTableRow.reference_dataset must be non-empty")
        if not self.row_key:
            raise InvariantViolation("ReferenceTableRow.row_key must be non-empty")
        if not self.reference_field:
            raise InvariantViolation("ReferenceTableRow.reference_field must be non-empty")
        if not self.snippet_text:
            raise InvariantViolation("Evidence.snippet_text must be non-empty (INV-3)")


Evidence = DocumentSpan | SourceRowSpan | ReferenceTableRow


@dataclass(frozen=True, slots=True)
class Verification:
    """INV-2: nothing reaches ACCEPTED without one of these attached."""

    verdict: str  # "ENTAILED" | "PARTIAL" | "NOT_ENTAILED"
    deterministic_check: str  # "exact" | "normalised" | "partial" | "fail"
    rationale: str
    verifier_model: str

    def __post_init__(self) -> None:
        if self.verdict not in {"ENTAILED", "PARTIAL", "NOT_ENTAILED"}:
            raise InvariantViolation(f"Unknown verification verdict: {self.verdict!r}")


@dataclass(frozen=True, slots=True)
class AttributeRef:
    code: str
    name: str
    datatype: str
    risk_tier: int
    is_mandatory: bool

    def __post_init__(self) -> None:
        if self.risk_tier not in (0, 1, 2, 3):
            raise InvariantViolation(f"risk_tier must be 0-3, got {self.risk_tier}")


# ---- AttributeValue — the sealed union -------------------------------------------


@dataclass(frozen=True, slots=True)
class AttributeValueUnknown:
    """INV-4: a first-class Unknown. There is no field on this type that could hold
    a value — abstention and assertion are different shapes, not a nullable field."""

    id: str
    attribute: AttributeRef
    created_at: str
    unknown_reason: UnknownReason
    status: AttributeValueStatus = field(default=AttributeValueStatus.UNKNOWN, init=False)


@dataclass(frozen=True, slots=True)
class AttributeValueAsserted:
    """A value with evidence. Constructible directly (dataclasses have no private
    constructor in Python) but `__post_init__` makes a fabricated instance impossible
    to hold onto: any attempt to build one with empty evidence raises immediately."""

    id: str
    attribute: AttributeRef
    created_at: str
    status: AttributeValueStatus
    value_display: str
    value_canonical: dict[str, object] | None
    value_raw: str
    provenance_kind: ProvenanceKind
    confidence: float
    evidence: tuple[Evidence, ...]
    verification: Verification

    def __post_init__(self) -> None:
        if not self.evidence:
            raise InvariantViolation(
                f"INV-1 violation: AttributeValue {self.id} has status "
                f"{self.status.value} with no evidence"
            )
        if self.status is AttributeValueStatus.UNKNOWN:
            raise InvariantViolation("AttributeValueAsserted cannot carry status UNKNOWN")
        if not (0.0 <= self.confidence <= 1.0):
            raise InvariantViolation(f"confidence out of range [0,1]: {self.confidence}")
        if self.status is AttributeValueStatus.ACCEPTED and self.attribute.risk_tier == 0:
            # INV-9, defence in depth — the real gate is a DB CHECK constraint
            # (docs/04-data-model.md §3.4); this is the domain-layer mirror of it so
            # the rule is enforced even before persistence exists in this codebase.
            raise InvariantViolation(
                f"INV-9 violation: Tier-0 attribute {self.attribute.code} cannot be ACCEPTED"
            )


AttributeValue = AttributeValueUnknown | AttributeValueAsserted


def is_unknown(value: AttributeValue) -> bool:
    return isinstance(value, AttributeValueUnknown)


class AttributeValueFactory:
    """The only documented construction path (docs/05-backend.md §3.1):
    ``AttributeValue.extracted(...)`` / ``AttributeValue.unknown(...)``. Exposed as
    `attribute_value` below so call sites read exactly like the doc's example."""

    @staticmethod
    def extracted(
        *,
        id: str,
        attribute: AttributeRef,
        created_at: str,
        status: AttributeValueStatus,
        value_display: str,
        value_canonical: dict[str, object] | None,
        value_raw: str,
        provenance_kind: ProvenanceKind,
        confidence: float,
        evidence: tuple[Evidence, ...],
        verification: Verification,
    ) -> AttributeValueAsserted:
        return AttributeValueAsserted(
            id=id,
            attribute=attribute,
            created_at=created_at,
            status=status,
            value_display=value_display,
            value_canonical=value_canonical,
            value_raw=value_raw,
            provenance_kind=provenance_kind,
            confidence=confidence,
            evidence=evidence,
            verification=verification,
        )

    @staticmethod
    def unknown(
        *,
        id: str,
        attribute: AttributeRef,
        created_at: str,
        reason: UnknownReason,
    ) -> AttributeValueUnknown:
        return AttributeValueUnknown(
            id=id, attribute=attribute, created_at=created_at, unknown_reason=reason
        )


attribute_value = AttributeValueFactory()
