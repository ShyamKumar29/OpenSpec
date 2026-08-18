"""UH0 — Sample Input dataset loading, placeholder detection, and validation
(`docs/16-unilog-alignment.md` UH0 §2/§6/§11)."""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from openspec.infrastructure.reference_data.errors import (
    ReferenceDataMalformedRow,
    ReferenceDataMissing,
    ReferenceDataSchemaDrift,
)
from openspec.infrastructure.reference_data.sample_input import (
    EXPECTED_COLUMNS,
    load_sample_input_rows,
)
from openspec.infrastructure.reference_data.stats import compute_sample_input_stats


class TestLoads:
    def test_loads_1000_rows(self) -> None:
        rows = load_sample_input_rows()
        assert len(rows) == 1000

    def test_expected_columns(self) -> None:
        assert EXPECTED_COLUMNS == (
            "Mfg_Part_Num",
            "Part_Desc",
            "E1_Brand",
            "Unilog_Brand",
            "DIB_Brand",
            "Part_Manuf",
        )

    def test_row_numbers_are_1_indexed_and_contiguous(self) -> None:
        rows = load_sample_input_rows()
        assert [r.row_number for r in rows[:3]] == [1, 2, 3]
        assert rows[-1].row_number == 1000

    def test_source_values_preserved_verbatim(self) -> None:
        rows = load_sample_input_rows()
        first = rows[0]
        assert first.mfg_part_num == "DCB518ASTS06G"
        assert first.part_manuf == "Freud Inc (2435)"


class TestPlaceholderDetection:
    """Placeholders are flagged, never stripped — the raw value always survives
    (UH0 brief §6), even though the field is flagged as a known placeholder."""

    def test_known_brand_placeholders_are_flagged_but_not_removed(self) -> None:
        rows = load_sample_input_rows()
        placeholder_rows = [r for r in rows if r.e1_brand_is_placeholder]
        assert len(placeholder_rows) > 0
        for r in placeholder_rows:
            assert r.e1_brand == "-- Unbranded --"  # value retained, not blanked

    def test_unilog_brand_is_placeholder_on_every_row(self) -> None:
        # Verified fact about this specific file (see resources README), not an
        # assumption — this column carries no signal in the supplied dataset.
        rows = load_sample_input_rows()
        assert all(r.unilog_brand_is_placeholder for r in rows)

    def test_part_manuf_dash_placeholder_flagged(self) -> None:
        rows = load_sample_input_rows()
        dash_rows = [r for r in rows if r.part_manuf == "-"]
        assert len(dash_rows) > 0
        assert all(r.part_manuf_is_placeholder for r in dash_rows)


class TestStats:
    def test_stats_match_verified_counts(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_sample_input_stats(rows)
        assert stats.row_count == 1000
        assert stats.unique_mfg_part_num_count == 999
        assert stats.duplicate_mfg_part_num_count == 1
        assert stats.duplicate_mfg_part_nums == ("AVM6EV",)
        assert stats.unilog_brand_placeholder_count == 1000


class TestDeterminism:
    def test_loading_twice_produces_equal_rows(self) -> None:
        assert load_sample_input_rows() == load_sample_input_rows()


class TestFailureBehavior:
    def test_missing_file_raises_reference_data_missing(self, tmp_path: Path) -> None:
        with pytest.raises(ReferenceDataMissing):
            load_sample_input_rows(tmp_path / "does_not_exist.csv")

    def test_wrong_header_is_a_hard_failure(self, tmp_path: Path) -> None:
        bad = tmp_path / "sample_input.csv"
        with bad.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Mfg_Part_Num", "Part_Desc"])  # missing 4 columns
            writer.writerow(["ABC", "desc"])
        with pytest.raises(ReferenceDataSchemaDrift):
            load_sample_input_rows(bad)

    def test_wrong_field_count_row_is_a_hard_failure(self, tmp_path: Path) -> None:
        bad = tmp_path / "sample_input.csv"
        with bad.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(EXPECTED_COLUMNS)
            writer.writerow(["ABC", "desc", "-- Unbranded --"])  # too few fields
        with pytest.raises(ReferenceDataMalformedRow):
            load_sample_input_rows(bad)

    def test_empty_identifier_is_a_hard_failure(self, tmp_path: Path) -> None:
        bad = tmp_path / "sample_input.csv"
        with bad.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(EXPECTED_COLUMNS)
            writer.writerow(
                ["", "desc", "-- Unbranded --", "-- No Unilog Brand --", "-- No DIB Brand --", "-"]
            )
        with pytest.raises(ReferenceDataMalformedRow, match="empty Mfg_Part_Num"):
            load_sample_input_rows(bad)
