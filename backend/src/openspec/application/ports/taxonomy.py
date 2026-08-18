"""`TaxonomyReference` / `CanonicalValueReference` — the ports `SCH` resolves
against (UH3, docs/16-unilog-alignment.md UH3, ADR-0014). `application/`
depends on these `Protocol`s only, never a concrete adapter —
`infrastructure/reference_data/taxonomy_lov.py`,
`infrastructure/reference_data/fittings_lov.py`, and
`infrastructure/reference_data/faucets_lov.py` are the production-shaped
implementations, currently unbuildable for real because their source
workbooks are not present in this environment (see those modules'
docstrings). Mirrors `application/ports/manufacturer_brand.py`'s pattern.
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.model.taxonomy import (
    LovAttributeDefinition,
    LovClasspath,
    ProductCategory,
)


class TaxonomyReference(Protocol):
    """Deterministic lookup over the client's LOV/Classpath vocabulary
    (ADR-0014). A `None` reference at a use-case call site means "no LOV data
    available in this environment" — turned into an explicit blocked
    resolution, never a guess at what the schema should be."""

    def attribute_definitions(self, classpath: LovClasspath) -> tuple[LovAttributeDefinition, ...]:
        """Every attribute definition scoped to exactly this classpath (not
        its ancestors or descendants — callers resolve hierarchy explicitly
        via `LovClasspath.is_under` if they need it)."""
        ...

    def all_classpaths(self) -> tuple[LovClasspath, ...]:
        """Every distinct classpath the loaded LOV extract covers."""
        ...


class CanonicalValueReference(Protocol):
    """Deterministic many-to-one variant -> canonical lookup for one category
    (`Fittings_LOV.xlsx` / `FAUCETS_LOV.xlsx` — ADR-0014's "1,472 -> 515"
    example)."""

    def canonical_value(
        self, *, category: ProductCategory, attribute_label: str, variant_value: str
    ) -> str | None:
        """`None` means the variant is not a known mapping for this
        category+attribute — the caller's job to turn that into
        `Unknown(NO_CANDIDATE_MATCH)` or similar, never to guess a value."""
        ...
