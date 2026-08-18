"""`domain/ext/span_containment.py` — INV-3 (`docs/10-roadmap.md` M3 §3). Covers
every case that section names explicitly: exact containment, boundary containment,
partial overlap, outside span, empty span, malformed span, Unicode/offset edge
cases."""

from __future__ import annotations

from openspec.domain.ext.span_containment import (
    SpanContainmentOutcome,
    check_document_span_containment,
    check_evidence_containment,
    check_reference_table_row_containment,
    check_source_row_span_containment,
)
from openspec.domain.model.attribute import DocumentSpan, ReferenceTableRow, SourceRowSpan

_BBOX = (0.0, 0.0, 10.0, 10.0)


def _span(text: str, start: int, end: int) -> DocumentSpan:
    return DocumentSpan(
        document_version_id="dv1",
        page=1,
        region_id="block:1",
        char_start=start,
        char_end=end,
        snippet_text=text,
        bbox=_BBOX,
    )


class TestDocumentSpanContainment:
    def test_exact_containment(self) -> None:
        region = "Operating temperature 0°F to 180°F"
        needle = "0°F to 180°F"
        start = region.index(needle)
        span = _span(needle, start, start + len(needle))
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.CONTAINED
        assert result.is_valid

    def test_boundary_containment_whole_text(self) -> None:
        region = "600 WOG"
        span = _span(region, 0, len(region))
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_boundary_containment_at_end_of_region(self) -> None:
        region = "Rated for 600 WOG"
        needle = "600 WOG"
        start = region.index(needle)
        span = _span(needle, start, start + len(needle))
        assert start + len(needle) == len(
            region
        )  # the span really does end at the region's boundary
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_partial_overlap_is_text_mismatch(self) -> None:
        # Claimed offsets are shifted by one character from where "600 WOG"
        # actually sits — a classic off-by-one hallucination, not a clean match.
        region = "Rated for 600 WOG"
        span = _span("600 WOG", 11, 19)  # off-by-one and out of bounds by 1
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome in (
            SpanContainmentOutcome.TEXT_MISMATCH,
            SpanContainmentOutcome.OUT_OF_BOUNDS,
        )
        assert not result.is_valid

    def test_partial_overlap_in_bounds_but_wrong_slice(self) -> None:
        region = "Rated for 600 WOG at ambient"
        span = _span("600 WOG", 10, 17)  # correct
        # Now shift by 2 while staying in-bounds -> a real partial-overlap mismatch.
        bad = _span("600 WOG", 12, 19)
        assert check_document_span_containment(region_text=region, span=span).is_valid
        result = check_document_span_containment(region_text=region, span=bad)
        assert result.outcome is SpanContainmentOutcome.TEXT_MISMATCH

    def test_outside_span_out_of_bounds(self) -> None:
        region = "600 WOG"
        span = _span("600 WOG hallucinated tail", 0, 500)
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.OUT_OF_BOUNDS

    def test_empty_span(self) -> None:
        region = "600 WOG"
        span = _span("x", 3, 3)  # DocumentSpan itself allows char_start == char_end
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.EMPTY_SPAN

    def test_unicode_offsets(self) -> None:
        region = 'Rated 0°F to 82°C — see note ¼" NPT'
        # Slice by code point, not byte — ¼ and ° are each one code point.
        start = region.index("¼")
        span = _span('¼" NPT', start, start + len('¼" NPT'))
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_never_silently_repairs_an_out_of_bounds_span(self) -> None:
        """A span whose end exceeds the region must never be silently clamped and
        treated as valid — this is the exact anti-pattern `docs/10-roadmap.md` M3
        §3 forbids."""
        region = "short"
        span = _span("short", 0, 5000)
        result = check_document_span_containment(region_text=region, span=span)
        assert result.outcome is SpanContainmentOutcome.OUT_OF_BOUNDS


class TestFlatContainment:
    def test_source_row_span_exact_match(self) -> None:
        span = SourceRowSpan(
            source_dataset="sample_input.csv",
            row_identifier="1",
            source_column="Part_Desc",
            snippet_text="AVM6EV Mini Snip Red",
        )
        result = check_source_row_span_containment(
            actual_cell_text="AVM6EV Mini Snip Red", span=span
        )
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_source_row_span_substring_is_contained(self) -> None:
        span = SourceRowSpan(
            source_dataset="sample_input.csv",
            row_identifier="1",
            source_column="Part_Desc",
            snippet_text="Mini Snip",
        )
        result = check_source_row_span_containment(
            actual_cell_text="AVM6EV Mini Snip Red", span=span
        )
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_source_row_span_fabricated_text_is_mismatch(self) -> None:
        span = SourceRowSpan(
            source_dataset="sample_input.csv",
            row_identifier="1",
            source_column="Part_Desc",
            snippet_text="something that was never in the cell",
        )
        result = check_source_row_span_containment(actual_cell_text="AVM6EV", span=span)
        assert result.outcome is SpanContainmentOutcome.TEXT_MISMATCH
        assert not result.is_valid

    def test_reference_table_row_containment(self) -> None:
        span = ReferenceTableRow(
            reference_dataset="manufacturer_brand_list",
            row_key="12443",
            reference_field="BRAND_NAME",
            snippet_text="FRIGIDAIRE®",
        )
        result = check_reference_table_row_containment(actual_cell_text="FRIGIDAIRE®", span=span)
        assert result.outcome is SpanContainmentOutcome.CONTAINED

    def test_reference_table_row_mismatch(self) -> None:
        span = ReferenceTableRow(
            reference_dataset="manufacturer_brand_list",
            row_key="12443",
            reference_field="BRAND_NAME",
            snippet_text="SOMETHING ELSE",
        )
        result = check_reference_table_row_containment(actual_cell_text="FRIGIDAIRE®", span=span)
        assert result.outcome is SpanContainmentOutcome.TEXT_MISMATCH


class TestDispatch:
    def test_dispatches_document_span(self) -> None:
        region = "600 WOG"
        span = _span(region, 0, len(region))
        result = check_evidence_containment(source_text=region, evidence=span)
        assert result.is_valid

    def test_dispatches_source_row_span(self) -> None:
        span = SourceRowSpan(
            source_dataset="d", row_identifier="1", source_column="c", snippet_text="x"
        )
        result = check_evidence_containment(source_text="x", evidence=span)
        assert result.is_valid

    def test_dispatches_reference_table_row(self) -> None:
        span = ReferenceTableRow(
            reference_dataset="d", row_key="1", reference_field="c", snippet_text="x"
        )
        result = check_evidence_containment(source_text="x", evidence=span)
        assert result.is_valid
