"""`domain/cls/rules_engine.py` (`CLS`, M1). Uses small, explicitly-labelled
fixture tables — not `resources/cls/abbreviations.yaml` — so these tests
exercise the pure matching logic independent of the shipped resource file
(that file gets its own loader test, `test_cls_resources.py`)."""

from __future__ import annotations

import pytest

from openspec.domain.cls.rules_engine import (
    ClassificationRule,
    apply_rules,
    expand_abbreviations,
)

_ABBREVIATIONS = {"BV": "ball valve", "BRS": "brass", "VLV": "valve"}

_RULES = (
    ClassificationRule(
        class_code="BALL_VALVE_BRONZE",
        required_keyword_groups=(frozenset({"ball valve"}), frozenset({"brass", "bronze"})),
        confidence=0.9,
    ),
    ClassificationRule(
        class_code="GATE_VALVE",
        required_keyword_groups=(frozenset({"gate valve"}),),
        confidence=0.85,
    ),
)


def test_expand_abbreviations_expands_known_tokens_case_insensitively() -> None:
    assert expand_abbreviations("bv BRS", _ABBREVIATIONS) == "ball valve brass"


def test_expand_abbreviations_lowercases_unknown_tokens() -> None:
    assert expand_abbreviations("Some Random Text", _ABBREVIATIONS) == "some random text"


def test_expand_abbreviations_does_not_substring_match() -> None:
    # "ABVX" is one token, not a match for "BV" — whole-token only.
    assert expand_abbreviations("ABVX", _ABBREVIATIONS) == "abvx"


def test_expand_abbreviations_is_deterministic() -> None:
    text = "BV BRS VLV"
    assert expand_abbreviations(text, _ABBREVIATIONS) == expand_abbreviations(text, _ABBREVIATIONS)


def test_apply_rules_positive_match() -> None:
    expanded = expand_abbreviations("BV BRS", _ABBREVIATIONS)
    matched = apply_rules(expanded, _RULES)
    assert [r.class_code for r in matched] == ["BALL_VALVE_BRONZE"]


def test_apply_rules_negative_no_match() -> None:
    expanded = expand_abbreviations("copper fitting", _ABBREVIATIONS)
    assert apply_rules(expanded, _RULES) == ()


def test_apply_rules_requires_every_group() -> None:
    # "ball valve" present, but no material keyword — rule must not fire.
    expanded = expand_abbreviations("BV", _ABBREVIATIONS)
    assert apply_rules(expanded, _RULES) == ()


def test_apply_rules_ambiguous_when_multiple_rules_match() -> None:
    ambiguous_rules = _RULES + (
        ClassificationRule(
            class_code="BALL_VALVE_STEEL",
            required_keyword_groups=(frozenset({"ball valve"}), frozenset({"brass", "bronze"})),
            confidence=0.9,
        ),
    )
    expanded = expand_abbreviations("BV BRS", _ABBREVIATIONS)
    matched = apply_rules(expanded, ambiguous_rules)
    assert {r.class_code for r in matched} == {"BALL_VALVE_BRONZE", "BALL_VALVE_STEEL"}


def test_rule_rejects_empty_keyword_groups() -> None:
    with pytest.raises(ValueError):
        ClassificationRule(class_code="X", required_keyword_groups=(), confidence=0.5)


def test_rule_rejects_empty_group() -> None:
    with pytest.raises(ValueError):
        ClassificationRule(class_code="X", required_keyword_groups=(frozenset(),), confidence=0.5)


def test_rule_rejects_out_of_range_confidence() -> None:
    with pytest.raises(ValueError):
        ClassificationRule(
            class_code="X", required_keyword_groups=(frozenset({"a"}),), confidence=1.1
        )
