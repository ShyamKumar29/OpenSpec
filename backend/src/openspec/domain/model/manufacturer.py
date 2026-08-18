"""Domain value objects for manufacturer/brand resolution (`RES`, UH2 —
docs/16-unilog-alignment.md G3, ADR-0014).

Manufacturer and brand are distinct concepts (UH2 brief §3) — never conflated
into one field. `ManufacturerBrandField` tags which one a candidate or
resolution attempt is for.

Pure data shapes only; no matching logic lives here. The deterministic
normalisation/scoring functions that operate on these live in
`domain/nrm/manufacturer_brand.py` (INV-6: domain stays free of I/O, clock,
randomness). The orchestration that decides EXACT vs NORMALIZED_EXACT vs FUZZY
and turns a match into an `AttributeValue` lives in
`application/usecases/resolve_manufacturer_brand.py` — candidate search over an
external reference table is application-layer work, not domain, per
`docs/05-backend.md` and CLAUDE.md's "Where AI is allowed" table (candidate
search is code either way, AI or not; it just isn't a pure domain computation
because it depends on an injected reference-data port).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation


class ManufacturerBrandField(StrEnum):
    """Which of the two distinct concepts (UH2 brief §3) a candidate or
    resolution attempt is for. Matches the Delivery Format's own column names
    (`MANUFACTURER_NAME`, `BRAND_NAME` — verified against
    `resources/reference/unihack/delivery_format.csv`'s actual header)."""

    MANUFACTURER = "MANUFACTURER"
    BRAND = "BRAND"


class ResolutionMethod(StrEnum):
    """How a candidate was reached — logged on every match so ranking is
    explainable (UH2 brief §7: "do not hide fuzzy matching behind an opaque
    score"). Never inferred after the fact from the score alone."""

    EXACT = "EXACT"  # raw string identical, byte-for-byte, to the approved value
    NORMALIZED_EXACT = "NORMALIZED_EXACT"  # equal only after deterministic normalisation
    ALIAS = "ALIAS"  # matched a known alternate spelling on file for the candidate
    FUZZY = "FUZZY"  # matched only by similarity score — never auto-accepted alone (UH2 brief §4)


@dataclass(frozen=True, slots=True)
class ManufacturerBrandCandidate:
    """One row of an *approved* manufacturer/brand reference table (UH2 brief
    §7 — e.g. `UniCat_Manufacturer_and_Brand_List.xlsx`; not present in this
    environment, see `infrastructure/reference_data/manufacturer_brand_list.py`).

    The resolver may only ever assert a `canonical_value` that traces back to
    one of these — "never resolve to a value outside the approved vocabulary"
    (UH2 brief §7's vocabulary-boundary rule)."""

    reference_dataset: str
    row_key: str
    field: ManufacturerBrandField
    canonical_value: str
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.reference_dataset:
            raise InvariantViolation(
                "ManufacturerBrandCandidate.reference_dataset must be non-empty"
            )
        if not self.row_key:
            raise InvariantViolation("ManufacturerBrandCandidate.row_key must be non-empty")
        if not self.canonical_value.strip():
            raise InvariantViolation("ManufacturerBrandCandidate.canonical_value must be non-blank")


@dataclass(frozen=True, slots=True)
class ScoredCandidate:
    """A candidate plus how it was reached — the unit the resolver ranks over.
    `score` is `1.0` for `EXACT`/`NORMALIZED_EXACT`/`ALIAS` (deterministic,
    unambiguous string equality) and the raw similarity ratio in `[0, 1)` for
    `FUZZY` (`domain/nrm/manufacturer_brand.py:fuzzy_similarity`)."""

    candidate: ManufacturerBrandCandidate
    method: ResolutionMethod
    score: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.score <= 1.0):
            raise InvariantViolation(f"ScoredCandidate.score out of range [0,1]: {self.score}")
