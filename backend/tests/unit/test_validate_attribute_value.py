"""`application/usecases/validate_attribute_value.py` (M3)."""

from __future__ import annotations

from openspec.application.usecases.validate_attribute_value import validate_attribute_value
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValueAsserted,
    AttributeValueStatus,
    AttributeValueUnknown,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    Verification,
)
from openspec.domain.val.rule import RuleSeverity, ValidationRule
from openspec.domain.val.rules_dsl import Comparator, Compare, Field

_ATTR = AttributeRef(
    code="body_material", name="Body Material", datatype="enum", risk_tier=1, is_mandatory=True
)
_EVIDENCE = SourceRowSpan(
    source_dataset="d", row_identifier="1", source_column="c", snippet_text="CI"
)
_VERIFICATION = Verification(
    verdict="ENTAILED", deterministic_check="exact", rationale="matched", verifier_model="m"
)

_BLOCK_RULE = ValidationRule(
    rule_id="R1",
    class_codes=("BALL_VALVE_BRONZE",),
    attributes=("body_material",),
    description="must be BRASS/BRONZE",
    severity=RuleSeverity.BLOCK,
    source="test fixture",
    condition=Compare(left=Field("body_material"), op=Comparator.IN, right=("BRASS", "BRONZE")),
)
_FLAG_RULE = ValidationRule(
    rule_id="R2",
    class_codes=("BALL_VALVE_BRONZE",),
    attributes=("body_material",),
    description="prefer common alloys",
    severity=RuleSeverity.FLAG,
    source="test fixture",
    condition=Compare(left=Field("body_material"), op=Comparator.NE, right="CI"),
)


def _accepted_value(
    status: AttributeValueStatus = AttributeValueStatus.ACCEPTED,
) -> AttributeValueAsserted:
    return AttributeValueAsserted(
        id="x",
        attribute=_ATTR,
        created_at="t",
        status=status,
        value_display="CI",
        value_canonical=None,
        value_raw="CI",
        provenance_kind=ProvenanceKind.EXTRACTED,
        confidence=1.0,
        evidence=(_EVIDENCE,),
        verification=_VERIFICATION,
    )


def test_block_rule_failure_downgrades_to_unknown_validation_failed() -> None:
    value = _accepted_value()
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "CI"},
        rules=(_BLOCK_RULE,),
    )
    assert isinstance(outcome.value, AttributeValueUnknown)
    assert outcome.value.unknown_reason is UnknownReason.VALIDATION_FAILED
    assert outcome.value.id == value.id


def test_flag_rule_failure_downgrades_accepted_to_needs_review_but_keeps_the_value() -> None:
    value = _accepted_value()
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "CI"},
        rules=(_FLAG_RULE,),
    )
    assert isinstance(outcome.value, AttributeValueAsserted)
    assert outcome.value.status is AttributeValueStatus.NEEDS_REVIEW
    assert outcome.value.value_raw == "CI"
    assert outcome.value.evidence == value.evidence


def test_flag_never_upgrades_an_already_needs_review_value() -> None:
    value = _accepted_value(status=AttributeValueStatus.NEEDS_APPROVAL)
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "CI"},
        rules=(_FLAG_RULE,),
    )
    assert isinstance(outcome.value, AttributeValueAsserted)
    assert outcome.value.status is AttributeValueStatus.NEEDS_APPROVAL


def test_all_rules_passing_leaves_the_value_unchanged() -> None:
    value = _accepted_value()
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "BRASS"},
        rules=(_BLOCK_RULE, _FLAG_RULE),
    )
    assert outcome.value is value


def test_block_outranks_flag_when_both_fire() -> None:
    value = _accepted_value()
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "CI"},
        rules=(_BLOCK_RULE, _FLAG_RULE),
    )
    assert isinstance(outcome.value, AttributeValueUnknown)


def test_unknown_value_passes_through_unchanged() -> None:
    unknown = AttributeValueUnknown(
        id="x", attribute=_ATTR, created_at="t", unknown_reason=UnknownReason.SOURCE_FIELD_BLANK
    )
    outcome = validate_attribute_value(
        value=unknown, class_code="BALL_VALVE_BRONZE", facts={}, rules=(_BLOCK_RULE,)
    )
    assert outcome.value is unknown


def test_rules_scoped_to_a_different_attribute_do_not_affect_this_one() -> None:
    other_attr_rule = ValidationRule(
        rule_id="R3",
        class_codes=("BALL_VALVE_BRONZE",),
        attributes=("seat_material",),
        description="irrelevant here",
        severity=RuleSeverity.BLOCK,
        source="test fixture",
        condition=Compare(left=Field("seat_material"), op=Comparator.EXISTS),
    )
    value = _accepted_value()
    outcome = validate_attribute_value(
        value=value,
        class_code="BALL_VALVE_BRONZE",
        facts={"body_material": "CI"},
        rules=(other_attr_rule,),
    )
    assert outcome.value is value
