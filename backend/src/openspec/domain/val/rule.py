"""`ValidationRule` — one declarative rule (`docs/10-roadmap.md` M3 §11, §12).
`docs/04-data-model.md` §3.2's `validation_rule` table names exactly this shape:
`rule_code`, `kind`, `expression`, `severity`, `ruleset_version`. `expression` here is
`domain/val/rules_dsl.py`'s `Condition` tree, not a string — the DB-shaped
`expression` column is this tree serialised to JSON at the persistence boundary
(not built in this milestone — no write path exists yet, `docs/15-backend-
implementation-status.md` §4), never a string handed to `eval()`.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation
from openspec.domain.val.rules_dsl import Condition


class RuleSeverity(StrEnum):
    """What happens to the attribute value when this rule's `condition` evaluates
    to `False` (`docs/10-roadmap.md` M3 §11-§14). There is no third severity —
    a rule either blocks assertion outright or merely flags it for a human, mirroring
    every other closed-set status shape in this codebase."""

    BLOCK = "BLOCK"  # a definite data error — the value cannot stand as asserted;
    # `VAL` downgrades it to `Unknown(VALIDATION_FAILED)`.
    FLAG = "FLAG"  # a signal worth a human's attention, not proof of an error
    # (`docs/domain/pvf-reference.md` §6: "Outside that range -> review", not reject) —
    # `VAL` downgrades ACCEPTED to `NEEDS_REVIEW` but keeps the value.


@dataclass(frozen=True, slots=True)
class ValidationRule:
    rule_id: str
    class_codes: tuple[str, ...]
    attributes: tuple[str, ...]
    description: str
    severity: RuleSeverity
    source: str
    condition: Condition

    def __post_init__(self) -> None:
        if not self.rule_id.strip():
            raise InvariantViolation("ValidationRule.rule_id must be non-blank")
        if not self.class_codes:
            raise InvariantViolation(
                f"ValidationRule {self.rule_id}: class_codes must be non-empty"
            )
        if not self.attributes:
            raise InvariantViolation(f"ValidationRule {self.rule_id}: attributes must be non-empty")
        if not self.description.strip():
            raise InvariantViolation(
                f"ValidationRule {self.rule_id}: description must be non-blank"
            )
        if not self.source.strip():
            raise InvariantViolation(
                f"ValidationRule {self.rule_id}: source must be non-blank — every rule "
                "needs a documented origin (docs/domain/pvf-reference.md §10: "
                '"every rule needs... a primary-source citation before it ships")'
            )


def applies_to(rule: ValidationRule, *, class_code: str, attribute_code: str) -> bool:
    return class_code in rule.class_codes and attribute_code in rule.attributes
