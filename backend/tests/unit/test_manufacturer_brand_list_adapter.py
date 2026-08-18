"""`ManufacturerBrandListAdapter` indexing tests (`RES`, UH2 —
docs/16-unilog-alignment.md G3, UH2 brief §7: "build lookup structures for
efficient deterministic resolution ... avoid scanning the entire workbook for
every product"). Uses a small, explicitly-labelled test fixture — NOT the
real `UniCat_Manufacturer_and_Brand_List.xlsx` (missing in this environment,
see `infrastructure/reference_data/manufacturer_brand_list.py`).
"""

from __future__ import annotations

import pytest

from openspec.domain.model.manufacturer import ManufacturerBrandCandidate, ManufacturerBrandField
from openspec.infrastructure.reference_data.errors import ReferenceDataMissing
from openspec.infrastructure.reference_data.manufacturer_brand_list import (
    ManufacturerBrandListAdapter,
    load_manufacturer_brand_reference,
)

# TEST FIXTURE — not real UniCat data.
_FREUD = ManufacturerBrandCandidate(
    reference_dataset="test_fixture_manufacturer_brand_list",
    row_key="1",
    field=ManufacturerBrandField.MANUFACTURER,
    canonical_value="Freud Inc",
    aliases=("Freud Tools",),
)
_FRIGIDAIRE = ManufacturerBrandCandidate(
    reference_dataset="test_fixture_manufacturer_brand_list",
    row_key="2",
    field=ManufacturerBrandField.BRAND,
    canonical_value="Frigidaire",
)


class TestExactLookup:
    def test_finds_byte_identical_candidate(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD, _FRIGIDAIRE))
        hits = adapter.exact_matches("Freud Inc", field=ManufacturerBrandField.MANUFACTURER)
        assert hits == (_FREUD,)

    def test_scoped_to_field_never_crosses_manufacturer_and_brand(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD, _FRIGIDAIRE))
        assert adapter.exact_matches("Freud Inc", field=ManufacturerBrandField.BRAND) == ()

    def test_miss_returns_empty_tuple_not_none(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD,))
        assert adapter.exact_matches("Nonexistent", field=ManufacturerBrandField.MANUFACTURER) == ()


class TestNormalizedLookup:
    def test_finds_case_and_symbol_variant(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FRIGIDAIRE,))
        hits = adapter.normalized_exact_matches("frigidaire", field=ManufacturerBrandField.BRAND)
        assert hits == (_FRIGIDAIRE,)


class TestAliasLookup:
    def test_finds_via_known_alias(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD,))
        hits = adapter.normalized_alias_matches(
            "freud tools", field=ManufacturerBrandField.MANUFACTURER
        )
        assert hits == (_FREUD,)

    def test_canonical_value_itself_is_not_in_the_alias_index(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD,))
        assert (
            adapter.normalized_alias_matches("freud inc", field=ManufacturerBrandField.MANUFACTURER)
            == ()
        )


class TestAllCandidates:
    def test_returns_every_candidate_for_the_field(self) -> None:
        adapter = ManufacturerBrandListAdapter((_FREUD, _FRIGIDAIRE))
        assert adapter.all_candidates(field=ManufacturerBrandField.MANUFACTURER) == (_FREUD,)
        assert adapter.all_candidates(field=ManufacturerBrandField.BRAND) == (_FRIGIDAIRE,)

    def test_empty_field_returns_empty_tuple(self) -> None:
        adapter = ManufacturerBrandListAdapter(())
        assert adapter.all_candidates(field=ManufacturerBrandField.MANUFACTURER) == ()


class TestMissingWorkbookFailsLoudly:
    def test_load_raises_reference_data_missing(self) -> None:
        """The real workbook (`UniCat_Manufacturer_and_Brand_List.xlsx`) is
        not present anywhere in this environment — re-verified at the start
        of this UH2 session. This must fail loudly, never return an empty or
        fabricated adapter."""
        with pytest.raises(ReferenceDataMissing, match="manufacturer_brand_list"):
            load_manufacturer_brand_reference()
