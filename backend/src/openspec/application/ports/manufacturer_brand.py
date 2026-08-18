"""`ManufacturerBrandReference` — the port `RES` resolves against (UH2,
docs/16-unilog-alignment.md G3). `application/` depends on this `Protocol`
only, never a concrete adapter — `infrastructure/reference_data/
manufacturer_brand_list.py` provides the one production-shaped implementation
today (currently unbuildable for real: the approved workbook this port would
index, `UniCat_Manufacturer_and_Brand_List.xlsx`, is not present in this
environment — see that module's docstring). Test fixtures provide small,
explicitly-labelled stand-ins for `tests/unit/test_manufacturer_brand_resolver.py`.
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.model.manufacturer import ManufacturerBrandCandidate, ManufacturerBrandField


class ManufacturerBrandReference(Protocol):
    """Deterministic lookup over an approved manufacturer/brand vocabulary
    (UH2 brief §7). A `None` reference at the resolver call site means "no
    reference data available in this environment" — turned into
    `UNKNOWN(REFERENCE_DATA_UNAVAILABLE)`, never a guess.

    Implementations are expected to build whatever index they need for the
    first three (deterministic) tiers; `all_candidates` is called only after
    all three miss, so a full scan there is the documented, acceptable cost of
    the rare tail — UH2 brief §7 asks to "avoid scanning the entire workbook
    for every product", which this satisfies for the fast path without
    requiring a smarter fuzzy index that no real data exists yet to size."""

    def exact_matches(
        self, raw: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        """Byte-for-byte match against a candidate's `canonical_value`, unnormalised."""
        ...

    def normalized_exact_matches(
        self, normalized: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        """Match against a candidate's normalised `canonical_value`."""
        ...

    def normalized_alias_matches(
        self, normalized: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        """Match against a candidate's normalised `aliases` (UH2 brief §7's
        "alias → canonical entity")."""
        ...

    def all_candidates(
        self, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        """Every approved candidate for `field` — consulted only at the FUZZY tier."""
        ...
