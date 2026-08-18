"""`domain/ver/independent_check.py` (M3) — the deterministic containment +
entailment gate that runs before any LLM verifier."""

from __future__ import annotations

import pytest

from openspec.domain.model.attribute import AttributeRef, DocumentSpan, SourceRowSpan
from openspec.domain.model.extraction import ExtractionCandidate, ExtractionMethod
from openspec.domain.ver.independent_check import verify_candidate_deterministic

_ATTR = AttributeRef(code="a", name="A", datatype="string", risk_tier=1, is_mandatory=True)
_BBOX = (0.0, 0.0, 10.0, 10.0)


def _verbatim_candidate(value_raw: str, snippet: str) -> ExtractionCandidate:
    return ExtractionCandidate(
        id="x",
        attribute=_ATTR,
        value_raw=value_raw,
        evidence=(
            SourceRowSpan(
                source_dataset="d", row_identifier="1", source_column="c", snippet_text=snippet
            ),
        ),
        method=ExtractionMethod.VERBATIM_ROW_FIELD,
        source_confidence=1.0,
        rationale="verbatim",
    )


def test_matching_length_mismatch_raises() -> None:
    candidate = _verbatim_candidate("v", "v")
    with pytest.raises(ValueError):
        verify_candidate_deterministic(candidate=candidate, source_texts=())


def test_accepts_genuine_verbatim_match() -> None:
    candidate = _verbatim_candidate("AVM6EV", "AVM6EV")
    result = verify_candidate_deterministic(candidate=candidate, source_texts=("AVM6EV",))
    assert result.accepted
    assert not result.containment_failed
    assert result.verification.verdict == "ENTAILED"


def test_rejects_when_snippet_is_not_really_in_the_source() -> None:
    """The evidence claims to quote `source_texts`, but it isn't actually there —
    a fabricated citation."""
    candidate = _verbatim_candidate("AVM6EV", "AVM6EV")
    result = verify_candidate_deterministic(
        candidate=candidate, source_texts=("totally different cell value",)
    )
    assert not result.accepted
    assert result.containment_failed
    assert result.verification.verdict == "NOT_ENTAILED"


def test_rejects_when_value_raw_silently_diverges_from_evidence() -> None:
    """CLAUDE.md's own trap: '0°C to 82°C' presented as if it were a verbatim quote
    of '0°F to 180°F' — the snippet is genuinely in the source (containment holds),
    but value_raw doesn't equal it (entailment fails)."""
    source = "Operating temperature 0°F to 180°F"
    needle = "0°F to 180°F"
    start = source.index(needle)
    candidate = ExtractionCandidate(
        id="x",
        attribute=_ATTR,
        value_raw="0°C to 82°C",
        evidence=(
            DocumentSpan(
                document_version_id="dv1",
                page=1,
                region_id="block:1",
                char_start=start,
                char_end=start + len(needle),
                snippet_text=needle,
                bbox=_BBOX,
            ),
        ),
        method=ExtractionMethod.LLM_GROUNDED,
        source_confidence=0.9,
        rationale="claimed unit-converted reading",
    )
    result = verify_candidate_deterministic(candidate=candidate, source_texts=(source,))
    assert not result.accepted
    assert not result.containment_failed  # containment held; entailment is what failed
    assert result.verification.verdict == "NOT_ENTAILED"


def test_rejects_invalid_out_of_bounds_span() -> None:
    candidate = ExtractionCandidate(
        id="x",
        attribute=_ATTR,
        value_raw="600 WOG",
        evidence=(
            DocumentSpan(
                document_version_id="dv1",
                page=1,
                region_id="block:1",
                char_start=0,
                char_end=5000,
                snippet_text="600 WOG",
                bbox=_BBOX,
            ),
        ),
        method=ExtractionMethod.LLM_GROUNDED,
        source_confidence=0.9,
        rationale="hallucinated span",
    )
    result = verify_candidate_deterministic(candidate=candidate, source_texts=("600 WOG",))
    assert not result.accepted
    assert result.containment_failed
