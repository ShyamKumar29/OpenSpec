"""`domain/sch/completeness.py` (`SCH`, M1). Extracted from
`infrastructure/memory/repositories.py`'s previously-private, untested
`_completeness` helper — these are the tests it never had."""

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
from openspec.domain.sch.completeness import compute_completeness

_ATTR = AttributeRef(code="a", name="A", datatype="string", risk_tier=1, is_mandatory=True)


def _evidence() -> tuple[SourceRowSpan, ...]:
    return (
        SourceRowSpan(
            source_dataset="ds", row_identifier="1", source_column="col", snippet_text="x"
        ),
    )


def _verification() -> Verification:
    return Verification(
        verdict="ENTAILED", deterministic_check="exact", rationale="r", verifier_model="m"
    )


def _asserted(status: AttributeValueStatus, code: str = "a"):
    return attribute_value.extracted(
        id=f"av_{code}_{status.value}",
        attribute=AttributeRef(
            code=code, name=code, datatype="string", risk_tier=1, is_mandatory=True
        ),
        created_at="2026-08-14T00:00:00Z",
        status=status,
        value_display="x",
        value_canonical=None,
        value_raw="x",
        provenance_kind=ProvenanceKind.EXTRACTED,
        confidence=0.9,
        evidence=_evidence(),
        verification=_verification(),
    )


def _unknown(code: str = "u") -> object:
    return attribute_value.unknown(
        id=f"av_{code}",
        attribute=AttributeRef(
            code=code, name=code, datatype="string", risk_tier=1, is_mandatory=True
        ),
        created_at="2026-08-14T00:00:00Z",
        reason=UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT,
    )


def test_empty_values_are_all_zero() -> None:
    c = compute_completeness(())
    assert c == compute_completeness(())
    assert c.mandatory_total == 0
    assert c.filled == 0
    assert c.accepted == 0
    assert c.pending_review == 0
    assert c.unknown == 0


def test_accepted_counts_as_filled_and_accepted() -> None:
    c = compute_completeness((_asserted(AttributeValueStatus.ACCEPTED),))
    assert c.mandatory_total == 1
    assert c.filled == 1
    assert c.accepted == 1
    assert c.pending_review == 0
    assert c.unknown == 0


def test_needs_review_and_needs_approval_both_count_as_pending() -> None:
    values = (
        _asserted(AttributeValueStatus.NEEDS_REVIEW, code="a"),
        _asserted(AttributeValueStatus.NEEDS_APPROVAL, code="b"),
    )
    c = compute_completeness(values)
    assert c.mandatory_total == 2
    assert c.filled == 2
    assert c.accepted == 0
    assert c.pending_review == 2
    assert c.unknown == 0


def test_unknown_counts_as_not_filled() -> None:
    c = compute_completeness((_unknown(),))
    assert c.mandatory_total == 1
    assert c.filled == 0
    assert c.accepted == 0
    assert c.pending_review == 0
    assert c.unknown == 1


def test_mixed_values_sum_correctly() -> None:
    values = (
        _asserted(AttributeValueStatus.ACCEPTED, code="a"),
        _asserted(AttributeValueStatus.ACCEPTED, code="b"),
        _asserted(AttributeValueStatus.NEEDS_REVIEW, code="c"),
        _unknown(code="d"),
    )
    c = compute_completeness(values)
    assert c.mandatory_total == 4
    assert c.filled == 3
    assert c.accepted == 2
    assert c.pending_review == 1
    assert c.unknown == 1


def test_deterministic_repeated_calls() -> None:
    values = (
        _asserted(AttributeValueStatus.ACCEPTED, code="a"),
        _unknown(code="b"),
    )
    assert compute_completeness(values) == compute_completeness(values)
