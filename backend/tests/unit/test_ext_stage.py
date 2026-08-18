"""Tests for `application/stages/ext.py` (UH4)."""

from __future__ import annotations

from openspec.application.stages.ext import extract_item_description, extract_mfg_part_num
from openspec.domain.model.attribute import (
    AttributeValueAsserted,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    is_unknown,
)


class TestExtractMfgPartNum:
    def test_non_blank_value_is_accepted_and_verified(self) -> None:
        result = extract_mfg_part_num(
            id="1", row_number=42, mfg_part_num="ACME-123", created_at="2026-08-14T00:00:00Z"
        )
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.ACCEPTED
        assert result.value_raw == "ACME-123"
        assert result.provenance_kind is ProvenanceKind.EXTRACTED
        assert result.confidence == 1.0
        assert result.verification.verdict == "ENTAILED"
        assert len(result.evidence) == 1
        ev = result.evidence[0]
        assert isinstance(ev, SourceRowSpan)
        assert ev.source_column == "Mfg_Part_Num"
        assert ev.row_identifier == "42"
        assert ev.snippet_text == "ACME-123"

    def test_blank_value_is_unknown(self) -> None:
        result = extract_mfg_part_num(
            id="1", row_number=42, mfg_part_num="   ", created_at="2026-08-14T00:00:00Z"
        )
        assert is_unknown(result)
        assert result.unknown_reason is UnknownReason.SOURCE_FIELD_BLANK  # type: ignore[union-attr]

    def test_source_dataset_defaults_to_sample_input(self) -> None:
        result = extract_mfg_part_num(
            id="1", row_number=1, mfg_part_num="X", created_at="2026-08-14T00:00:00Z"
        )
        assert isinstance(result, AttributeValueAsserted)
        assert isinstance(result.evidence[0], SourceRowSpan)
        assert result.evidence[0].source_dataset == "sample_input.csv"


class TestExtractItemDescription:
    def test_verbatim_extraction(self) -> None:
        result = extract_item_description(
            id="2",
            row_number=7,
            part_desc="3M 775L Stikit Film Disc",
            created_at="2026-08-14T00:00:00Z",
        )
        assert isinstance(result, AttributeValueAsserted)
        assert result.value_display == "3M 775L Stikit Film Disc"
        assert result.attribute.code == "ITEM_DESCRIPTION"

    def test_blank_description_is_unknown(self) -> None:
        result = extract_item_description(
            id="2", row_number=7, part_desc="", created_at="2026-08-14T00:00:00Z"
        )
        assert is_unknown(result)
