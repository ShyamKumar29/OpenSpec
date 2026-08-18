"""`domain/val/rule.py` + `domain/val/engine.py` + `domain/val/crossfield.py`
(M3)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.val.crossfield import fields_referenced, is_cross_field
from openspec.domain.val.engine import evaluate_rules, results_for_attribute, worst_failure_severity
from openspec.domain.val.rule import RuleSeverity, ValidationRule, applies_to
from openspec.domain.val.rules_dsl import Comparator, Compare, Field

_SINGLE_FIELD_RULE = ValidationRule(
    rule_id="R1",
    class_codes=("BALL_VALVE_BRONZE",),
    attributes=("body_material",),
    description="body material must be BRASS or BRONZE",
    severity=RuleSeverity.BLOCK,
    source="test fixture",
    condition=Compare(left=Field("body_material"), op=Comparator.IN, right=("BRASS", "BRONZE")),
)

_CROSS_FIELD_RULE = ValidationRule(
    rule_id="R2",
    class_codes=("BALL_VALVE_BRONZE",),
    attributes=("pressure_rating_wsp",),
    description="WSP <= WOG",
    severity=RuleSeverity.FLAG,
    source="test fixture",
    condition=Compare(
        left=Field("pressure_rating_wsp.magnitude"),
        op=Comparator.LE,
        right=Field("pressure_rating_wog.magnitude"),
    ),
)


def test_rule_requires_non_empty_class_codes() -> None:
    with pytest.raises(InvariantViolation):
        ValidationRule(
            rule_id="R",
            class_codes=(),
            attributes=("a",),
            description="d",
            severity=RuleSeverity.BLOCK,
            source="s",
            condition=Compare(left=Field("a"), op=Comparator.EXISTS),
        )


def test_rule_requires_source_citation() -> None:
    with pytest.raises(InvariantViolation):
        ValidationRule(
            rule_id="R",
            class_codes=("C",),
            attributes=("a",),
            description="d",
            severity=RuleSeverity.BLOCK,
            source="",
            condition=Compare(left=Field("a"), op=Comparator.EXISTS),
        )


def test_applies_to() -> None:
    assert applies_to(
        _SINGLE_FIELD_RULE, class_code="BALL_VALVE_BRONZE", attribute_code="body_material"
    )
    assert not applies_to(
        _SINGLE_FIELD_RULE, class_code="GATE_VALVE", attribute_code="body_material"
    )


class TestEngine:
    def test_only_rules_scoped_to_the_class_are_evaluated(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE,), class_code="GATE_VALVE", facts={"body_material": "BRASS"}
        )
        assert results == ()

    def test_passing_rule(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE,),
            class_code="BALL_VALVE_BRONZE",
            facts={"body_material": "BRASS"},
        )
        assert len(results) == 1
        assert results[0].passed

    def test_failing_rule(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE,),
            class_code="BALL_VALVE_BRONZE",
            facts={"body_material": "CI"},
        )
        assert len(results) == 1
        assert not results[0].passed

    def test_results_for_attribute_filters(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE, _CROSS_FIELD_RULE), class_code="BALL_VALVE_BRONZE", facts={}
        )
        assert len(results_for_attribute(results, "body_material")) == 1
        assert len(results_for_attribute(results, "pressure_rating_wsp")) == 1
        assert len(results_for_attribute(results, "unrelated")) == 0

    def test_worst_failure_severity_none_when_all_pass(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE,),
            class_code="BALL_VALVE_BRONZE",
            facts={"body_material": "BRASS"},
        )
        assert worst_failure_severity(results) is None

    def test_worst_failure_severity_block_outranks_flag(self) -> None:
        results = evaluate_rules(
            rules=(_SINGLE_FIELD_RULE, _CROSS_FIELD_RULE),
            class_code="BALL_VALVE_BRONZE",
            facts={
                "body_material": "CI"
            },  # fails R1 (BLOCK); R2 has no facts -> field missing -> fails too (FLAG)
        )
        assert worst_failure_severity(results) is RuleSeverity.BLOCK

    def test_worst_failure_severity_flag_only(self) -> None:
        from types import SimpleNamespace

        results = evaluate_rules(
            rules=(_CROSS_FIELD_RULE,),
            class_code="BALL_VALVE_BRONZE",
            facts={
                "pressure_rating_wsp": SimpleNamespace(magnitude=1000),
                "pressure_rating_wog": SimpleNamespace(magnitude=600),
            },
        )
        assert worst_failure_severity(results) is RuleSeverity.FLAG


class TestCrossfield:
    def test_single_field_rule_is_not_cross_field(self) -> None:
        assert not is_cross_field(_SINGLE_FIELD_RULE)
        assert fields_referenced(_SINGLE_FIELD_RULE) == frozenset({"body_material"})

    def test_cross_field_rule_is_detected(self) -> None:
        assert is_cross_field(_CROSS_FIELD_RULE)
        assert fields_referenced(_CROSS_FIELD_RULE) == frozenset(
            {"pressure_rating_wsp", "pressure_rating_wog"}
        )
