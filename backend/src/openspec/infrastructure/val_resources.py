"""Loads `resources/rules/*.yaml` into `domain/val/rule.py`'s `ValidationRule`
(`VAL`, M3). File I/O, so this lives in `infrastructure/`, never `domain/` (INV-6) —
mirrors `infrastructure/cls_resources.py`'s pattern exactly. The YAML `condition`
tree is parsed straight into `domain/val/rules_dsl.py`'s dataclasses; nothing here
(or anywhere else in the codebase, `tests/architecture/test_no_eval.py`) ever calls
`eval()`/`exec()` on it.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.val.rule import RuleSeverity, ValidationRule
from openspec.domain.val.rules_dsl import (
    BoolExpr,
    BoolOp,
    Comparator,
    Compare,
    Condition,
    Field,
    Operand,
    ScalarLiteral,
)

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_RULES_DIR = _RESOURCES_ROOT / "rules"

_BOOL_OPS = frozenset({"AND", "OR", "NOT"})


def _parse_operand(raw: Any) -> Operand:
    """A YAML operand is either a scalar literal, or `{field: "<dotted.path>"}` —
    the one place this loader distinguishes "a field reference" from "a literal
    value that happens to be a mapping" is this explicit `field` key, never type
    sniffing on the literal's own shape."""
    if isinstance(raw, dict) and "field" in raw:
        return Field(path=str(raw["field"]))
    return raw  # type: ignore[no-any-return]


def _parse_condition(raw: dict[str, Any]) -> Condition:
    op = str(raw["op"])
    if op in _BOOL_OPS:
        operands = tuple(_parse_condition(o) for o in raw["operands"])
        return BoolExpr(op=BoolOp(op), operands=operands)

    comparator = Comparator(op)
    left = Field(path=str(raw["field"]))
    if comparator in (Comparator.EXISTS, Comparator.NOT_EXISTS):
        return Compare(left=left, op=comparator, right=None)
    if comparator in (Comparator.IN, Comparator.NOT_IN):
        values: tuple[ScalarLiteral, ...] = tuple(raw["values"])
        return Compare(left=left, op=comparator, right=values)
    right = _parse_operand(raw["value"])
    return Compare(left=left, op=comparator, right=right)


def load_validation_rules(path: Path) -> tuple[ValidationRule, ...]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    rules: list[ValidationRule] = []
    for entry in raw.get("rules") or ():
        rules.append(
            ValidationRule(
                rule_id=str(entry["rule_id"]),
                class_codes=tuple(str(c) for c in entry["class_codes"]),
                attributes=tuple(str(a) for a in entry["attributes"]),
                description=str(entry["description"]),
                severity=RuleSeverity(str(entry["severity"])),
                source=str(entry["source"]),
                condition=_parse_condition(entry["condition"]),
            )
        )
    return tuple(rules)


def load_all_validation_rules(rules_dir: Path = DEFAULT_RULES_DIR) -> tuple[ValidationRule, ...]:
    """Loads every `*.yaml` file in `rules_dir`, sorted by filename for a
    deterministic combined order (INV-10's reproducibility spirit — the same rule
    set, in the same order, every run). An empty/missing directory yields an empty
    ruleset rather than an error — mirrors `resources/description-formulas/`'s
    "no configured rules yet" honesty (`docs/15-backend-implementation-status.md`
    §12), not a `ReferenceDataMissing`-style hard failure, since a class with no
    rule file simply has no rules, which is a legitimate starting state."""
    if not rules_dir.exists():
        return ()
    all_rules: list[ValidationRule] = []
    for path in sorted(rules_dir.glob("*.yaml")):
        all_rules.extend(load_validation_rules(path))
    return tuple(all_rules)
