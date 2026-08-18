"""`domain/model/extraction.py` — `ExtractionCandidate`/`ExtractionUnavailable`
construction invariants (M3, mirrors `AttributeValueAsserted`/`Unknown`'s own
invariant tests, `tests/unit/test_attribute_value.py`)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import AttributeRef, SourceRowSpan, UnknownReason
from openspec.domain.model.extraction import (
    ExtractionCandidate,
    ExtractionMethod,
    ExtractionUnavailable,
    is_unavailable,
)

_ATTR = AttributeRef(code="a", name="A", datatype="string", risk_tier=1, is_mandatory=True)
_EVIDENCE = SourceRowSpan(
    source_dataset="d", row_identifier="1", source_column="c", snippet_text="value"
)


def test_candidate_requires_evidence() -> None:
    with pytest.raises(InvariantViolation):
        ExtractionCandidate(
            id="x",
            attribute=_ATTR,
            value_raw="value",
            evidence=(),
            method=ExtractionMethod.VERBATIM_ROW_FIELD,
            source_confidence=1.0,
            rationale="verbatim",
        )


def test_candidate_requires_non_blank_value_raw() -> None:
    with pytest.raises(InvariantViolation):
        ExtractionCandidate(
            id="x",
            attribute=_ATTR,
            value_raw="   ",
            evidence=(_EVIDENCE,),
            method=ExtractionMethod.VERBATIM_ROW_FIELD,
            source_confidence=1.0,
            rationale="verbatim",
        )


def test_candidate_requires_rationale() -> None:
    with pytest.raises(InvariantViolation):
        ExtractionCandidate(
            id="x",
            attribute=_ATTR,
            value_raw="value",
            evidence=(_EVIDENCE,),
            method=ExtractionMethod.VERBATIM_ROW_FIELD,
            source_confidence=1.0,
            rationale="",
        )


@pytest.mark.parametrize("confidence", [-0.1, 1.1])
def test_candidate_confidence_out_of_range(confidence: float) -> None:
    with pytest.raises(InvariantViolation):
        ExtractionCandidate(
            id="x",
            attribute=_ATTR,
            value_raw="value",
            evidence=(_EVIDENCE,),
            method=ExtractionMethod.VERBATIM_ROW_FIELD,
            source_confidence=confidence,
            rationale="verbatim",
        )


def test_candidate_constructs_with_valid_fields() -> None:
    candidate = ExtractionCandidate(
        id="x",
        attribute=_ATTR,
        value_raw="value",
        evidence=(_EVIDENCE,),
        method=ExtractionMethod.VERBATIM_ROW_FIELD,
        source_confidence=1.0,
        rationale="verbatim quote",
    )
    assert not is_unavailable(candidate)


def test_unavailable_requires_detail() -> None:
    with pytest.raises(InvariantViolation):
        ExtractionUnavailable(attribute=_ATTR, reason=UnknownReason.SOURCE_FIELD_BLANK, detail="")


def test_unavailable_is_recognised() -> None:
    unavailable = ExtractionUnavailable(
        attribute=_ATTR, reason=UnknownReason.SOURCE_FIELD_BLANK, detail="blank cell"
    )
    assert is_unavailable(unavailable)
