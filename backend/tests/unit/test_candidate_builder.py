"""`domain/ext/candidate_builder.py` (M3)."""

from __future__ import annotations

from openspec.domain.ext.candidate_builder import (
    build_document_span_candidate,
    build_verbatim_row_candidate,
)
from openspec.domain.model.attribute import AttributeRef, UnknownReason
from openspec.domain.model.extraction import (
    ExtractionCandidate,
    ExtractionMethod,
    ExtractionUnavailable,
)

_ATTR = AttributeRef(code="a", name="A", datatype="string", risk_tier=1, is_mandatory=True)
_BBOX = (0.0, 0.0, 10.0, 10.0)


class TestVerbatimRowCandidate:
    def test_blank_value_is_unavailable(self) -> None:
        result = build_verbatim_row_candidate(
            id="x",
            attribute=_ATTR,
            source_dataset="d",
            row_identifier="1",
            source_column="c",
            raw_value="   ",
        )
        assert isinstance(result, ExtractionUnavailable)
        assert result.reason is UnknownReason.SOURCE_FIELD_BLANK

    def test_non_blank_value_is_a_verbatim_candidate(self) -> None:
        result = build_verbatim_row_candidate(
            id="x",
            attribute=_ATTR,
            source_dataset="d",
            row_identifier="1",
            source_column="c",
            raw_value="AVM6EV",
        )
        assert isinstance(result, ExtractionCandidate)
        assert result.value_raw == "AVM6EV"
        assert result.evidence[0].snippet_text == "AVM6EV"
        assert result.method is ExtractionMethod.VERBATIM_ROW_FIELD


class TestDocumentSpanCandidate:
    def _build(self, *, char_start: int, char_end: int, region_text: str = "Rated for 600 WOG"):
        return build_document_span_candidate(
            id="x",
            attribute=_ATTR,
            document_version_id="dv1",
            region_id="block:1",
            region_text=region_text,
            page=1,
            bbox=_BBOX,
            char_start=char_start,
            char_end=char_end,
            method=ExtractionMethod.RULE_BASED,
            source_confidence=0.8,
            rationale="matched a pressure marking",
        )

    def test_valid_span_becomes_a_candidate(self) -> None:
        result = self._build(char_start=10, char_end=17)
        assert isinstance(result, ExtractionCandidate)
        assert result.value_raw == "600 WOG"
        assert result.evidence[0].snippet_text == "600 WOG"

    def test_zero_length_span_is_unavailable(self) -> None:
        result = self._build(char_start=3, char_end=3)
        assert isinstance(result, ExtractionUnavailable)
        assert result.reason is UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT

    def test_negative_start_is_unavailable(self) -> None:
        result = self._build(char_start=-1, char_end=5)
        assert isinstance(result, ExtractionUnavailable)

    def test_out_of_bounds_end_is_unavailable_never_clamped(self) -> None:
        result = self._build(char_start=0, char_end=5000)
        assert isinstance(result, ExtractionUnavailable)
        assert "outside" in result.detail

    def test_value_raw_is_always_the_exact_slice(self) -> None:
        region_text = "Operating temperature 0°F to 180°F"
        needle = "0°F to 180°F"
        start = region_text.index(needle)
        result = self._build(
            region_text=region_text,
            char_start=start,
            char_end=start + len(needle),
        )
        assert isinstance(result, ExtractionCandidate)
        assert result.value_raw == needle
