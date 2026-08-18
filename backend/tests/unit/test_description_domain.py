"""Tests for `domain/model/description.py` (UH5, ADR-0013)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.description import (
    AttributeSlot,
    Casing,
    DescriptionFieldConstraint,
    DescriptionFormula,
    LiteralSlot,
)


class TestAttributeSlot:
    def test_valid_slot_constructs(self) -> None:
        slot = AttributeSlot(attribute_code="MANUFACTURER_NAME")
        assert slot.casing is Casing.AS_IS

    def test_blank_attribute_code_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            AttributeSlot(attribute_code=" ")


class TestLiteralSlot:
    def test_valid_slot_constructs(self) -> None:
        assert LiteralSlot(text=", ").text == ", "

    def test_empty_text_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            LiteralSlot(text="")


class TestDescriptionFormula:
    def _formula(self, **overrides: object) -> DescriptionFormula:
        defaults: dict[str, object] = dict(
            field_code="MOBILE_DESC",
            class_code="FITTINGS",
            formula_version="1",
            slots=(AttributeSlot(attribute_code="MANUFACTURER_NAME"),),
            separator=", ",
            casing=Casing.AS_IS,
        )
        defaults.update(overrides)
        return DescriptionFormula(**defaults)  # type: ignore[arg-type]

    def test_valid_formula_constructs(self) -> None:
        f = self._formula()
        assert f.field_code == "MOBILE_DESC"

    def test_blank_field_code_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            self._formula(field_code=" ")

    def test_blank_class_code_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            self._formula(class_code="")

    def test_empty_slots_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            self._formula(slots=())


def test_description_field_constraint_is_frozen() -> None:
    c = DescriptionFieldConstraint(
        field_code="INVOICE_DESC", max_length=40, min_length=None, required_casing=Casing.UPPER
    )
    with pytest.raises(AttributeError):
        c.max_length = 50  # type: ignore[misc]
