"""The restricted rules DSL (`docs/05-backend.md` §6: "rule expressions are
evaluated by a restricted interpreter supporting only comparison, boolean logic,
arithmetic, and field references... `eval()` and `exec()` are banned by an
architecture test"). Every node here is a plain, frozen dataclass — a rule's
condition is *parsed* out of YAML into this shape by
`infrastructure/val_resources.py` (I/O lives there, not here); it is never a string
that gets evaluated. `tests/architecture/test_no_eval.py` enforces the "never
`eval()`" half of this contract for the whole codebase, this module included.

**`Facts` is a plain `dict[str, object]`**, keyed by attribute code, built by the
caller (`application/usecases/validate_attribute_value.py`) from whatever
already-verified values are available for one record — an already-parsed value
object (e.g. `domain/nrm/pressure.py`'s `PressureRating`) where one exists, or a
bare string otherwise. `Field.path` is a dotted path into that dict, e.g.
`"pressure_rating_wog.magnitude"`; resolution stops and reports `MISSING` (never
raises) the moment an attribute is absent or an attribute *value* doesn't carry the
requested sub-field — a rule referencing a field that genuinely doesn't apply to
this record must never crash validation for every other rule alongside it.

**Missing-field policy, stated once here rather than per rule:** a `Compare` whose
`left` (or non-tuple `right`) resolves to `MISSING` evaluates to `False` — never
raises, never silently evaluates to `True`. This is what lets a rule like PRS-011
("WSP <= WOG *when both present*") be written as a plain comparison: if either side
is genuinely absent, the comparison itself is `False`, and a rule author wraps it in
`OR NOT_EXISTS(...)` explicitly wherever "not applicable" should mean the rule
passes rather than fails — the DSL never guesses which is intended.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation

ScalarLiteral = str | int | float | bool | None


class _MissingType:
    """Singleton sentinel distinct from `None` — `None` is itself a legal literal
    value a rule might compare against (e.g. "temperature_qualifier is None"),
    so "the field does not exist at all" needs its own, different value."""

    def __repr__(self) -> str:
        return "<MISSING>"


MISSING = _MissingType()


@dataclass(frozen=True, slots=True)
class Field:
    path: str

    def __post_init__(self) -> None:
        if not self.path.strip():
            raise InvariantViolation("Field.path must be non-blank")


Operand = Field | ScalarLiteral


class Comparator(StrEnum):
    EQ = "EQ"
    NE = "NE"
    LT = "LT"
    LE = "LE"
    GT = "GT"
    GE = "GE"
    IN = "IN"
    NOT_IN = "NOT_IN"
    EXISTS = "EXISTS"
    NOT_EXISTS = "NOT_EXISTS"


_NO_RIGHT_OPERAND = frozenset({Comparator.EXISTS, Comparator.NOT_EXISTS})
_SET_OPERAND = frozenset({Comparator.IN, Comparator.NOT_IN})


@dataclass(frozen=True, slots=True)
class Compare:
    """`right=None` (the default) means "no right operand was supplied" — used only
    by `EXISTS`/`NOT_EXISTS`. Every other comparator requires an explicit `right`, so
    a rule cannot silently compare against nothing. One consequence: this DSL cannot
    express "field is exactly the literal `None`" via `EQ` (it would be
    indistinguishable from "no operand supplied" and is rejected at construction) —
    use `EXISTS`/`NOT_EXISTS` for presence checks instead, which is what every rule
    in `resources/rules/` actually needs."""

    left: Operand
    op: Comparator
    right: Operand | tuple[ScalarLiteral, ...] | None = None

    def __post_init__(self) -> None:
        if self.op in _SET_OPERAND and not isinstance(self.right, tuple):
            raise InvariantViolation(f"Comparator {self.op.value} requires a tuple right operand")
        if self.op in _NO_RIGHT_OPERAND and self.right is not None:
            raise InvariantViolation(f"Comparator {self.op.value} takes no right operand")
        if self.op not in _SET_OPERAND and self.op not in _NO_RIGHT_OPERAND and self.right is None:
            raise InvariantViolation(f"Comparator {self.op.value} requires a right operand")


class BoolOp(StrEnum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


@dataclass(frozen=True, slots=True)
class BoolExpr:
    op: BoolOp
    operands: tuple[Condition, ...]

    def __post_init__(self) -> None:
        if not self.operands:
            raise InvariantViolation("BoolExpr.operands must be non-empty")
        if self.op is BoolOp.NOT and len(self.operands) != 1:
            raise InvariantViolation("BoolOp.NOT takes exactly one operand")


Condition = Compare | BoolExpr
Facts = dict[str, object]


def resolve_field(field: Field, facts: Facts) -> object:
    parts = field.path.split(".")
    if parts[0] not in facts:
        return MISSING
    value: object = facts[parts[0]]
    for part in parts[1:]:
        try:
            value = getattr(value, part)
        except AttributeError:
            return MISSING
    return value


def _resolve_operand(operand: Operand, facts: Facts) -> object:
    if isinstance(operand, Field):
        return resolve_field(operand, facts)
    return operand


def evaluate(condition: Condition, facts: Facts) -> bool:
    """Total: every legal `Condition` produces `True`/`False`, never an exception —
    a rule that cannot be meaningfully evaluated (missing field, incomparable types)
    evaluates to `False` rather than crashing the whole validation run for every
    other rule alongside it (see module docstring's missing-field policy)."""
    if isinstance(condition, BoolExpr):
        if condition.op is BoolOp.AND:
            return all(evaluate(c, facts) for c in condition.operands)
        if condition.op is BoolOp.OR:
            return any(evaluate(c, facts) for c in condition.operands)
        return not evaluate(condition.operands[0], facts)  # NOT

    if condition.op is Comparator.EXISTS:
        return _resolve_operand(condition.left, facts) is not MISSING
    if condition.op is Comparator.NOT_EXISTS:
        return _resolve_operand(condition.left, facts) is MISSING

    left = _resolve_operand(condition.left, facts)
    if left is MISSING:
        return False

    if condition.op in (Comparator.IN, Comparator.NOT_IN):
        if not isinstance(condition.right, tuple):
            raise InvariantViolation(f"{condition.op.value} requires a tuple right operand")
        is_member = left in condition.right
        return is_member if condition.op is Comparator.IN else not is_member

    right = _resolve_operand(condition.right, facts)  # type: ignore[arg-type]
    if right is MISSING:
        return False

    try:
        if condition.op is Comparator.EQ:
            return bool(left == right)
        if condition.op is Comparator.NE:
            return bool(left != right)
        if condition.op is Comparator.LT:
            return bool(left < right)  # type: ignore[operator]
        if condition.op is Comparator.LE:
            return bool(left <= right)  # type: ignore[operator]
        if condition.op is Comparator.GT:
            return bool(left > right)  # type: ignore[operator]
        if condition.op is Comparator.GE:
            return bool(left >= right)  # type: ignore[operator]
    except TypeError:
        # Incomparable types (e.g. a string fact compared with LT to a number) —
        # the rule cannot be meaningfully evaluated against this record's data
        # shape; that is a fact-building problem for the caller to fix, not grounds
        # to crash every other rule's evaluation for this record.
        return False

    raise InvariantViolation(f"Unhandled comparator: {condition.op.value}")
