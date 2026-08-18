"""UH1 — wire-serialisation tests for the widened `Evidence` union
(`openspec.api.schemas.attribute_value`). Proves two things `docs/16-unilog-
alignment.md` UH1's done-criteria and the frozen-frontend constraint both require:

1. `DOCUMENT_SPAN` evidence serialises with exactly the same field set the frontend's
   `evidenceWireSchema` (`frontend/lib/contracts/attribute-value.ts`) already parses,
   plus the additive `kind` discriminator — i.e. today's live wire shape is
   unchanged for the frontend.
2. `SOURCE_ROW_SPAN`/`REFERENCE_TABLE_ROW` evidence serialises to its *own* shape —
   the document-only fields are genuinely absent (not present-and-null), so a
   consumer can't be misled into thinking a row/reference citation has a page or a
   bbox.
"""

from __future__ import annotations

from openspec.api.schemas.attribute_value import (
    DocumentSpanOut,
    ReferenceTableRowOut,
    SourceRowSpanOut,
    _evidence_out,
    attribute_value_from_domain,
)
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    DocumentSpan,
    ProvenanceKind,
    ReferenceTableRow,
    SourceRowSpan,
    Verification,
    attribute_value,
)

TIER1_ATTR = AttributeRef(
    code="seat_material", name="Seat Material", datatype="enum", risk_tier=2, is_mandatory=True
)

# The exact field set the frontend's `evidenceWireSchema` requires today —
# frontend/lib/contracts/attribute-value.ts, verified by reading that file, not
# assumed.
FRONTEND_DOCUMENT_SPAN_FIELDS = {
    "document_version_id",
    "page",
    "region_id",
    "char_start",
    "char_end",
    "snippet_text",
    "bbox",
}


def make_verification() -> Verification:
    return Verification(
        verdict="ENTAILED",
        deterministic_check="exact",
        rationale="Matches.",
        verifier_model="claude-verifier",
    )


def test_document_span_wire_shape_is_backward_compatible() -> None:
    span = DocumentSpan(
        document_version_id="doc_1",
        page=2,
        region_id="table:1/row:14",
        char_start=0,
        char_end=7,
        snippet_text="600 WOG",
        bbox=(1.0, 2.0, 3.0, 4.0),
    )
    out = _evidence_out(span)
    assert isinstance(out, DocumentSpanOut)
    dumped = out.model_dump()
    # Every field the frontend already requires is present with the same value...
    assert FRONTEND_DOCUMENT_SPAN_FIELDS <= dumped.keys()
    assert dumped["document_version_id"] == "doc_1"
    assert dumped["page"] == 2
    assert dumped["bbox"] == (1.0, 2.0, 3.0, 4.0)
    # ...and the only addition is the discriminator, which zod's default
    # (non-strict) z.object() silently drops rather than rejecting.
    assert dumped.keys() - FRONTEND_DOCUMENT_SPAN_FIELDS == {"kind"}
    assert dumped["kind"] == "DOCUMENT_SPAN"


def test_source_row_span_wire_shape_has_no_document_fields() -> None:
    span = SourceRowSpan(
        source_dataset="sample_input.csv",
        row_identifier="row_47",
        source_column="Part_Desc",
        snippet_text="AVM6 EV Mini Snip Red",
    )
    out = _evidence_out(span)
    assert isinstance(out, SourceRowSpanOut)
    dumped = out.model_dump()
    assert dumped == {
        "kind": "SOURCE_ROW_SPAN",
        "source_dataset": "sample_input.csv",
        "row_identifier": "row_47",
        "source_column": "Part_Desc",
        "snippet_text": "AVM6 EV Mini Snip Red",
    }
    # Genuinely absent, not present-and-null — a consumer can't be misled into
    # thinking a row citation has a page or bbox. `snippet_text` is intentionally
    # shared across all three variants, so it's excluded from this check.
    document_only_fields = FRONTEND_DOCUMENT_SPAN_FIELDS - {"snippet_text"}
    assert not (document_only_fields & dumped.keys())


def test_reference_table_row_wire_shape_has_no_document_fields() -> None:
    row = ReferenceTableRow(
        reference_dataset="manufacturer_brand_list",
        row_key="12443",
        reference_field="BRAND_NAME",
        snippet_text="FRIGIDAIRE®",
    )
    out = _evidence_out(row)
    assert isinstance(out, ReferenceTableRowOut)
    dumped = out.model_dump()
    assert dumped == {
        "kind": "REFERENCE_TABLE_ROW",
        "reference_dataset": "manufacturer_brand_list",
        "row_key": "12443",
        "reference_field": "BRAND_NAME",
        "snippet_text": "FRIGIDAIRE®",
    }
    document_only_fields = FRONTEND_DOCUMENT_SPAN_FIELDS - {"snippet_text"}
    assert not (document_only_fields & dumped.keys())


def test_attribute_value_from_domain_round_trips_reference_table_row_evidence() -> None:
    value = attribute_value.extracted(
        id="av_1",
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
    out = attribute_value_from_domain(value)
    assert len(out.evidence) == 1
    assert isinstance(out.evidence[0], ReferenceTableRowOut)
    # JSON round-trip (what actually crosses the wire) preserves the shape.
    as_json = out.model_dump_json()
    assert '"kind":"REFERENCE_TABLE_ROW"' in as_json.replace(" ", "")
