"""`application/usecases/classify_record.py` (`CLS`, M1). All rules/tables
here are small, explicitly-labelled fixtures, not the real shipped resource
files (those are exercised in `test_cls_resources.py`)."""

from __future__ import annotations

import pytest

from openspec.application.ports.llm import LlmRequest, LlmResponse
from openspec.application.usecases.classify_record import ClassificationPolicy, classify_record
from openspec.domain.cls.rules_engine import ClassificationRule
from openspec.domain.errors import DomainAbstention, InvariantViolation
from openspec.domain.model.attribute import UnknownReason
from openspec.domain.model.classification import (
    ClassificationMethod,
    ClassificationResolved,
    ClassificationUnresolved,
)

_ABBREVIATIONS = {"BV": "ball valve", "BRS": "brass"}
_RULES = (
    ClassificationRule(
        class_code="BALL_VALVE_BRONZE",
        required_keyword_groups=(frozenset({"ball valve"}), frozenset({"brass", "bronze"})),
        confidence=0.9,
    ),
)
_KNOWN_CODES = frozenset({"BALL_VALVE_BRONZE", "GATE_VALVE"})
_POLICY = ClassificationPolicy(
    rule_min_confidence=0.6, llm_validated_confidence=0.7, llm_model="test-model"
)
_PROMPT = "classes:\n{class_list}\nmpn={mpn}\ndesc={description}"


class _FakeLLM:
    def __init__(self, response: LlmResponse | Exception) -> None:
        self._response = response

    def complete(self, request: LlmRequest) -> LlmResponse:
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


def _classify(*, description: str, mpn: str = "ABC-123", llm=None, prompt=_PROMPT):
    return classify_record(
        record_id="r1",
        mpn=mpn,
        description=description,
        source_dataset="sample_input.csv",
        row_identifier="1",
        description_column="Part_Desc",
        abbreviations=_ABBREVIATIONS,
        rules=_RULES,
        known_class_codes=_KNOWN_CODES,
        policy=_POLICY,
        prompt_template=prompt,
        llm=llm,
    )


def test_deterministic_positive_case_resolves_via_rule() -> None:
    result = _classify(description="BV BRS")
    assert isinstance(result, ClassificationResolved)
    assert result.candidate.class_code == "BALL_VALVE_BRONZE"
    assert result.candidate.method is ClassificationMethod.RULE
    assert len(result.evidence) == 1
    assert result.evidence[0].snippet_text == "BV BRS"


def test_deterministic_negative_case_falls_through_with_no_llm() -> None:
    result = _classify(description="copper fitting", llm=None)
    assert isinstance(result, ClassificationUnresolved)
    assert result.reason is UnknownReason.CLASS_UNRESOLVED
    assert result.attempted == ()


def test_ambiguous_rule_tie_is_unresolved() -> None:
    tied_rules = _RULES + (
        ClassificationRule(
            class_code="GATE_VALVE",
            required_keyword_groups=(frozenset({"ball valve"}), frozenset({"brass", "bronze"})),
            confidence=0.9,
        ),
    )
    result = classify_record(
        record_id="r1",
        mpn="ABC",
        description="BV BRS",
        source_dataset="ds",
        row_identifier="1",
        description_column="Part_Desc",
        abbreviations=_ABBREVIATIONS,
        rules=tied_rules,
        known_class_codes=_KNOWN_CODES,
        policy=_POLICY,
        prompt_template=_PROMPT,
        llm=None,
    )
    assert isinstance(result, ClassificationUnresolved)
    assert result.reason is UnknownReason.AMBIGUOUS_CANDIDATES
    assert {c.class_code for c in result.attempted} == {"BALL_VALVE_BRONZE", "GATE_VALVE"}


def test_residual_llm_resolves_when_rule_misses() -> None:
    llm = _FakeLLM(
        LlmResponse(content="GATE_VALVE", model="test-model", tokens_in=10, tokens_out=1)
    )
    result = _classify(description="some gate valve text", llm=llm)
    assert isinstance(result, ClassificationResolved)
    assert result.candidate.class_code == "GATE_VALVE"
    assert result.candidate.method is ClassificationMethod.LLM
    # Confidence is the fixed policy constant, never a model self-report.
    assert result.candidate.confidence == _POLICY.llm_validated_confidence


def test_residual_llm_none_response_is_unresolved() -> None:
    llm = _FakeLLM(LlmResponse(content="NONE", model="test-model", tokens_in=10, tokens_out=1))
    result = _classify(description="mystery item", llm=llm)
    assert isinstance(result, ClassificationUnresolved)
    assert result.reason is UnknownReason.CLASS_UNRESOLVED
    assert result.attempted[-1].class_code == "NONE"


def test_llm_cannot_invent_a_class_outside_the_taxonomy() -> None:
    llm = _FakeLLM(
        LlmResponse(content="MADE_UP_CLASS", model="test-model", tokens_in=10, tokens_out=1)
    )
    result = _classify(description="mystery item", llm=llm)
    assert isinstance(result, ClassificationUnresolved)
    assert result.reason is UnknownReason.CLASS_UNRESOLVED
    assert "not in the approved taxonomy" in result.rationale
    assert result.attempted[-1].class_code == "MADE_UP_CLASS"


def test_llm_unavailable_fails_safe_to_unresolved() -> None:
    llm = _FakeLLM(DomainAbstention("SYSTEM_ERROR", "offline mode"))
    result = _classify(description="mystery item", llm=llm)
    assert isinstance(result, ClassificationUnresolved)
    assert result.reason is UnknownReason.CLASS_UNRESOLVED
    assert "unavailable" in result.rationale


def test_no_llm_and_no_prompt_template_fails_safe() -> None:
    result = _classify(description="mystery item", llm=None, prompt=None)
    assert isinstance(result, ClassificationUnresolved)


def test_determinism_same_input_same_result() -> None:
    r1 = _classify(description="BV BRS")
    r2 = _classify(description="BV BRS")
    assert r1 == r2


def test_policy_rejects_out_of_range_confidence() -> None:
    with pytest.raises(InvariantViolation):
        ClassificationPolicy(rule_min_confidence=1.5, llm_validated_confidence=0.5, llm_model="m")
