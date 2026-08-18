"""Tests for `infrastructure/export/csv_target.py` (UH7, ADR-0010)."""

from __future__ import annotations

import csv
import io

from openspec.infrastructure.export.csv_target import CsvExportTarget


def test_writes_header_and_rows_in_column_order() -> None:
    target = CsvExportTarget()
    rows = ({"a": "1", "b": "2"}, {"a": "3", "b": "4"})
    output = target.export_rows(rows, ("b", "a"))
    text = output.decode("utf-8")
    parsed = list(csv.reader(io.StringIO(text)))
    assert parsed[0] == ["b", "a"]
    assert parsed[1] == ["2", "1"]
    assert parsed[2] == ["4", "3"]


def test_empty_rows_still_writes_header() -> None:
    target = CsvExportTarget()
    output = target.export_rows((), ("a", "b"))
    text = output.decode("utf-8")
    parsed = list(csv.reader(io.StringIO(text)))
    assert parsed == [["a", "b"]]


def test_values_with_commas_are_quoted() -> None:
    target = CsvExportTarget()
    output = target.export_rows(({"a": "1, comma"},), ("a",))
    assert b'"1, comma"' in output
