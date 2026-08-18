"""Description-formula value objects (`DSC`, UH5 — ADR-0013,
docs/16-unilog-alignment.md UH5).

A `DescriptionFormula` is a declarative, versioned recipe for building one
Delivery Format description field (`INVOICE_DESC`, `MOBILE_DESC`,
`SHORT_DESC`, `LONG_DESC1`, one `ITEM_FEATURES_n`) for one class, stored as
YAML in `backend/resources/description-formulas/` (ADR-0013's decision,
verbatim path). It never contains a fact — only which already-accepted
attribute to read and how to render it — so a formula file is reviewable
config, not a place fabrication could hide (mirrors how `resources/taxonomy/`
and `resources/rules/` are declarative, per CLAUDE.md's Conventions table).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation


class Casing(StrEnum):
    """How a rendered slot or the assembled field is cased. `AS_IS` performs
    no transform — the safest default, since guessing a casing transform on
    a value we didn't verify the case of would itself be a small fabrication
    of form, if not of fact."""

    AS_IS = "AS_IS"
    UPPER = "UPPER"
    TITLE = "TITLE"


@dataclass(frozen=True, slots=True)
class AttributeSlot:
    """Renders one already-accepted attribute's `value_display`. `casing`
    applies only to this slot's own text, independent of the formula's
    overall `casing` (docs/adr/ADR-0013's `INVOICE_DESC` example is
    all-caps end to end, but a formula composing from multiple sources may
    need per-slot control later)."""

    attribute_code: str
    casing: Casing = Casing.AS_IS

    def __post_init__(self) -> None:
        if not self.attribute_code.strip():
            raise InvariantViolation("AttributeSlot.attribute_code must be non-blank")


@dataclass(frozen=True, slots=True)
class LiteralSlot:
    """A fixed piece of text the formula itself supplies (e.g. a connector
    word) — never a product fact, so it carries no evidence and needs none;
    it is not an `AttributeValue` and never becomes one."""

    text: str

    def __post_init__(self) -> None:
        if not self.text:
            raise InvariantViolation("LiteralSlot.text must be non-empty")


FormulaSlot = AttributeSlot | LiteralSlot


@dataclass(frozen=True, slots=True)
class DescriptionFormula:
    """One field's construction recipe for one class. `separator` joins the
    rendered, non-omitted slots (ADR-0013: "An attribute missing from the
    record is simply omitted from the formula's slot — never inferred to
    fill a template gap")."""

    field_code: str
    class_code: str
    formula_version: str
    slots: tuple[FormulaSlot, ...]
    separator: str
    casing: Casing = Casing.AS_IS

    def __post_init__(self) -> None:
        if not self.field_code.strip():
            raise InvariantViolation("DescriptionFormula.field_code must be non-blank")
        if not self.class_code.strip():
            raise InvariantViolation("DescriptionFormula.class_code must be non-blank")
        if not self.slots:
            raise InvariantViolation("DescriptionFormula.slots must be non-empty")


@dataclass(frozen=True, slots=True)
class DescriptionFieldConstraint:
    """A confirmed, documented constraint for one Delivery Format description
    field — max length and/or required casing. Only populated for fields
    this project has an actual documented source for (ADR-0013's own worked
    example: `INVOICE_DESC` ≤40 char CAPS, `MOBILE_DESC` 60–80 char);
    `SHORT_DESC`/`LONG_DESC1`/`ITEM_FEATURES_n` have no documented numeric
    limit anywhere in this environment and are deliberately left
    unconstrained rather than guessed."""

    field_code: str
    max_length: int | None
    min_length: int | None
    required_casing: Casing | None
