"""UH1 (`docs/16-unilog-alignment.md` G1) — behavioural tests for the widened
`Evidence` tagged union: `DocumentSpan | SourceRowSpan | ReferenceTableRow`. Distinct
from `tests/architecture/test_evidence_required.py`, which asserts the *shape* of
each type; this file exercises *behaviour* — valid construction, INV-1/INV-3
rejection of fabricated/incomplete evidence, and that `AttributeValueAsserted`
accepts every variant equally.
"""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    DocumentSpan,
    EvidenceKind,
    ProvenanceKind,
    ReferenceTableRow,
    SourceRowSpan,
    Verification,
    attribute_value,
    is_unknown,
)

TIER1_ATTR = AttributeRef(
    code="seat_material", name="Seat Material", datatype="enum", risk_tier=2, is_mandatory=True
)


def make_verification() -> Verification:
    return Verification(
        verdict="ENTAILED",
        deterministic_check="exact",
        rationale="Row 12,443 of the approved manufacturer list matches.",
        verifier_model="claude-verifier",
    )


# ---- DocumentSpan ------------------------------------------------------------------


class TestDocumentSpan:
    def test_constructs_and_tags_itself(self) -> None:
        span = DocumentSpan(
            document_version_id="doc_1",
            page=2,
            region_id="table:1/row:14",
            char_start=0,
            char_end=7,
            snippet_text="600 WOG",
            bbox=(1.0, 2.0, 3.0, 4.0),
        )
        assert span.kind is EvidenceKind.DOCUMENT_SPAN

    def test_rejects_empty_snippet(self) -> None:
        with pytest.raises(InvariantViolation, match="INV-3"):
            DocumentSpan(
                document_version_id="doc_1",
                page=2,
                region_id="table:1/row:14",
                char_start=0,
                char_end=7,
                snippet_text="",
                bbox=(1.0, 2.0, 3.0, 4.0),
            )

    def test_rejects_page_zero(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentSpan(
                document_version_id="doc_1",
                page=0,
                region_id="table:1/row:14",
                char_start=0,
                char_end=7,
                snippet_text="600 WOG",
                bbox=(1.0, 2.0, 3.0, 4.0),
            )


# ---- SourceRowSpan ------------------------------------------------------------------


class TestSourceRowSpan:
    def test_constructs_and_tags_itself(self) -> None:
        span = SourceRowSpan(
            source_dataset="sample_input.csv",
            row_identifier="row_47",
            source_column="Part_Desc",
            snippet_text="AVM6 EV Mini Snip Red",
        )
        assert span.kind is EvidenceKind.SOURCE_ROW_SPAN

    @pytest.mark.parametrize(
        "field_name",
        ["source_dataset", "row_identifier", "source_column", "snippet_text"],
    )
    def test_rejects_empty_identity_field(self, field_name: str) -> None:
        kwargs = {
            "source_dataset": "sample_input.csv",
            "row_identifier": "row_47",
            "source_column": "Part_Desc",
            "snippet_text": "AVM6 EV Mini Snip Red",
        }
        kwargs[field_name] = ""
        with pytest.raises(InvariantViolation):
            SourceRowSpan(**kwargs)


# ---- ReferenceTableRow ---------------------------------------------------------------


class TestReferenceTableRow:
    def test_constructs_and_tags_itself(self) -> None:
        row = ReferenceTableRow(
            reference_dataset="manufacturer_brand_list",
            row_key="12443",
            reference_field="BRAND_NAME",
            snippet_text="FRIGIDAIRE®",
        )
        assert row.kind is EvidenceKind.REFERENCE_TABLE_ROW

    @pytest.mark.parametrize(
        "field_name",
        ["reference_dataset", "row_key", "reference_field", "snippet_text"],
    )
    def test_rejects_empty_identity_field(self, field_name: str) -> None:
        kwargs = {
            "reference_dataset": "manufacturer_brand_list",
            "row_key": "12443",
            "reference_field": "BRAND_NAME",
            "snippet_text": "FRIGIDAIRE®",
        }
        kwargs[field_name] = ""
        with pytest.raises(InvariantViolation):
            ReferenceTableRow(**kwargs)


# ---- AttributeValueAsserted accepts every variant equally ---------------------------


class TestAttributeValueAcceptsAllEvidenceVariants:
    def test_extracted_with_source_row_span(self) -> None:
        value = attribute_value.extracted(
            id="av_src_1",
            attribute=TIER1_ATTR,
            created_at="2026-08-13T00:00:00Z",
            status=AttributeValueStatus.NEEDS_REVIEW,
            value_display="PTFE",
            value_canonical=None,
            value_raw="PTFE",
            provenance_kind=ProvenanceKind.EXTRACTED,
            confidence=0.8,
            evidence=(
                SourceRowSpan(
                    source_dataset="sample_input.csv",
                    row_identifier="row_1",
                    source_column="Part_Desc",
                    snippet_text="PTFE SEAT BALL VALVE",
                ),
            ),
            verification=make_verification(),
        )
        assert not is_unknown(value)
        assert value.evidence[0].kind is EvidenceKind.SOURCE_ROW_SPAN

    def test_extracted_with_reference_table_row(self) -> None:
        value = attribute_value.extracted(
            id="av_ref_1",
            attribute=TIER1_ATTR,
            created_at="2026-08-13T00:00:00Z",
            status=AttributeValueStatus.NEEDS_REVIEW,
            value_display="FRIGIDAIRE",
            value_canonical=None,
            value_raw="FRIGIDAIRE®",
            provenance_kind=ProvenanceKind.EXTRACTED,
            confidence=0.85,
            evidence=(
                ReferenceTableRow(
                    reference_dataset="manufacturer_brand_list",
                    row_key="12443",
                    reference_field="BRAND_NAME",
                    snippet_text="FRIGIDAIRE®",
                ),
            ),
            verification=make_verification(),
        )
        assert not is_unknown(value)
        assert value.evidence[0].kind is EvidenceKind.REFERENCE_TABLE_ROW

    def test_extracted_with_mixed_evidence_tuple(self) -> None:
        """A value may be corroborated by more than one evidence kind at once —
        the tuple is heterogeneous by design (`evidence: tuple[Evidence, ...]`)."""
        value = attribute_value.extracted(
            id="av_mixed_1",
            attribute=TIER1_ATTR,
            created_at="2026-08-13T00:00:00Z",
            status=AttributeValueStatus.NEEDS_REVIEW,
            value_display="PTFE",
            value_canonical=None,
            value_raw="PTFE",
            provenance_kind=ProvenanceKind.EXTRACTED,
            confidence=0.9,
            evidence=(
                SourceRowSpan(
                    source_dataset="sample_input.csv",
                    row_identifier="row_1",
                    source_column="Part_Desc",
                    snippet_text="PTFE SEAT BALL VALVE",
                ),
                DocumentSpan(
                    document_version_id="doc_1",
                    page=2,
                    region_id="table:1/row:14",
                    char_start=0,
                    char_end=4,
                    snippet_text="PTFE",
                    bbox=(1.0, 2.0, 3.0, 4.0),
                ),
            ),
            verification=make_verification(),
        )
        assert len(value.evidence) == 2
        assert {e.kind for e in value.evidence} == {
            EvidenceKind.SOURCE_ROW_SPAN,
            EvidenceKind.DOCUMENT_SPAN,
        }

    def test_empty_evidence_still_rejected_regardless_of_kind(self) -> None:
        """INV-1 is about *having* evidence, not about which kind — widening the
        type must not have loosened the emptiness check."""
        with pytest.raises(InvariantViolation, match="INV-1"):
            attribute_value.extracted(
                id="av_empty",
                attribute=TIER1_ATTR,
                created_at="2026-08-13T00:00:00Z",
                status=AttributeValueStatus.NEEDS_REVIEW,
                value_display="PTFE",
                value_canonical=None,
                value_raw="PTFE",
                provenance_kind=ProvenanceKind.EXTRACTED,
                confidence=0.9,
                evidence=(),
                verification=make_verification(),
            )
