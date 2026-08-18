"""Tests for `infrastructure/reference_data/description_formulas.py` (UH5,
ADR-0013). Uses a fixture directory — never
`resources/description-formulas/` itself, which ships empty by design (see
that directory's README)."""

from __future__ import annotations

from pathlib import Path

from openspec.domain.model.description import Casing
from openspec.infrastructure.reference_data.description_formulas import (
    DEFAULT_DESCRIPTION_FORMULAS_DIR,
    DescriptionFormulaAdapter,
    load_class_formulas,
)

_FIXTURE_YAML = """
formula_version: "1"
fields:
  MOBILE_DESC:
    slots:
      - kind: attribute
        attribute_code: MANUFACTURER_NAME
      - kind: literal
        text: " — "
      - kind: attribute
        attribute_code: MFG_PART_NUM
        casing: UPPER
    separator: ""
  INVOICE_DESC:
    slots:
      - kind: attribute
        attribute_code: MFG_PART_NUM
    separator: ""
    casing: UPPER
"""


def test_load_class_formulas_parses_attribute_and_literal_slots(tmp_path: Path) -> None:
    (tmp_path / "FITTINGS.yaml").write_text(_FIXTURE_YAML, encoding="utf-8")
    formulas = load_class_formulas("FITTINGS", tmp_path)
    assert set(formulas) == {"MOBILE_DESC", "INVOICE_DESC"}
    mobile = formulas["MOBILE_DESC"]
    assert mobile.class_code == "FITTINGS"
    assert mobile.formula_version == "1"
    assert len(mobile.slots) == 3
    assert mobile.slots[1].text == " — "  # type: ignore[union-attr]
    assert mobile.slots[2].casing is Casing.UPPER  # type: ignore[union-attr]
    assert formulas["INVOICE_DESC"].casing is Casing.UPPER


def test_missing_class_file_returns_empty_dict(tmp_path: Path) -> None:
    assert load_class_formulas("NO_SUCH_CLASS", tmp_path) == {}


def test_real_shipped_directory_has_no_formula_files_yet() -> None:
    """Documents the current honest state: no real class formula files exist
    because UNILOG_INTERNAL_CONTENT_GUIDELINES.docx is missing."""
    assert load_class_formulas("FITTINGS", DEFAULT_DESCRIPTION_FORMULAS_DIR) == {}
    assert load_class_formulas("FAUCETS", DEFAULT_DESCRIPTION_FORMULAS_DIR) == {}


class TestDescriptionFormulaAdapter:
    def test_adapter_resolves_by_field_and_class(self, tmp_path: Path) -> None:
        (tmp_path / "FITTINGS.yaml").write_text(_FIXTURE_YAML, encoding="utf-8")
        adapter = DescriptionFormulaAdapter(("FITTINGS",), tmp_path)
        formula = adapter.formula_for(field_code="MOBILE_DESC", class_code="FITTINGS")
        assert formula is not None
        assert formula.field_code == "MOBILE_DESC"

    def test_adapter_returns_none_for_unconfigured_pair(self, tmp_path: Path) -> None:
        (tmp_path / "FITTINGS.yaml").write_text(_FIXTURE_YAML, encoding="utf-8")
        adapter = DescriptionFormulaAdapter(("FITTINGS",), tmp_path)
        assert adapter.formula_for(field_code="LONG_DESC1", class_code="FITTINGS") is None
        assert adapter.formula_for(field_code="MOBILE_DESC", class_code="FAUCETS") is None
