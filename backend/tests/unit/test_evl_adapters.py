"""`domain/evl/adapters.py` (`EVL`, M1)."""

from __future__ import annotations

from openspec.domain.evl.adapters import prediction_from_attribute_value
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    Verification,
    attribute_value,
)

_ATTR = AttributeRef(code="A", name="A", datatype="string", risk_tier=1, is_mandatory=True)


def test_unknown_value_becomes_none_prediction() -> None:
    value = attribute_value.unknown(
        id="av1",
        attribute=_ATTR,
        created_at="2026-08-14T00:00:00Z",
        reason=UnknownReason.SOURCE_FIELD_BLANK,
    )
    pred = prediction_from_attribute_value(record_id="r1", field="A", value=value)
    assert pred.value is None
    assert pred.unknown_reason == "SOURCE_FIELD_BLANK"
    assert pred.status == "UNKNOWN"


def test_asserted_value_carries_display_value_and_evidence_count() -> None:
    evidence = (
        SourceRowSpan(
            source_dataset="ds", row_identifier="1", source_column="col", snippet_text="X"
        ),
    )
    value = attribute_value.extracted(
        id="av1",
        attribute=_ATTR,
        created_at="2026-08-14T00:00:00Z",
        status=AttributeValueStatus.ACCEPTED,
        value_display="X",
        value_canonical=None,
        value_raw="X",
        provenance_kind=ProvenanceKind.EXTRACTED,
        confidence=1.0,
        evidence=evidence,
        verification=Verification(
            verdict="ENTAILED", deterministic_check="exact", rationale="r", verifier_model="m"
        ),
    )
    pred = prediction_from_attribute_value(record_id="r1", field="A", value=value)
    assert pred.value == "X"
    assert pred.unknown_reason is None
    assert pred.status == "ACCEPTED"
    assert pred.evidence_count == 1
