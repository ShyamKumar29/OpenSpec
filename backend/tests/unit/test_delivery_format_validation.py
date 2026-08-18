"""Tests for `infrastructure/export/delivery_format_validation.py` (UH7)."""

from __future__ import annotations

from openspec.infrastructure.export.delivery_format_validation import (
    validate_attribute_slot_consistency,
    validate_column_count,
    validate_column_names_match,
    validate_column_order,
    validate_delivery_format_row,
    validate_description_fields,
    validate_no_duplicate_item_features,
)
from openspec.infrastructure.reference_data.delivery_format import load_delivery_format_schema

_SCHEMA = load_delivery_format_schema()


def _empty_row() -> dict[str, str]:
    return dict.fromkeys(_SCHEMA.column_names(), "")


class TestValidateColumnCount:
    def test_correct_count_passes(self) -> None:
        assert validate_column_count(_empty_row(), _SCHEMA).passed

    def test_missing_column_fails(self) -> None:
        row = _empty_row()
        del row[_SCHEMA.column_names()[0]]
        assert not validate_column_count(row, _SCHEMA).passed


class TestValidateColumnNamesMatch:
    def test_exact_match_passes(self) -> None:
        assert validate_column_names_match(_empty_row(), _SCHEMA).passed

    def test_unexpected_extra_column_fails(self) -> None:
        row = _empty_row()
        row["NOT_A_REAL_COLUMN"] = "x"
        assert not validate_column_names_match(row, _SCHEMA).passed


class TestValidateColumnOrder:
    def test_schema_order_passes(self) -> None:
        assert validate_column_order(_empty_row(), _SCHEMA).passed

    def test_shuffled_order_fails(self) -> None:
        names = list(_SCHEMA.column_names())
        names[0], names[1] = names[1], names[0]
        row = {name: "" for name in names}
        assert not validate_column_order(row, _SCHEMA).passed


class TestValidateAttributeSlotConsistency:
    def test_fully_empty_slots_are_skipped_not_failed(self) -> None:
        results = validate_attribute_slot_consistency(_empty_row(), _SCHEMA)
        assert results == ()

    def test_value_present_passes(self) -> None:
        row = _empty_row()
        slot = _SCHEMA.attribute_slots()[0]
        row[slot.label_column] = "Connection Type"
        row[slot.value_column] = "SOLDER"
        row[slot.uom_column] = ""
        results = validate_attribute_slot_consistency(row, _SCHEMA)
        assert len(results) == 1
        assert results[0].passed

    def test_uom_without_value_fails(self) -> None:
        row = _empty_row()
        slot = _SCHEMA.attribute_slots()[0]
        row[slot.uom_column] = "in"
        results = validate_attribute_slot_consistency(row, _SCHEMA)
        assert len(results) == 1
        assert not results[0].passed

    def test_label_without_value_fails(self) -> None:
        row = _empty_row()
        slot = _SCHEMA.attribute_slots()[0]
        row[slot.label_column] = "Connection Type"
        results = validate_attribute_slot_consistency(row, _SCHEMA)
        assert len(results) == 1
        assert not results[0].passed


class TestValidateNoDuplicateItemFeatures:
    def test_all_empty_passes(self) -> None:
        assert validate_no_duplicate_item_features(_empty_row(), _SCHEMA).passed

    def test_distinct_values_pass(self) -> None:
        row = _empty_row()
        cols = _SCHEMA.item_features_columns()
        row[cols[0]] = "Feature A"
        row[cols[1]] = "Feature B"
        assert validate_no_duplicate_item_features(row, _SCHEMA).passed

    def test_duplicate_values_fail(self) -> None:
        row = _empty_row()
        cols = _SCHEMA.item_features_columns()
        row[cols[0]] = "Feature A"
        row[cols[1]] = "Feature A"
        assert not validate_no_duplicate_item_features(row, _SCHEMA).passed


class TestValidateDescriptionFields:
    def test_empty_description_columns_produce_no_results(self) -> None:
        assert validate_description_fields(_empty_row()) == ()

    def test_valid_invoice_desc_passes(self) -> None:
        row = _empty_row()
        row["INVOICE_DESC"] = "WIDGET 1/2 IN SOLDER"
        results = validate_description_fields(row)
        assert results
        assert all(r.passed for r in results)

    def test_lowercase_invoice_desc_fails_casing(self) -> None:
        row = _empty_row()
        row["INVOICE_DESC"] = "widget 1/2 in solder"
        results = validate_description_fields(row)
        assert any(r.rule_id == "DSC-CASING" and not r.passed for r in results)

    def test_over_length_invoice_desc_fails(self) -> None:
        row = _empty_row()
        row["INVOICE_DESC"] = "X" * 41
        results = validate_description_fields(row)
        assert any(r.rule_id == "DSC-MAX-LENGTH" and not r.passed for r in results)


def test_validate_delivery_format_row_aggregates_all_checks() -> None:
    results = validate_delivery_format_row(_empty_row(), _SCHEMA)
    rule_ids = {r.rule_id for r in results}
    assert "EXPORT-COLUMN-COUNT" in rule_ids
    assert "EXPORT-COLUMN-NAMES" in rule_ids
    assert "EXPORT-COLUMN-ORDER" in rule_ids
    assert "EXPORT-ITEM-FEATURES-NO-DUPLICATES" in rule_ids
    assert all(r.passed for r in results)
