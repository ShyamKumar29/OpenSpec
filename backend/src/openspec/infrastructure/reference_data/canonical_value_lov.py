"""Shared adapter for the two category-specific canonicalisation workbooks
(`Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx` — UH3/UH6, ADR-0014). Both files are
described identically in the design docs: a many-to-one variant -> canonical
mapping per attribute, scoped to one `ProductCategory`. One adapter
implementation serves both rather than two near-identical copies —
`infrastructure/reference_data/fittings_lov.py` and `faucets_lov.py` are thin
wrappers naming which missing dataset and category apply.
"""

from __future__ import annotations

from openspec.domain.model.taxonomy import (
    CanonicalValueMapping,
    ProductCategory,
    index_canonical_values,
)


class CanonicalValueLovAdapter:
    """Indexed, in-memory implementation of
    `application.ports.taxonomy.CanonicalValueReference`. Built once from a
    flat `CanonicalValueMapping` tuple; `canonical_value` is an O(1) dict
    lookup — the same shape `ManufacturerBrandListAdapter` and
    `TaxonomyLovAdapter` already use."""

    def __init__(self, mappings: tuple[CanonicalValueMapping, ...]) -> None:
        self._index = index_canonical_values(mappings)

    def canonical_value(
        self, *, category: ProductCategory, attribute_label: str, variant_value: str
    ) -> str | None:
        return self._index.get((category, attribute_label, variant_value))
