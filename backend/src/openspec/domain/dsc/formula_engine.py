"""Formula assembly (`DSC`, UH5 — ADR-0013). Pure: given a
`DescriptionFormula` and a `{attribute_code: AttributeValue}` map, produces
the assembled text plus full traceability back to which `AttributeValueAsserted`s
were actually used.

**Only `ACCEPTED` values are composed in.** ADR-0013 says descriptions build
from "already verified/approved attribute values" — `NEEDS_REVIEW` has not
been approved by anyone yet, so a slot backed by one is treated exactly like
a missing attribute: omitted, never inferred (ADR-0013: "An attribute
missing from the record is simply omitted from the formula's slot — never
inferred to fill a template gap").
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.attribute import (
    AttributeValue,
    AttributeValueAsserted,
    AttributeValueStatus,
    is_unknown,
)
from openspec.domain.model.description import (
    AttributeSlot,
    Casing,
    DescriptionFormula,
    FormulaSlot,
    LiteralSlot,
)


@dataclass(frozen=True, slots=True)
class DescriptionBuildResult:
    field_code: str
    text: str
    source_attribute_values: tuple[AttributeValueAsserted, ...]
    omitted_attribute_codes: tuple[str, ...]


def _apply_casing(text: str, casing: Casing) -> str:
    if casing is Casing.UPPER:
        return text.upper()
    if casing is Casing.TITLE:
        return text.title()
    return text


def _render_slot(
    slot: FormulaSlot, values: dict[str, AttributeValue]
) -> tuple[str | None, AttributeValueAsserted | None]:
    if isinstance(slot, LiteralSlot):
        return slot.text, None
    value = values.get(slot.attribute_code)
    if value is None or is_unknown(value):
        return None, None
    assert isinstance(value, AttributeValueAsserted)  # narrowed by is_unknown above
    if value.status is not AttributeValueStatus.ACCEPTED:
        return None, None
    return _apply_casing(value.value_display, slot.casing), value


def build_description(
    formula: DescriptionFormula, values: dict[str, AttributeValue]
) -> DescriptionBuildResult:
    rendered_parts: list[str] = []
    sources: list[AttributeValueAsserted] = []
    omitted: list[str] = []
    for slot in formula.slots:
        rendered, source = _render_slot(slot, values)
        if rendered is None:
            if isinstance(slot, AttributeSlot):
                omitted.append(slot.attribute_code)
            continue
        rendered_parts.append(rendered)
        if source is not None:
            sources.append(source)

    text = _apply_casing(formula.separator.join(rendered_parts), formula.casing)
    return DescriptionBuildResult(
        field_code=formula.field_code,
        text=text,
        source_attribute_values=tuple(sources),
        omitted_attribute_codes=tuple(omitted),
    )
