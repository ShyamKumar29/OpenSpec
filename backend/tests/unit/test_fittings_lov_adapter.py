"""Tests for `infrastructure/reference_data/fittings_lov.py` (UH3/UH4 —
docs/16-unilog-alignment.md §4, ADR-0014). Shaped after ADR-0014's own worked
example (connection type + material construction), but with a handful of
rows, explicitly a test fixture — never real Fittings_LOV.xlsx data.
"""

from __future__ import annotations

import pytest

from openspec.domain.model.taxonomy import CanonicalValueMapping, ProductCategory
from openspec.infrastructure.reference_data.canonical_value_lov import CanonicalValueLovAdapter
from openspec.infrastructure.reference_data.errors import ReferenceDataMissing
from openspec.infrastructure.reference_data.fittings_lov import load_fittings_lov_reference

_FIXTURE_MAPPINGS = (
    CanonicalValueMapping(ProductCategory.FITTINGS, "Connection Type", "Sweat", "SOLDER"),
    CanonicalValueMapping(ProductCategory.FITTINGS, "Connection Type", "CxC", "SOLDER"),
    CanonicalValueMapping(ProductCategory.FITTINGS, "Connection Type", "FIP", "NPT_FEMALE"),
    CanonicalValueMapping(ProductCategory.FITTINGS, "Material Construction", "Cu", "COPPER"),
)


class TestCanonicalValueLovAdapterAsFittings:
    def test_many_variants_resolve_to_one_canonical(self) -> None:
        adapter = CanonicalValueLovAdapter(_FIXTURE_MAPPINGS)
        assert (
            adapter.canonical_value(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="Sweat",
            )
            == "SOLDER"
        )
        assert (
            adapter.canonical_value(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="CxC",
            )
            == "SOLDER"
        )

    def test_unknown_variant_returns_none(self) -> None:
        adapter = CanonicalValueLovAdapter(_FIXTURE_MAPPINGS)
        assert (
            adapter.canonical_value(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="Never Seen",
            )
            is None
        )

    def test_wrong_category_does_not_leak_across(self) -> None:
        adapter = CanonicalValueLovAdapter(_FIXTURE_MAPPINGS)
        assert (
            adapter.canonical_value(
                category=ProductCategory.FAUCETS,
                attribute_label="Connection Type",
                variant_value="Sweat",
            )
            is None
        )


def test_load_fittings_lov_reference_raises_when_workbook_missing() -> None:
    with pytest.raises(ReferenceDataMissing, match="fittings_lov"):
        load_fittings_lov_reference()
