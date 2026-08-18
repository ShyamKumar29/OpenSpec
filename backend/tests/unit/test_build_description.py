"""Tests for `application/usecases/build_description.py` (UH5, ADR-0013).
Fake port — no infrastructure dependency."""

from __future__ import annotations

from openspec.application.usecases.build_description import (
    DescriptionBlocked,
    DescriptionBuilt,
    build_field_description,
)
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    Verification,
    attribute_value,
)
from openspec.domain.model.description import AttributeSlot, Casing, DescriptionFormula

_MPN_ATTR = AttributeRef(
    code="MFG_PART_NUM", name="MPN", datatype="string", risk_tier=1, is_mandatory=True
)


class _FakeFormulaReference:
    def __init__(self, formulas: dict[tuple[str, str], DescriptionFormula]) -> None:
        self._formulas = formulas

    def formula_for(self, *, field_code: str, class_code: str) -> DescriptionFormula | None:
        return self._formulas.get((field_code, class_code))


def _accepted_mpn(display: str) -> object:
    return attribute_value.extracted(
        id="1",
        attribute=_MPN_ATTR,
        created_at="2026-08-14T00:00:00Z",
        status=AttributeValueStatus.ACCEPTED,
        value_display=display,
        value_canonical=None,
        value_raw=display,
        provenance_kind=ProvenanceKind.EXTRACTED,
        confidence=1.0,
        evidence=(
            SourceRowSpan(
                source_dataset="test", row_identifier="1", source_column="x", snippet_text=display
            ),
        ),
        verification=Verification(
            verdict="ENTAILED", deterministic_check="exact", rationale="test", verifier_model="test"
        ),
    )


class TestBuildFieldDescription:
    def test_no_formula_configured_is_blocked(self) -> None:
        result = build_field_description(
            field_code="MOBILE_DESC",
            class_code="FITTINGS",
            attribute_values={},
            formulas=_FakeFormulaReference({}),
        )
        assert isinstance(result, DescriptionBlocked)
        assert "NO_FORMULA_CONFIGURED" in result.reason

    def test_configured_formula_builds_and_validates(self) -> None:
        formula = DescriptionFormula(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MFG_PART_NUM"),),
            separator="",
            casing=Casing.UPPER,
        )
        result = build_field_description(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            attribute_values={"MFG_PART_NUM": _accepted_mpn("acme-123")},  # type: ignore[dict-item]
            formulas=_FakeFormulaReference({("INVOICE_DESC", "FITTINGS"): formula}),
        )
        assert isinstance(result, DescriptionBuilt)
        assert result.result.text == "ACME-123"
        assert result.all_rules_passed

    def test_over_length_invoice_desc_fails_validation_but_still_builds(self) -> None:
        long_mpn = "X" * 50
        formula = DescriptionFormula(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MFG_PART_NUM"),),
            separator="",
            casing=Casing.UPPER,
        )
        result = build_field_description(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            attribute_values={"MFG_PART_NUM": _accepted_mpn(long_mpn)},  # type: ignore[dict-item]
            formulas=_FakeFormulaReference({("INVOICE_DESC", "FITTINGS"): formula}),
        )
        assert isinstance(result, DescriptionBuilt)
        assert not result.all_rules_passed
        failed = [v for v in result.validations if not v.passed]
        assert any(v.rule_id == "DSC-MAX-LENGTH" for v in failed)
