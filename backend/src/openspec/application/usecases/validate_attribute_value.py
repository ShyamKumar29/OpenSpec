"""`VAL` orchestration (M3, `docs/10-roadmap.md` M3 §11-§14). Consumes an
already-verified `AttributeValue` (from `application/usecases/verify_extraction.py`)
and a caller-built `Facts` dict — **it never extracts a value itself**
(`docs/10-roadmap.md` M3 §14: "VAL should consume already-extracted/verified values.
It must not extract values itself.").

**VAL only ever makes a value *more* conservative, never less.** A `BLOCK`-severity
failure downgrades an asserted value all the way to `Unknown(VALIDATION_FAILED)`; a
`FLAG`-severity failure downgrades `ACCEPTED` to `NEEDS_REVIEW` but keeps the value
and its evidence intact; anything already `NEEDS_REVIEW`/`NEEDS_APPROVAL` stays
exactly where it is even if a `FLAG` rule also fires (it cannot get *less*
conservative than that). There is no path in this module that turns a rejected or
under-review value back into `ACCEPTED` — matching CLAUDE.md's "if something is
ambiguous, prefer the option that produces less output and more evidence".
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.attribute import (
    AttributeValue,
    AttributeValueAsserted,
    AttributeValueStatus,
    AttributeValueUnknown,
    UnknownReason,
    attribute_value,
)
from openspec.domain.val.engine import (
    RuleResult,
    evaluate_rules,
    results_for_attribute,
    worst_failure_severity,
)
from openspec.domain.val.rule import RuleSeverity, ValidationRule
from openspec.domain.val.rules_dsl import Facts


@dataclass(frozen=True, slots=True)
class ValidationOutcome:
    value: AttributeValue
    results: tuple[RuleResult, ...]


def validate_attribute_value(
    *,
    value: AttributeValue,
    class_code: str,
    facts: Facts,
    rules: tuple[ValidationRule, ...],
) -> ValidationOutcome:
    """`facts` must already include this attribute's own resolved value (and
    anything a cross-field rule needs) — building `Facts` from a set of
    `AttributeValue`s is the caller's job (a composition root, since it needs
    `domain/nrm/*`'s pure parsers to turn `value_raw` strings into typed facts,
    which is itself a legitimate reuse of already-built parsers, not a second `NRM`
    stage — see `docs/domain/pvf-reference.md` for what those parsers cover today)."""
    all_results = evaluate_rules(rules=rules, class_code=class_code, facts=facts)
    results = results_for_attribute(all_results, value.attribute.code)

    if isinstance(value, AttributeValueUnknown):
        # Nothing to validate against an abstention — rules are still evaluated
        # above (for transparency/explainability, e.g. a "Why?" panel showing what
        # *would* have applied) but never change an Unknown's reason.
        return ValidationOutcome(value=value, results=results)

    severity = worst_failure_severity(results)
    if severity is RuleSeverity.BLOCK:
        downgraded: AttributeValue = attribute_value.unknown(
            id=value.id,
            attribute=value.attribute,
            created_at=value.created_at,
            reason=UnknownReason.VALIDATION_FAILED,
        )
        return ValidationOutcome(value=downgraded, results=results)

    if severity is RuleSeverity.FLAG and value.status is AttributeValueStatus.ACCEPTED:
        reviewed: AttributeValue = _with_status(value, AttributeValueStatus.NEEDS_REVIEW)
        return ValidationOutcome(value=reviewed, results=results)

    return ValidationOutcome(value=value, results=results)


def _with_status(
    value: AttributeValueAsserted, status: AttributeValueStatus
) -> AttributeValueAsserted:
    """Every other field carried over unchanged — VAL changes a value's status,
    never its evidence, verification, or provenance (those belong to `EXT`/`VER`,
    not this stage)."""
    return attribute_value.extracted(
        id=value.id,
        attribute=value.attribute,
        created_at=value.created_at,
        status=status,
        value_display=value.value_display,
        value_canonical=value.value_canonical,
        value_raw=value.value_raw,
        provenance_kind=value.provenance_kind,
        confidence=value.confidence,
        evidence=value.evidence,
        verification=value.verification,
    )
