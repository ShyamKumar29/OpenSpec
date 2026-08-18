"""Tests for `infrastructure/reference_data/faucets_lov.py` (UH6 —
docs/16-unilog-alignment.md §4, ADR-0014). Fixture-only, never real
FAUCETS_LOV.xlsx data — see `test_fittings_lov_adapter.py` for the shared
adapter's fuller coverage; this file only proves the Faucets-specific loader
seam fails loudly.
"""

from __future__ import annotations

import pytest

from openspec.domain.model.taxonomy import CanonicalValueMapping, ProductCategory
from openspec.infrastructure.reference_data.canonical_value_lov import CanonicalValueLovAdapter
from openspec.infrastructure.reference_data.errors import ReferenceDataMissing
from openspec.infrastructure.reference_data.faucets_lov import load_faucets_lov_reference


def test_adapter_resolves_faucets_category_mapping() -> None:
    mappings = (
        CanonicalValueMapping(ProductCategory.FAUCETS, "Mount Type", "Deck Mount", "DECK_MOUNT"),
    )
    adapter = CanonicalValueLovAdapter(mappings)
    assert (
        adapter.canonical_value(
            category=ProductCategory.FAUCETS,
            attribute_label="Mount Type",
            variant_value="Deck Mount",
        )
        == "DECK_MOUNT"
    )


def test_load_faucets_lov_reference_raises_when_workbook_missing() -> None:
    with pytest.raises(ReferenceDataMissing, match="faucets_lov"):
        load_faucets_lov_reference()
