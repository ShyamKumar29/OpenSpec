"""`domain/model/classification.py` (`CLS`, M1)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import SourceRowSpan, UnknownReason
from openspec.domain.model.classification import (
    ClassificationCandidate,
    ClassificationMethod,
    ClassificationResolved,
    ClassificationUnresolved,
    is_unresolved,
)


def _candidate(**overrides: object) -> ClassificationCandidate:
    defaults: dict[str, object] = {
        "class_code": "BALL_VALVE_BRONZE",
        "confidence": 0.9,
        "method": ClassificationMethod.RULE,
        "rationale": "matched keywords",
    }
    defaults.update(overrides)
    return ClassificationCandidate(**defaults)  # type: ignore[arg-type]


def _evidence() -> SourceRowSpan:
    return SourceRowSpan(
        source_dataset="sample_input.csv",
        row_identifier="1",
        source_column="Part_Desc",
        snippet_text="BRS BALL VLV",
    )


def test_candidate_rejects_blank_class_code() -> None:
    with pytest.raises(InvariantViolation):
        _candidate(class_code="  ")


def test_candidate_rejects_out_of_range_confidence() -> None:
    with pytest.raises(InvariantViolation):
        _candidate(confidence=1.5)
    with pytest.raises(InvariantViolation):
        _candidate(confidence=-0.1)


def test_candidate_rejects_blank_rationale() -> None:
    with pytest.raises(InvariantViolation):
        _candidate(rationale="")


def test_resolved_requires_evidence() -> None:
    with pytest.raises(InvariantViolation):
        ClassificationResolved(record_id="r1", candidate=_candidate(), evidence=())


def test_resolved_with_evidence_constructs() -> None:
    result = ClassificationResolved(record_id="r1", candidate=_candidate(), evidence=(_evidence(),))
    assert result.candidate.class_code == "BALL_VALVE_BRONZE"
    assert not is_unresolved(result)


def test_unresolved_requires_rationale() -> None:
    with pytest.raises(InvariantViolation):
        ClassificationUnresolved(
            record_id="r1", reason=UnknownReason.CLASS_UNRESOLVED, attempted=(), rationale=""
        )


def test_unresolved_is_unresolved() -> None:
    result = ClassificationUnresolved(
        record_id="r1",
        reason=UnknownReason.CLASS_UNRESOLVED,
        attempted=(_candidate(),),
        rationale="no rule or LLM proposal survived validation",
    )
    assert is_unresolved(result)
    assert result.attempted[0].class_code == "BALL_VALVE_BRONZE"
