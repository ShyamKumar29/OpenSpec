"""`CatalogRecord` and the `Mpn` value object (docs/04-data-model.md §3.1).

`CatalogRecord` itself is immutable — "Never mutated" per the data model doc. What
changes over a record's life is its set of current `AttributeValue`s, which live and
supersede independently (append-only, docs §3.4/§5).
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.errors import InvariantViolation


@dataclass(frozen=True, slots=True)
class Mpn:
    """Prevents comparing a raw MPN to a canonical one by accident (docs/05-backend.md
    §3.2) — the classic bug this value object exists to make unrepresentable."""

    raw: str
    canonical: str

    def __post_init__(self) -> None:
        if not self.raw.strip():
            raise InvariantViolation("Mpn.raw must not be blank")
        if not self.canonical.strip():
            raise InvariantViolation("Mpn.canonical must not be blank")


@dataclass(frozen=True, slots=True)
class ClassRef:
    id: str
    code: str
    name: str
    confidence: float
    provenance_kind: str  # ProvenanceKind, kept as str to avoid a circular import
    signal: str


@dataclass(frozen=True, slots=True)
class CatalogRecord:
    """Immutable input-side record (docs/04-data-model.md §3.1). `mpn_variants` is a
    generated array of normalised forms used for binding lookups — computed, not
    stored input, so it lives in `application`/`infrastructure`, not here."""

    id: str
    tenant_id: str
    mpn: Mpn
    description_raw: str
    supplier_name: str | None
    source_batch_id: str | None
    created_at: str


class RecordStatus:
    """String constants mirroring `frontend/lib/contracts/record.ts` `RecordStatus`.
    Not an enum: these values are also record *state-machine phases* used purely for
    dashboard/queue framing in the mock today, not the full `PipelineState` machine
    (`domain/model/states.py`) — kept as constants here rather than duplicating that
    machine's vocabulary."""

    HEALTHY = "healthy"
    INCOMPLETE = "incomplete"
    PARTIALLY_ENRICHED = "partially_enriched"
    AWAITING_TIER0_APPROVAL = "awaiting_tier0_approval"
    UNKNOWN_HEAVY = "unknown_heavy"
    CONFLICTING_SOURCES = "conflicting_sources"
    CLASS_UNRESOLVED = "class_unresolved"
    UNBOUND = "unbound"
