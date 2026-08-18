"""Pure table -> region-tree construction (M2 brief §4/§5: "PRS should produce
structured source material"; "table -> row -> cell"). Deliberately decoupled from
any PDF library: `infrastructure/parsing/pdfplumber_parser.py` converts whatever
`pdfplumber.Table` gives it into the plain `RawTable` shape below and calls
`build_table_regions` — so the tree-building logic (ids, paths, parent linkage) is
unit-testable with a hand-built `RawTable`, independent of whether pdfplumber's own
table-detection heuristics fire on any particular fixture.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.document import DocumentRegion, RegionType
from openspec.domain.prs.region_path import build_region_path


@dataclass(frozen=True, slots=True)
class RawTableCell:
    bbox: tuple[float, float, float, float]
    text: str | None


@dataclass(frozen=True, slots=True)
class RawTableRow:
    bbox: tuple[float, float, float, float]
    cells: tuple[RawTableCell, ...]


@dataclass(frozen=True, slots=True)
class RawTable:
    bbox: tuple[float, float, float, float]
    rows: tuple[RawTableRow, ...]


def build_table_regions(
    *, document_version_id: str, page: int, table_index: int, table: RawTable
) -> tuple[DocumentRegion, ...]:
    """`table_index` is 1-based (this document version's Nth table, in document
    order). Returns the table region followed by every row and cell region,
    parent-linked table -> row -> cell, each with a stable `path`
    (`domain/prs/region_path.py`) and a globally-unique `id` scoped by
    `document_version_id`."""
    table_id = f"{document_version_id}/{build_region_path((RegionType.TABLE, table_index))}"
    regions: list[DocumentRegion] = [
        DocumentRegion(
            id=table_id,
            region_type=RegionType.TABLE,
            page=page,
            bbox=table.bbox,
            path=build_region_path((RegionType.TABLE, table_index)),
            text=None,
            parent_region_id=None,
        )
    ]
    for row_index, row in enumerate(table.rows, start=1):
        row_path = build_region_path((RegionType.TABLE, table_index), (RegionType.ROW, row_index))
        row_id = f"{document_version_id}/{row_path}"
        row_text = " ".join(c.text for c in row.cells if c.text) or None
        regions.append(
            DocumentRegion(
                id=row_id,
                region_type=RegionType.ROW,
                page=page,
                bbox=row.bbox,
                path=row_path,
                text=row_text,
                parent_region_id=table_id,
            )
        )
        for cell_index, cell in enumerate(row.cells, start=1):
            cell_path = build_region_path(
                (RegionType.TABLE, table_index),
                (RegionType.ROW, row_index),
                (RegionType.CELL, cell_index),
            )
            regions.append(
                DocumentRegion(
                    id=f"{document_version_id}/{cell_path}",
                    region_type=RegionType.CELL,
                    page=page,
                    bbox=cell.bbox,
                    path=cell_path,
                    text=cell.text,
                    parent_region_id=row_id,
                )
            )
    return tuple(regions)
