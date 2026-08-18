"""Tests for `domain/prs/region_path.py`."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.document import RegionType
from openspec.domain.prs.region_path import build_region_path, parent_path, parse_region_path


class TestBuildRegionPath:
    def test_single_segment(self) -> None:
        assert build_region_path((RegionType.TABLE, 1)) == "table:1"

    def test_nested_segments(self) -> None:
        path = build_region_path((RegionType.TABLE, 1), (RegionType.ROW, 14), (RegionType.CELL, 3))
        assert path == "table:1/row:14/cell:3"

    def test_empty_segments_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            build_region_path()

    def test_non_positive_index_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            build_region_path((RegionType.TABLE, 0))

    def test_out_of_order_nesting_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            build_region_path((RegionType.ROW, 1), (RegionType.TABLE, 1))

    def test_page_cannot_appear_in_nested_path(self) -> None:
        with pytest.raises(InvariantViolation):
            build_region_path((RegionType.PAGE, 1))


class TestParseRegionPath:
    def test_round_trips(self) -> None:
        original = ((RegionType.TABLE, 1), (RegionType.ROW, 14), (RegionType.CELL, 3))
        path = build_region_path(*original)
        assert parse_region_path(path) == original

    def test_empty_path_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            parse_region_path("")

    def test_unknown_kind_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            parse_region_path("paragraph:1")

    def test_non_integer_index_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            parse_region_path("table:x")

    def test_zero_index_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            parse_region_path("table:0")


class TestParentPath:
    def test_top_level_has_no_parent(self) -> None:
        assert parent_path("table:1") is None

    def test_nested_parent(self) -> None:
        assert parent_path("table:1/row:14/cell:3") == "table:1/row:14"
        assert parent_path("table:1/row:14") == "table:1"
