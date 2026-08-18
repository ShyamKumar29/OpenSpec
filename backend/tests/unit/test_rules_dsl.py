"""`domain/val/rules_dsl.py` — the restricted VAL expression interpreter
(`docs/05-backend.md` §6)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.val.rules_dsl import (
    MISSING,
    BoolExpr,
    BoolOp,
    Comparator,
    Compare,
    Field,
    evaluate,
    resolve_field,
)


def test_resolve_field_simple_key() -> None:
    assert resolve_field(Field(path="a"), {"a": 1}) == 1


def test_resolve_field_missing_top_level_key() -> None:
    assert resolve_field(Field(path="a"), {}) is MISSING


def test_resolve_field_nested_attribute() -> None:
    facts = {"pressure": SimpleNamespace(magnitude=600)}
    assert resolve_field(Field(path="pressure.magnitude"), facts) == 600


def test_resolve_field_missing_nested_attribute() -> None:
    facts = {"pressure": SimpleNamespace(magnitude=600)}
    assert resolve_field(Field(path="pressure.unit"), facts) is MISSING


class TestCompare:
    def test_eq(self) -> None:
        assert evaluate(Compare(left=Field("a"), op=Comparator.EQ, right=1), {"a": 1})
        assert not evaluate(Compare(left=Field("a"), op=Comparator.EQ, right=2), {"a": 1})

    def test_ne(self) -> None:
        assert evaluate(Compare(left=Field("a"), op=Comparator.NE, right=2), {"a": 1})

    def test_lt_le_gt_ge(self) -> None:
        facts = {"a": 5}
        assert evaluate(Compare(left=Field("a"), op=Comparator.LT, right=10), facts)
        assert evaluate(Compare(left=Field("a"), op=Comparator.LE, right=5), facts)
        assert evaluate(Compare(left=Field("a"), op=Comparator.GT, right=1), facts)
        assert evaluate(Compare(left=Field("a"), op=Comparator.GE, right=5), facts)

    def test_field_vs_field(self) -> None:
        facts = {"wsp": SimpleNamespace(magnitude=100), "wog": SimpleNamespace(magnitude=600)}
        cond = Compare(left=Field("wsp.magnitude"), op=Comparator.LE, right=Field("wog.magnitude"))
        assert evaluate(cond, facts)

    def test_in_and_not_in(self) -> None:
        facts = {"a": "BRASS"}
        assert evaluate(
            Compare(left=Field("a"), op=Comparator.IN, right=("BRASS", "BRONZE")), facts
        )
        assert not evaluate(
            Compare(left=Field("a"), op=Comparator.NOT_IN, right=("BRASS", "BRONZE")), facts
        )

    def test_exists_not_exists(self) -> None:
        assert evaluate(Compare(left=Field("a"), op=Comparator.EXISTS), {"a": 1})
        assert not evaluate(Compare(left=Field("a"), op=Comparator.EXISTS), {})
        assert evaluate(Compare(left=Field("a"), op=Comparator.NOT_EXISTS), {})

    def test_missing_left_never_raises_and_is_false(self) -> None:
        assert not evaluate(Compare(left=Field("missing"), op=Comparator.GT, right=1), {})

    def test_missing_right_field_never_raises_and_is_false(self) -> None:
        cond = Compare(left=Field("a"), op=Comparator.LT, right=Field("missing"))
        assert not evaluate(cond, {"a": 1})

    def test_incomparable_types_never_raise(self) -> None:
        cond = Compare(left=Field("a"), op=Comparator.LT, right=5)
        assert not evaluate(cond, {"a": "not a number"})

    def test_in_requires_tuple_right(self) -> None:
        with pytest.raises(InvariantViolation):
            Compare(left=Field("a"), op=Comparator.IN, right="not a tuple")  # type: ignore[arg-type]

    def test_exists_takes_no_right_operand(self) -> None:
        with pytest.raises(InvariantViolation):
            Compare(left=Field("a"), op=Comparator.EXISTS, right=1)

    def test_eq_requires_a_right_operand(self) -> None:
        with pytest.raises(InvariantViolation):
            Compare(left=Field("a"), op=Comparator.EQ, right=None)


class TestBoolExpr:
    def test_and(self) -> None:
        cond = BoolExpr(
            op=BoolOp.AND,
            operands=(
                Compare(left=Field("a"), op=Comparator.EQ, right=1),
                Compare(left=Field("b"), op=Comparator.EQ, right=2),
            ),
        )
        assert evaluate(cond, {"a": 1, "b": 2})
        assert not evaluate(cond, {"a": 1, "b": 3})

    def test_or(self) -> None:
        cond = BoolExpr(
            op=BoolOp.OR,
            operands=(
                Compare(left=Field("a"), op=Comparator.EQ, right=1),
                Compare(left=Field("b"), op=Comparator.EQ, right=2),
            ),
        )
        assert evaluate(cond, {"a": 1, "b": 99})
        assert not evaluate(cond, {"a": 99, "b": 99})

    def test_not(self) -> None:
        cond = BoolExpr(
            op=BoolOp.NOT, operands=(Compare(left=Field("a"), op=Comparator.EQ, right=1),)
        )
        assert not evaluate(cond, {"a": 1})
        assert evaluate(cond, {"a": 2})

    def test_not_requires_exactly_one_operand(self) -> None:
        with pytest.raises(InvariantViolation):
            BoolExpr(op=BoolOp.NOT, operands=())

    def test_empty_operands_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            BoolExpr(op=BoolOp.AND, operands=())

    def test_the_conditional_requirement_idiom_when_field_absent(self) -> None:
        """PRS-011's shape: 'A <= B when both present' — absence of either makes
        the rule pass, never fail."""
        cond = BoolExpr(
            op=BoolOp.OR,
            operands=(
                Compare(left=Field("wsp"), op=Comparator.NOT_EXISTS),
                Compare(left=Field("wog"), op=Comparator.NOT_EXISTS),
                Compare(
                    left=Field("wsp.magnitude"), op=Comparator.LE, right=Field("wog.magnitude")
                ),
            ),
        )
        assert evaluate(cond, {})  # neither present -> passes
        assert evaluate(cond, {"wsp": SimpleNamespace(magnitude=100)})  # only one -> passes
