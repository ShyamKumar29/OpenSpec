"""Structural validation for a projected Delivery Format row (UH7 —
docs/16-unilog-alignment.md UH7). Reuses `domain.dsc.validation.ValidationResult`'s
pass/fail shape (a generic rule-ID/passed/detail triple, not DSC-specific
logic) rather than inventing a parallel one.

Checks exact column count/order, `ATTRIBUTE_LABEL/VALUE/UOM` triple
consistency, `ITEM_FEATURES_n` duplication, and description field
character-limit/casing compliance (`domain/dsc/validation.py`, UH5) for
whichever description columns are actually populated. Never invents a value
to make a check pass — a validation failure is reported, not silently fixed.
"""

from __future__ import annotations

from openspec.domain.dsc.validation import ValidationResult, run_field_validation
from openspec.infrastructure.reference_data.delivery_format import DeliveryFormatSchema

_DESCRIPTION_COLUMNS = ("INVOICE_DESC", "MOBILE_DESC", "SHORT_DESC", "LONG_DESC1")


def validate_column_count(row: dict[str, str], schema: DeliveryFormatSchema) -> ValidationResult:
    expected = len(schema.columns)
    passed = len(row) == expected
    return ValidationResult(
        rule_id="EXPORT-COLUMN-COUNT", passed=passed, detail=f"got={len(row)}, expected={expected}"
    )


def validate_column_names_match(
    row: dict[str, str], schema: DeliveryFormatSchema
) -> ValidationResult:
    expected = set(schema.column_names())
    passed = set(row.keys()) == expected
    missing = expected - set(row.keys())
    extra = set(row.keys()) - expected
    return ValidationResult(
        rule_id="EXPORT-COLUMN-NAMES",
        passed=passed,
        detail=f"missing={sorted(missing)}, extra={sorted(extra)}",
    )


def validate_column_order(row: dict[str, str], schema: DeliveryFormatSchema) -> ValidationResult:
    passed = tuple(row.keys()) == schema.column_names()
    return ValidationResult(rule_id="EXPORT-COLUMN-ORDER", passed=passed, detail="")


def validate_attribute_slot_consistency(
    row: dict[str, str], schema: DeliveryFormatSchema
) -> tuple[ValidationResult, ...]:
    """For any populated `ATTRIBUTE_LABEL n` / `ATTRIBUTE_UOM n`, the
    corresponding `ATTRIBUTE_VALUE n` must also be populated — a label or
    unit with no value is a structurally incomplete triple. Slots that are
    entirely empty (the honest state of every real slot today, per the
    module docstring in `delivery_format_projection.py`) are skipped, not
    scored as a failure."""
    results = []
    for slot in schema.attribute_slots():
        label = row.get(slot.label_column, "")
        value = row.get(slot.value_column, "")
        uom = row.get(slot.uom_column, "")
        if not label and not value and not uom:
            continue
        passed = bool(value) or (not label and not uom)
        results.append(
            ValidationResult(
                rule_id=f"EXPORT-SLOT-{slot.index}-VALUE-REQUIRED",
                passed=passed,
                detail=f"label={label!r}, value={value!r}, uom={uom!r}",
            )
        )
    return tuple(results)


def validate_no_duplicate_item_features(
    row: dict[str, str], schema: DeliveryFormatSchema
) -> ValidationResult:
    values = [row.get(c, "") for c in schema.item_features_columns()]
    non_empty = [v for v in values if v]
    passed = len(non_empty) == len(set(non_empty))
    return ValidationResult(
        rule_id="EXPORT-ITEM-FEATURES-NO-DUPLICATES",
        passed=passed,
        detail=f"non_empty_count={len(non_empty)}, distinct_count={len(set(non_empty))}",
    )


def validate_description_fields(row: dict[str, str]) -> tuple[ValidationResult, ...]:
    """Only runs `DSC`'s confirmed constraints (UH5) for description columns
    that are actually populated — an empty column (the honest state today,
    since no formulas are configured) is not scored against a length
    constraint meant for real content."""
    results: list[ValidationResult] = []
    for column in _DESCRIPTION_COLUMNS:
        text = row.get(column, "")
        if not text:
            continue
        results.extend(run_field_validation(text, column))
    return tuple(results)


def validate_delivery_format_row(
    row: dict[str, str], schema: DeliveryFormatSchema
) -> tuple[ValidationResult, ...]:
    return (
        validate_column_count(row, schema),
        validate_column_names_match(row, schema),
        validate_column_order(row, schema),
        *validate_attribute_slot_consistency(row, schema),
        validate_no_duplicate_item_features(row, schema),
        *validate_description_fields(row),
    )
