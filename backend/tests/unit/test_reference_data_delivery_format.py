"""UH0 — Delivery Format schema loading and stability guards
(`docs/16-unilog-alignment.md` UH0 §3/§9)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from openspec.infrastructure.reference_data.delivery_format import (
    DEFAULT_DELIVERY_FORMAT_PATH,
    load_delivery_format_rows,
    load_delivery_format_schema,
)
from openspec.infrastructure.reference_data.errors import (
    ReferenceDataMissing,
    ReferenceDataSchemaDrift,
)

SNAPSHOT_PATH = DEFAULT_DELIVERY_FORMAT_PATH.with_name("delivery_format.schema.json")


class TestSchemaLoads:
    def test_loads_252_columns(self) -> None:
        schema = load_delivery_format_schema()
        assert len(schema.columns) == 252

    def test_column_order_is_preserved_from_the_source_header(self) -> None:
        schema = load_delivery_format_schema()
        assert schema.columns[0].name == "MFR URL"
        assert schema.columns[6].name == "PART_NUMBER"
        assert schema.columns[-1].name == "Actual Image (Yes/No)"

    def test_no_duplicate_column_names(self) -> None:
        schema = load_delivery_format_schema()
        names = schema.column_names()
        assert len(names) == len(set(names))

    def test_attribute_slots_are_50_contiguous_label_value_uom_triples(self) -> None:
        schema = load_delivery_format_schema()
        slots = schema.attribute_slots()
        assert len(slots) == 50
        assert [s.index for s in slots] == list(range(1, 51))
        assert slots[6].label_column == "ATTRIBUTE_LABEL 7"
        assert slots[6].value_column == "ATTRIBUTE_VALUE 7"
        assert slots[6].uom_column == "ATTRIBUTE_UOM 7"

    def test_item_features_are_20_ordered_columns(self) -> None:
        schema = load_delivery_format_schema()
        features = schema.item_features_columns()
        assert features == tuple(f"ITEM_FEATURES_{n}" for n in range(1, 21))


class TestSchemaStabilityAgainstSnapshot:
    """`scripts/generate_delivery_format_snapshot.py` freezes the schema shape as a
    resource; this test is the guard that makes an accidental header change to
    `delivery_format.csv` fail the build instead of drifting silently."""

    def test_live_schema_matches_frozen_snapshot(self) -> None:
        schema = load_delivery_format_schema()
        snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        assert list(schema.column_names()) == snapshot["columns"]
        assert len(schema.columns) == snapshot["column_count"]
        assert len(schema.attribute_slots()) == snapshot["attribute_slot_count"]
        assert len(schema.item_features_columns()) == snapshot["item_features_count"]


class TestExampleRows:
    def test_two_example_rows_are_present(self) -> None:
        rows = load_delivery_format_rows()
        assert len(rows) == 2

    def test_rows_preserve_source_values_verbatim(self) -> None:
        rows = load_delivery_format_rows()
        # ® preserved, not stripped (CLAUDE.md: never silently strip ®/™ symbols).
        assert rows[0]["BRAND_NAME"] == "FRIGIDAIRE®"
        assert rows[0]["MANUFACTURER_NAME"] == "Rheem Manufacturing"
        assert rows[1]["MANUFACTURER_PART_NUMBER"] == "WDTS7024RZ"


class TestDeterminism:
    def test_loading_twice_produces_equal_schema(self) -> None:
        assert load_delivery_format_schema() == load_delivery_format_schema()

    def test_loading_twice_produces_equal_rows(self) -> None:
        assert load_delivery_format_rows() == load_delivery_format_rows()


class TestFailureBehavior:
    def test_missing_file_raises_reference_data_missing(self, tmp_path: Path) -> None:
        with pytest.raises(ReferenceDataMissing):
            load_delivery_format_schema(tmp_path / "does_not_exist.csv")

    def test_duplicate_column_name_is_a_hard_failure(self, tmp_path: Path) -> None:
        bad = tmp_path / "delivery_format.csv"
        with bad.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["PART_NUMBER", "PART_NUMBER", "Classpath"])
            writer.writerow(["1", "1", "Fittings"])
        with pytest.raises(ReferenceDataSchemaDrift, match="duplicate"):
            load_delivery_format_schema(bad)

    def test_incomplete_attribute_slot_triple_is_a_hard_failure(self, tmp_path: Path) -> None:
        bad = tmp_path / "delivery_format.csv"
        with bad.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            # ATTRIBUTE_UOM 1 missing — an incomplete triple.
            writer.writerow(["ATTRIBUTE_LABEL 1", "ATTRIBUTE_VALUE 1"])
            writer.writerow(["Series", "Pro"])
        schema = load_delivery_format_schema(bad)
        with pytest.raises(ReferenceDataSchemaDrift, match="attribute slot"):
            schema.attribute_slots()
