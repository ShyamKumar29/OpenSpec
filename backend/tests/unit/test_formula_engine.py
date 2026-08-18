"""Tests for `domain/dsc/formula_engine.py` (UH5, ADR-0013)."""

from __future__ import annotations

from openspec.domain.dsc.formula_engine import build_description
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    Verification,
    attribute_value,
)
from openspec.domain.model.description import AttributeSlot, Casing, DescriptionFormula, LiteralSlot

_MFR_ATTR = AttributeRef(
    code="MANUFACTURER_NAME", name="Manufacturer", datatype="string", risk_tier=1, is_mandatory=True
)
_MPN_ATTR = AttributeRef(
    code="MFG_PART_NUM", name="MPN", datatype="string", risk_tier=1, is_mandatory=True
)


def _accepted(attribute: AttributeRef, display: str) -> object:
    return attribute_value.extracted(
        id="v1",
        attribute=attribute,
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


def _needs_review(attribute: AttributeRef, display: str) -> object:
    return attribute_value.extracted(
        id="v2",
        attribute=attribute,
        created_at="2026-08-14T00:00:00Z",
        status=AttributeValueStatus.NEEDS_REVIEW,
        value_display=display,
        value_canonical=None,
        value_raw=display,
        provenance_kind=ProvenanceKind.DERIVED,
        confidence=0.5,
        evidence=(
            SourceRowSpan(
                source_dataset="test", row_identifier="1", source_column="x", snippet_text=display
            ),
        ),
        verification=Verification(
            verdict="PARTIAL", deterministic_check="fuzzy", rationale="test", verifier_model="test"
        ),
    )


def _unknown(attribute: AttributeRef) -> object:
    return attribute_value.unknown(
        id="v3",
        attribute=attribute,
        created_at="2026-08-14T00:00:00Z",
        reason=UnknownReason.REFERENCE_DATA_UNAVAILABLE,
    )


class TestBuildDescription:
    def test_composes_accepted_attributes_with_literal_separator(self) -> None:
        formula = DescriptionFormula(
            field_code="MOBILE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(
                AttributeSlot(attribute_code="MANUFACTURER_NAME"),
                LiteralSlot(text=" — "),
                AttributeSlot(attribute_code="MFG_PART_NUM"),
            ),
            separator="",
        )
        values = {
            "MANUFACTURER_NAME": _accepted(_MFR_ATTR, "Acme Inc"),
            "MFG_PART_NUM": _accepted(_MPN_ATTR, "ACME-123"),
        }
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == "Acme Inc — ACME-123"
        assert len(result.source_attribute_values) == 2
        assert result.omitted_attribute_codes == ()

    def test_missing_attribute_is_omitted_not_fabricated(self) -> None:
        formula = DescriptionFormula(
            field_code="MOBILE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(
                AttributeSlot(attribute_code="MANUFACTURER_NAME"),
                AttributeSlot(attribute_code="MFG_PART_NUM"),
            ),
            separator=", ",
        )
        values = {"MANUFACTURER_NAME": _accepted(_MFR_ATTR, "Acme Inc")}
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == "Acme Inc"
        assert result.omitted_attribute_codes == ("MFG_PART_NUM",)

    def test_unknown_attribute_is_omitted(self) -> None:
        formula = DescriptionFormula(
            field_code="X",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME"),),
            separator=", ",
        )
        values = {"MANUFACTURER_NAME": _unknown(_MFR_ATTR)}
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == ""
        assert result.omitted_attribute_codes == ("MANUFACTURER_NAME",)

    def test_needs_review_attribute_is_omitted_not_composed(self) -> None:
        """ADR-0013: descriptions build from *approved* values — NEEDS_REVIEW
        has not been approved yet."""
        formula = DescriptionFormula(
            field_code="X",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME"),),
            separator=", ",
        )
        values = {"MANUFACTURER_NAME": _needs_review(_MFR_ATTR, "Maybe Acme")}
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == ""
        assert result.source_attribute_values == ()

    def test_absent_attribute_key_is_omitted(self) -> None:
        formula = DescriptionFormula(
            field_code="X",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME"),),
            separator=", ",
        )
        result = build_description(formula, {})
        assert result.omitted_attribute_codes == ("MANUFACTURER_NAME",)

    def test_per_slot_casing_applies_before_join(self) -> None:
        formula = DescriptionFormula(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME", casing=Casing.UPPER),),
            separator="",
        )
        values = {"MANUFACTURER_NAME": _accepted(_MFR_ATTR, "Acme Inc")}
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == "ACME INC"

    def test_overall_casing_applies_after_join(self) -> None:
        formula = DescriptionFormula(
            field_code="INVOICE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(
                AttributeSlot(attribute_code="MANUFACTURER_NAME"),
                AttributeSlot(attribute_code="MFG_PART_NUM"),
            ),
            separator=" ",
            casing=Casing.UPPER,
        )
        values = {
            "MANUFACTURER_NAME": _accepted(_MFR_ATTR, "Acme Inc"),
            "MFG_PART_NUM": _accepted(_MPN_ATTR, "acme-123"),
        }
        result = build_description(formula, values)  # type: ignore[arg-type]
        assert result.text == "ACME INC ACME-123"

    def test_deterministic_across_repeated_calls(self) -> None:
        formula = DescriptionFormula(
            field_code="X",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME"),),
            separator=", ",
        )
        values = {"MANUFACTURER_NAME": _accepted(_MFR_ATTR, "Acme Inc")}
        first = build_description(formula, values)  # type: ignore[arg-type]
        second = build_description(formula, values)  # type: ignore[arg-type]
        assert first.text == second.text
