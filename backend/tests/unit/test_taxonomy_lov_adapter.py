"""Tests for `infrastructure/reference_data/taxonomy_lov.py` (UH3 —
docs/16-unilog-alignment.md UH3). `TaxonomyLovAdapter` is exercised against a
small, explicitly-labelled fixture — never real Unicat data (module docstring
in the file under test explains why).
"""

from __future__ import annotations

import pytest

from openspec.domain.model.taxonomy import LovClasspath, LovRow
from openspec.infrastructure.reference_data.errors import ReferenceDataMissing
from openspec.infrastructure.reference_data.taxonomy_lov import (
    TaxonomyLovAdapter,
    load_taxonomy_lov_reference,
)

_FITTINGS_CP = LovClasspath.parse("Plumbing>Fittings>Copper Fittings")
_FAUCETS_CP = LovClasspath.parse("Plumbing>Faucets>Kitchen Faucets")

_FIXTURE_ROWS = (
    LovRow(
        classpath=_FITTINGS_CP,
        leaf_node="Copper Fittings",
        filtering=True,
        attribute_label="Connection Type",
        attribute_value_raw="Sweat",
        normalized_label="Connection Type",
        normalized_value="SOLDER",
        guidelines="",
        remarks="not real Unicat data — test fixture",
    ),
    LovRow(
        classpath=_FITTINGS_CP,
        leaf_node="Copper Fittings",
        filtering=True,
        attribute_label="Connection Type",
        attribute_value_raw="FIP",
        normalized_label="Connection Type",
        normalized_value="NPT_FEMALE",
        guidelines="",
        remarks="not real Unicat data — test fixture",
    ),
    LovRow(
        classpath=_FAUCETS_CP,
        leaf_node="Kitchen Faucets",
        filtering=False,
        attribute_label="Mount Type",
        attribute_value_raw="Deck",
        normalized_label="Mount Type",
        normalized_value="DECK_MOUNT",
        guidelines="",
        remarks="not real Unicat data — test fixture",
    ),
)


class TestTaxonomyLovAdapter:
    def test_attribute_definitions_scoped_to_classpath(self) -> None:
        adapter = TaxonomyLovAdapter(_FIXTURE_ROWS)
        defs = adapter.attribute_definitions(_FITTINGS_CP)
        assert len(defs) == 1
        assert defs[0].attribute_label == "Connection Type"
        assert defs[0].allowed_normalized_values == {"SOLDER", "NPT_FEMALE"}

    def test_unknown_classpath_returns_empty(self) -> None:
        adapter = TaxonomyLovAdapter(_FIXTURE_ROWS)
        other = LovClasspath.parse("Electrical>Lighting")
        assert adapter.attribute_definitions(other) == ()

    def test_all_classpaths(self) -> None:
        adapter = TaxonomyLovAdapter(_FIXTURE_ROWS)
        assert set(adapter.all_classpaths()) == {_FITTINGS_CP, _FAUCETS_CP}

    def test_empty_fixture_has_no_classpaths(self) -> None:
        adapter = TaxonomyLovAdapter(())
        assert adapter.all_classpaths() == ()


def test_load_taxonomy_lov_reference_raises_when_workbook_missing() -> None:
    """The real `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` is not present in
    this environment — the loader must fail loudly, not silently return an
    empty/guessed reference."""
    with pytest.raises(ReferenceDataMissing, match="taxonomy_lov"):
        load_taxonomy_lov_reference()
