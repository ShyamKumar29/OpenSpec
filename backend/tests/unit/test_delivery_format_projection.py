"""Tests for `infrastructure/export/delivery_format_projection.py` (UH7).
Uses the real, live-loaded 252-column schema (`load_delivery_format_schema`)
— never a hand-typed fixture schema, per UH0's own discipline — with
constructed `AttributeValue` fixtures standing in for pipeline output.
"""

from __future__ import annotations

from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    Verification,
    attribute_value,
)
from openspec.infrastructure.export.delivery_format_projection import (
    ATTRIBUTE_TO_COLUMN,
    project_record_to_delivery_format_row,
)
from openspec.infrastructure.reference_data.delivery_format import load_delivery_format_schema

_SCHEMA = load_delivery_format_schema()


def _accepted(code: str, display: str) -> object:
    ref = AttributeRef(code=code, name=code, datatype="string", risk_tier=1, is_mandatory=True)
    return attribute_value.extracted(
        id="1",
        attribute=ref,
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


def _unknown(code: str) -> object:
    ref = AttributeRef(code=code, name=code, datatype="string", risk_tier=1, is_mandatory=True)
    return attribute_value.unknown(
        id="2",
        attribute=ref,
        created_at="2026-08-14T00:00:00Z",
        reason=UnknownReason.SOURCE_FIELD_BLANK,
    )


class TestProjectRecordToDeliveryFormatRow:
    def test_every_column_present_and_in_schema_order(self) -> None:
        row = project_record_to_delivery_format_row(_SCHEMA, {})
        assert len(row) == len(_SCHEMA.columns)
        assert tuple(row.keys()) == _SCHEMA.column_names()

    def test_mapped_accepted_attribute_populates_its_column(self) -> None:
        values = {"MFG_PART_NUM": _accepted("MFG_PART_NUM", "ACME-123")}
        row = project_record_to_delivery_format_row(_SCHEMA, values)  # type: ignore[arg-type]
        assert row["Mfg_Part_Num"] == "ACME-123"

    def test_unknown_attribute_projects_to_empty_string_not_a_placeholder_word(self) -> None:
        values = {"MFG_PART_NUM": _unknown("MFG_PART_NUM")}
        row = project_record_to_delivery_format_row(_SCHEMA, values)  # type: ignore[arg-type]
        assert row["Mfg_Part_Num"] == ""

    def test_absent_attribute_projects_to_empty_string(self) -> None:
        row = project_record_to_delivery_format_row(_SCHEMA, {})
        assert row["Mfg_Part_Num"] == ""

    def test_unmapped_column_is_always_empty(self) -> None:
        """Columns with no attribute mapping (the vast majority) are never
        populated — no source exists for them in this environment."""
        values = {"MFG_PART_NUM": _accepted("MFG_PART_NUM", "ACME-123")}
        row = project_record_to_delivery_format_row(_SCHEMA, values)  # type: ignore[arg-type]
        assert row["UPC"] == ""
        assert row["List Price"] == ""

    def test_all_four_mapped_attributes(self) -> None:
        values = {
            "MFG_PART_NUM": _accepted("MFG_PART_NUM", "ACME-123"),
            "ITEM_DESCRIPTION": _accepted("ITEM_DESCRIPTION", "Widget"),
            "MANUFACTURER_NAME": _accepted("MANUFACTURER_NAME", "Acme Inc"),
            "BRAND_NAME": _accepted("BRAND_NAME", "Acme"),
        }
        row = project_record_to_delivery_format_row(_SCHEMA, values)  # type: ignore[arg-type]
        assert row["Mfg_Part_Num"] == "ACME-123"
        assert row["Part_Desc"] == "Widget"
        assert row["MANUFACTURER_NAME"] == "Acme Inc"
        assert row["BRAND_NAME"] == "Acme"


def test_attribute_to_column_map_targets_real_columns() -> None:
    real_columns = set(_SCHEMA.column_names())
    for column in ATTRIBUTE_TO_COLUMN.values():
        assert column in real_columns
