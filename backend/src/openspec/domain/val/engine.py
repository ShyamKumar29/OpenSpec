"""The `VAL` rule-evaluation engine (`docs/10-roadmap.md` M3 §14: "`VAL` should
consume already-extracted/verified values. It must not extract values itself.").
Pure: given a set of already-loaded `ValidationRule`s, a class code, and a `Facts`
dict already built by the caller, decide which rules apply and whether each one's
condition holds. No I/O, no attribute extraction, no knowledge of `AttributeValue`
at all — `application/usecases/validate_attribute_value.py` is what turns a
`RuleResult` list into a status change on a real value.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.val.rule import RuleSeverity, ValidationRule
from openspec.domain.val.rules_dsl import Facts, evaluate


@dataclass(frozen=True, slots=True)
class RuleResult:
    rule_id: str
    passed: bool
    severity: RuleSeverity
    attributes: tuple[str, ...]
    description: str
    source: str


def evaluate_rules(
    *, rules: tuple[ValidationRule, ...], class_code: str, facts: Facts
) -> tuple[RuleResult, ...]:
    """Runs every rule whose `class_codes` contains `class_code`, regardless of
    which attribute(s) it names — a caller filters the returned tuple by attribute
    with `results_for_attribute` below. Rules not scoped to `class_code` are not
    evaluated at all (not even reported as "passed") — they are simply out of
    scope, the same "not applicable" shape `classify_category` already uses for
    `SCH` (`domain/model/taxonomy.py`)."""
    results: list[RuleResult] = []
    for rule in rules:
        if class_code not in rule.class_codes:
            continue
        passed = evaluate(rule.condition, facts)
        results.append(
            RuleResult(
                rule_id=rule.rule_id,
                passed=passed,
                severity=rule.severity,
                attributes=rule.attributes,
                description=rule.description,
                source=rule.source,
            )
        )
    return tuple(results)


def results_for_attribute(
    results: tuple[RuleResult, ...], attribute_code: str
) -> tuple[RuleResult, ...]:
    return tuple(r for r in results if attribute_code in r.attributes)


def worst_failure_severity(results: tuple[RuleResult, ...]) -> RuleSeverity | None:
    """`None` when every rule passed. `BLOCK` outranks `FLAG` when both are present
    among the failures — a single blocking failure is decisive regardless of how
    many flags also fired alongside it."""
    failed = [r for r in results if not r.passed]
    if not failed:
        return None
    if any(r.severity is RuleSeverity.BLOCK for r in failed):
        return RuleSeverity.BLOCK
    return RuleSeverity.FLAG
