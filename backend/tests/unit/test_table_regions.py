"""Tests for `domain/prs/table_regions.py` — table/row/cell tree construction from a
hand-built `RawTable`, independent of any PDF library."""

from __future__ import annotations

from openspec.domain.model.document import RegionType
from openspec.domain.prs.table_regions import (
    RawTable,
    RawTableCell,
    RawTableRow,
    build_table_regions,
)

_TABLE = RawTable(
    bbox=(50.0, 100.0, 550.0, 200.0),
    rows=(
        RawTableRow(
            bbox=(50.0, 100.0, 550.0, 130.0),
            cells=(
                RawTableCell(bbox=(50.0, 100.0, 300.0, 130.0), text="70-104-01"),
                RawTableCell(bbox=(300.0, 100.0, 550.0, 130.0), text="600 WOG"),
            ),
        ),
        RawTableRow(
            bbox=(50.0, 130.0, 550.0, 160.0),
            cells=(
                RawTableCell(bbox=(50.0, 130.0, 300.0, 160.0), text="70-105-01"),
                RawTableCell(bbox=(300.0, 130.0, 550.0, 160.0), text="150 WOG"),
            ),
        ),
    ),
)


def test_produces_one_table_plus_row_and_cell_regions() -> None:
    regions = build_table_regions(
        document_version_id="docver_1", page=2, table_index=1, table=_TABLE
    )
    # 1 table + 2 rows + 4 cells
    assert len(regions) == 7
    kinds = [r.region_type for r in regions]
    assert kinds.count(RegionType.TABLE) == 1
    assert kinds.count(RegionType.ROW) == 2
    assert kinds.count(RegionType.CELL) == 4


def test_paths_and_parent_linkage_are_stable() -> None:
    regions = build_table_regions(
        document_version_id="docver_1", page=2, table_index=1, table=_TABLE
    )
    by_path = {r.path: r for r in regions}
    table_region = by_path["table:1"]
    row1 = by_path["table:1/row:1"]
    cell1 = by_path["table:1/row:1/cell:1"]
    assert row1.parent_region_id == table_region.id
    assert cell1.parent_region_id == row1.id
    assert cell1.text == "70-104-01"


def test_row_text_is_joined_from_cells() -> None:
    regions = build_table_regions(
        document_version_id="docver_1", page=2, table_index=1, table=_TABLE
    )
    row1 = next(r for r in regions if r.path == "table:1/row:1")
    assert row1.text == "70-104-01 600 WOG"


def test_ids_are_scoped_by_document_version() -> None:
    regions = build_table_regions(
        document_version_id="docver_1", page=2, table_index=1, table=_TABLE
    )
    assert all(r.id.startswith("docver_1/") for r in regions)


def test_second_table_index_does_not_collide_with_first() -> None:
    regions_1 = build_table_regions(
        document_version_id="docver_1", page=2, table_index=1, table=_TABLE
    )
    regions_2 = build_table_regions(
        document_version_id="docver_1", page=3, table_index=2, table=_TABLE
    )
    ids_1 = {r.id for r in regions_1}
    ids_2 = {r.id for r in regions_2}
    assert ids_1.isdisjoint(ids_2)
