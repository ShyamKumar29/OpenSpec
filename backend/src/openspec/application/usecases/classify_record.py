"""Classification use case (`CLS`, M1 — docs/10-roadmap.md M1). Deterministic
pre-pass first (`domain/cls/rules_engine.py`, docs/domain/pvf-reference.md
§8); residual cases only reach the LLM (`application/ports/llm.py`), and
every LLM proposal is validated against the closed taxonomy before being
trusted — "an LLM may propose a class, it must NOT create a class" (M1
brief). Never imports `infrastructure/` (`tests/architecture/
test_layering.py`): the prompt template, abbreviation table, rule set, and
taxonomy's known class codes are all passed in, already loaded, by the
composition root.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.llm import LlmMessage, LLMProvider, LlmRequest
from openspec.domain.cls.rules_engine import (
    AbbreviationTable,
    ClassificationRule,
    apply_rules,
    expand_abbreviations,
)
from openspec.domain.errors import DomainAbstention, InvariantViolation
from openspec.domain.model.attribute import SourceRowSpan, UnknownReason
from openspec.domain.model.classification import (
    ClassificationCandidate,
    ClassificationMethod,
    ClassificationResolved,
    ClassificationResult,
    ClassificationUnresolved,
)

_PROMPT_VERSION = "cls_v1"


@dataclass(frozen=True, slots=True)
class ClassificationPolicy:
    """Thresholds are configuration (CLAUDE.md), loaded by
    `infrastructure/cls_policy.py`. `llm_validated_confidence` is a fixed,
    documented-as-uncalibrated constant assigned when the residual LLM's
    proposal survives taxonomy validation — never the model's own
    self-reported confidence."""

    rule_min_confidence: float
    llm_validated_confidence: float
    llm_model: str

    def __post_init__(self) -> None:
        for name in ("rule_min_confidence", "llm_validated_confidence"):
            value = getattr(self, name)
            if not (0.0 <= value <= 1.0):
                raise InvariantViolation(f"ClassificationPolicy.{name} out of range [0,1]: {value}")


def _rule_candidate(rule: ClassificationRule) -> ClassificationCandidate:
    keywords = sorted({kw for group in rule.required_keyword_groups for kw in group})
    return ClassificationCandidate(
        class_code=rule.class_code,
        confidence=rule.confidence,
        method=ClassificationMethod.RULE,
        rationale=f"deterministic rule matched keywords {keywords}",
    )


def _source_evidence(
    *, source_dataset: str, row_identifier: str, description_column: str, description: str
) -> SourceRowSpan:
    return SourceRowSpan(
        source_dataset=source_dataset,
        row_identifier=row_identifier,
        source_column=description_column,
        snippet_text=description,
    )


def classify_record(
    *,
    record_id: str,
    mpn: str,
    description: str,
    source_dataset: str,
    row_identifier: str,
    description_column: str,
    abbreviations: AbbreviationTable,
    rules: tuple[ClassificationRule, ...],
    known_class_codes: frozenset[str],
    policy: ClassificationPolicy,
    prompt_template: str | None,
    llm: LLMProvider | None,
) -> ClassificationResult:
    """Deterministic pre-pass first; residual LLM only on a pre-pass miss.
    Every branch ends in a `ClassificationResolved` (evidenced, taxonomy-
    member class) or a `ClassificationUnresolved` (never a guess) — there is
    no third outcome."""
    expanded = expand_abbreviations(description, abbreviations)
    matched = apply_rules(expanded, rules)
    attempted: list[ClassificationCandidate] = []
    evidence = (
        _source_evidence(
            source_dataset=source_dataset,
            row_identifier=row_identifier,
            description_column=description_column,
            description=description,
        ),
    )

    if matched:
        attempted.extend(_rule_candidate(r) for r in matched)
        best_confidence = max(c.confidence for c in attempted)
        top_codes = {c.class_code for c in attempted if c.confidence == best_confidence}
        if len(top_codes) > 1:
            return ClassificationUnresolved(
                record_id=record_id,
                reason=UnknownReason.AMBIGUOUS_CANDIDATES,
                attempted=tuple(attempted),
                rationale=(
                    f"{len(top_codes)} rule-based classes tied at confidence {best_confidence}: "
                    f"{sorted(top_codes)}"
                ),
            )
        winner = next(c for c in attempted if c.confidence == best_confidence)
        if (
            winner.confidence >= policy.rule_min_confidence
            and winner.class_code in known_class_codes
        ):
            return ClassificationResolved(record_id=record_id, candidate=winner, evidence=evidence)
        # A rule matched but named a class outside the caller's known set, or
        # didn't clear the confidence floor — fall through to the residual
        # path rather than asserting it (no arbitrary fallback).

    # Residual: no deterministic rule resolved this record.
    if llm is None or prompt_template is None:
        return ClassificationUnresolved(
            record_id=record_id,
            reason=UnknownReason.CLASS_UNRESOLVED,
            attempted=tuple(attempted),
            rationale="no LLM provider configured for residual classification",
        )

    prompt = prompt_template.format(
        class_list="\n".join(f"- {c}" for c in sorted(known_class_codes)),
        mpn=mpn,
        description=description,
    )
    try:
        response = llm.complete(
            LlmRequest(
                stage="CLS",
                prompt_version=_PROMPT_VERSION,
                model=policy.llm_model,
                system=(
                    "You are a precise industrial product classifier. "
                    "Respond with only a class code from the supplied list, or NONE."
                ),
                messages=(LlmMessage(role="user", content=prompt),),
            )
        )
    except DomainAbstention as exc:
        return ClassificationUnresolved(
            record_id=record_id,
            reason=UnknownReason.CLASS_UNRESOLVED,
            attempted=tuple(attempted),
            rationale=f"LLM residual classification unavailable: {exc}",
        )

    proposed = response.content.strip()
    llm_candidate = ClassificationCandidate(
        class_code=proposed if proposed else "NONE",
        confidence=policy.llm_validated_confidence,
        method=ClassificationMethod.LLM,
        rationale=f"LLM proposed {proposed!r} (model={response.model})",
    )
    attempted.append(llm_candidate)

    if proposed == "NONE" or proposed not in known_class_codes:
        detail = (
            "LLM found no plausible class"
            if proposed == "NONE"
            else f"LLM proposed {proposed!r}, which is not in the approved taxonomy"
        )
        return ClassificationUnresolved(
            record_id=record_id,
            reason=UnknownReason.CLASS_UNRESOLVED,
            attempted=tuple(attempted),
            rationale=detail,
        )

    return ClassificationResolved(record_id=record_id, candidate=llm_candidate, evidence=evidence)
