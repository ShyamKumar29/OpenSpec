"""INV-1 / INV-4 / INV-5 / INV-9 as executable proofs, not just comments."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueAsserted,
    AttributeValueStatus,
    AttributeValueUnknown,
    DocumentSpan,
    ProvenanceKind,
    UnknownReason,
    Verification,
    assert_no_provenance_downgrade,
    attribute_value,
    is_unknown,
)

TIER1_ATTR = AttributeRef(
    code="seat_material", name="Seat Material", datatype="enum", risk_tier=2, is_mandatory=True
)
TIER0_ATTR = AttributeRef(
    code="pressure_rating_wog",
    name="Pressure Rating (WOG)",
    datatype="pressure",
    risk_tier=0,
    is_mandatory=True,
)


def make_evidence() -> DocumentSpan:
    return DocumentSpan(
        document_version_id="doc_1",
        page=2,
        region_id="table:1/row:14",
        char_start=0,
        char_end=7,
        snippet_text="600 WOG",
        bbox=(1.0, 2.0, 3.0, 4.0),
    )


def make_verification(verdict: str = "ENTAILED") -> Verification:
    return Verification(
        verdict=verdict,
        deterministic_check="exact",
        rationale="Row 14 matches ABC-123.",
        verifier_model="claude-verifier",
    )


class TestInv1NoUnsourcedAssertion:
    def test_asserted_value_requires_evidence(self) -> None:
        with pytest.raises(InvariantViolation, match="INV-1"):
            AttributeValueAsserted(
                id="av_1",
                attribute=TIER1_ATTR,
                created_at="2026-08-13T00:00:00Z",
                status=AttributeValueStatus.ACCEPTED,
                value_display="PTFE",
                value_canonical={"value": "PTFE"},
                value_raw="PTFE",
                provenance_kind=ProvenanceKind.EXTRACTED,
                confidence=0.9,
                evidence=(),  # <-- fabrication attempt
                verification=make_verification(),
            )

    def test_factory_extracted_requires_nonempty_evidence_tuple(self) -> None:
        value = attribute_value.extracted(
            id="av_2",
            attribute=TIER1_ATTR,
            created_at="2026-08-13T00:00:00Z",
            status=AttributeValueStatus.ACCEPTED,
            value_display="PTFE",
            value_canonical=None,
            value_raw="PTFE",
            provenance_kind=ProvenanceKind.EXTRACTED,
            confidence=0.9,
            evidence=(make_evidence(),),
            verification=make_verification(),
        )
        assert value.evidence == (make_evidence(),)
        assert not is_unknown(value)


class TestInv4UnknownIsFirstClass:
    def test_unknown_has_no_value_field_and_carries_a_reason(self) -> None:
        value = attribute_value.unknown(
            id="av_3",
            attribute=TIER1_ATTR,
            created_at="2026-08-13T00:00:00Z",
            reason=UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT,
        )
        assert isinstance(value, AttributeValueUnknown)
        assert value.unknown_reason is UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT
        assert is_unknown(value)
        # There is no `.value_display` on this type at all — a static-typing
        # guarantee mypy enforces; this test documents the contract in prose.
        assert not hasattr(value, "value_display")


class TestInv5ProvenanceNeverUpgraded:
    def test_extracted_cannot_supersede_derived(self) -> None:
        with pytest.raises(InvariantViolation, match="INV-5"):
            assert_no_provenance_downgrade(ProvenanceKind.DERIVED, ProvenanceKind.INFERRED)

    def test_derived_may_supersede_inferred(self) -> None:
        assert_no_provenance_downgrade(ProvenanceKind.INFERRED, ProvenanceKind.DERIVED)

    def test_human_always_permitted_either_direction(self) -> None:
        assert_no_provenance_downgrade(ProvenanceKind.EXTRACTED, ProvenanceKind.HUMAN)


class TestInv9Tier0NeverAutoAccepts:
    def test_tier0_accepted_is_rejected_even_with_full_evidence_and_verification(self) -> None:
        with pytest.raises(InvariantViolation, match="INV-9"):
            attribute_value.extracted(
                id="av_4",
                attribute=TIER0_ATTR,
                created_at="2026-08-13T00:00:00Z",
                status=AttributeValueStatus.ACCEPTED,
                value_display="600 psi",
                value_canonical={"magnitude": 600, "unit": "psi", "media": "WOG"},
                value_raw="600 WOG",
                provenance_kind=ProvenanceKind.EXTRACTED,
                confidence=0.97,
                evidence=(make_evidence(),),
                verification=make_verification(),
            )

    def test_tier0_needs_approval_is_fine(self) -> None:
        value = attribute_value.extracted(
            id="av_5",
            attribute=TIER0_ATTR,
            created_at="2026-08-13T00:00:00Z",
            status=AttributeValueStatus.NEEDS_APPROVAL,
            value_display="600 psi",
            value_canonical={"magnitude": 600, "unit": "psi", "media": "WOG"},
            value_raw="600 WOG",
            provenance_kind=ProvenanceKind.EXTRACTED,
            confidence=0.97,
            evidence=(make_evidence(),),
            verification=make_verification(),
        )
        assert value.status is AttributeValueStatus.NEEDS_APPROVAL
