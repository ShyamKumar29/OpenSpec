"""Cross-attribute rule helpers (`docs/05-backend.md` §1's planned `domain/val/
crossfield.py`, `docs/10-roadmap.md` M3 §13's "cross-attribute consistency" rule
type — e.g. PRS-011 "WSP <= WOG when both present", which reads two attributes'
values in one condition). `engine.py`'s `evaluate_rules` already evaluates
cross-field rules with no special casing (a `Condition` tree can reference any
number of distinct `Field.path` roots) — this module exists for the explainability
side: given a rule, which attribute codes does its condition actually depend on?
That answer feeds two real needs: the composition root only needs to resolve
`Facts` entries a ruleset actually reads (no point parsing every attribute's raw
value into a typed fact if no rule looks at it), and a reviewer explanation
("why was this flagged?") can name the *other* attribute(s) a cross-field rule
compared against, not just the one it's nominally attached to.
"""

from __future__ import annotations

from openspec.domain.val.rule import ValidationRule
from openspec.domain.val.rules_dsl import BoolExpr, Condition, Field, Operand, ScalarLiteral


def _operand_attribute_codes(operand: Operand | tuple[ScalarLiteral, ...] | None) -> frozenset[str]:
    if isinstance(operand, Field):
        return frozenset({operand.path.split(".", 1)[0]})
    return frozenset()


def _referenced_attribute_codes(condition: Condition) -> frozenset[str]:
    if isinstance(condition, BoolExpr):
        bool_codes: frozenset[str] = frozenset()
        for sub_condition in condition.operands:
            bool_codes |= _referenced_attribute_codes(sub_condition)
        return bool_codes

    compare_codes: frozenset[str] = frozenset()
    for compare_operand in (condition.left, condition.right):
        compare_codes |= _operand_attribute_codes(compare_operand)
    return compare_codes


def fields_referenced(rule: ValidationRule) -> frozenset[str]:
    """Every distinct attribute code `rule.condition` reads via a `Field`
    reference — a superset of `rule.attributes` for a genuinely cross-field rule
    (e.g. PRS-011, attached to `pressure_rating_wsp`, also reads
    `pressure_rating_wog`)."""
    return _referenced_attribute_codes(rule.condition)


def is_cross_field(rule: ValidationRule) -> bool:
    """`True` when a rule's condition reads at least one attribute beyond the
    ones it is nominally attached to (`rule.attributes`) — the structural signal
    that this is genuinely a cross-attribute-consistency rule, not just a
    single-attribute check with a verbose condition tree."""
    return not fields_referenced(rule).issubset(set(rule.attributes))
