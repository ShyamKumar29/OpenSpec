"""`PdfplumberParser` — the real `DocumentParser` adapter (ADR-0005: "`pdfplumber`
for text, tables, and character-level coordinates... PyMuPDF is rejected on
licensing grounds"). Genuinely parses PDF bytes end to end — verified in this
session against a hand-built, deterministic single-page PDF fixture
(`tests/fixtures/pdf/minimal_pdf.py`; **real code exercised against a minimal test
PDF, not a mock** — the M2 brief's "real corpus validation BLOCKED" applies to the
150+ manufacturer-document corpus this environment doesn't have, not to whether
this adapter itself works against real PDF bytes).

**Region tree:** one `page` region per page, one `block` region per page holding its
full extracted text (this parser does not attempt line/paragraph segmentation — the
region vocabulary `docs/api.md` defines stops at `page/table/row/cell/block`, per
`domain/model/document.py`'s own docstring), and a `table/row/cell` subtree per
table `pdfplumber.Page.find_tables()` detects, built by the pure
`domain/prs/table_regions.py::build_table_regions`.

**Failure handling:** a corrupt or non-PDF byte string is a `ParseFailed` value, not
a raised exception (M2 brief: "Represent failures explicitly. Do not silently treat
a parse failure as an empty document."). The one broad `except Exception` below is
deliberate: this is a genuine external-input boundary (arbitrary third-party PDF
bytes), and `pdfminer`'s failure modes span an exception hierarchy impractical to
enumerate exhaustively — the same justification `docs/05-backend.md` §8 gives for
the worker's single documented broad catch, applied here to the parser boundary.
"""

from __future__ import annotations

import io
from typing import Any

import pdfplumber

from openspec.domain.model.document import DocumentRegion, ParseArtifact, RegionType
from openspec.domain.prs.parse_result import (
    ParseFailed,
    ParseFailureReason,
    ParseOutcome,
    ParseSucceeded,
)
from openspec.domain.prs.table_regions import (
    RawTable,
    RawTableCell,
    RawTableRow,
    build_table_regions,
)

PARSER_NAME = "pdfplumber"
PARSER_VERSION = pdfplumber.__version__


def _page_region(
    document_version_id: str, page_no: int, width: float, height: float
) -> DocumentRegion:
    return DocumentRegion(
        id=f"{document_version_id}/page:{page_no}",
        region_type=RegionType.PAGE,
        page=page_no,
        bbox=(0.0, 0.0, float(width), float(height)),
        path=f"page:{page_no}",
        text=None,
        parent_region_id=None,
    )


def _block_region(
    document_version_id: str, page_no: int, text: str, words: list[dict[str, Any]]
) -> DocumentRegion | None:
    """One region covering the union of every word's bbox on the page — a
    document-level "block" of running text, not a per-paragraph segmentation this
    parser doesn't attempt (see module docstring)."""
    if not words:
        return None
    x0 = min(float(w["x0"]) for w in words)
    x1 = max(float(w["x1"]) for w in words)
    top = min(float(w["top"]) for w in words)
    bottom = max(float(w["bottom"]) for w in words)
    return DocumentRegion(
        id=f"{document_version_id}/page:{page_no}/block:1",
        region_type=RegionType.BLOCK,
        page=page_no,
        bbox=(x0, top, x1, bottom),
        path="block:1",
        text=text,
        parent_region_id=f"{document_version_id}/page:{page_no}",
    )


def _table_regions_for_page(
    document_version_id: str, page_no: int, table_index: int, pdf_table: pdfplumber.table.Table
) -> tuple[DocumentRegion, ...]:
    """Converts a `pdfplumber.table.Table` into the library-independent `RawTable`
    shape and hands it to the pure builder. `Table.rows[i].cells[j]` is a bbox tuple
    or `None` (an absent/merged cell); `Table.extract()` returns the row/cell-aligned
    text matrix — paired here by position, the same alignment pdfplumber itself uses
    internally (`Table.extract`'s own implementation iterates `self.rows` and each
    row's `cells` in lockstep)."""
    rows = pdf_table.rows
    text_matrix = pdf_table.extract()
    raw_rows: list[RawTableRow] = []
    for row, row_texts in zip(rows, text_matrix, strict=False):
        cells: list[RawTableCell] = []
        for cell_bbox, cell_text in zip(row.cells, row_texts, strict=False):
            if cell_bbox is None:
                continue  # an absent/merged cell — pdfplumber reports no bbox for it
            x0, top, x1, bottom = cell_bbox
            if x1 <= x0 or bottom <= top:
                continue  # a genuinely zero-area cell (malformed table); skip rather
                # than construct a region the domain model would reject
            cells.append(RawTableCell(bbox=(x0, top, x1, bottom), text=cell_text))
        if cells:
            raw_rows.append(RawTableRow(bbox=row.bbox, cells=tuple(cells)))
    if not raw_rows:
        return ()
    raw_table = RawTable(bbox=pdf_table.bbox, rows=tuple(raw_rows))
    return build_table_regions(
        document_version_id=document_version_id,
        page=page_no,
        table_index=table_index,
        table=raw_table,
    )


class PdfplumberParser:
    """The `DocumentParser` protocol's real implementation
    (`application/ports/parser.py`)."""

    parser_name = PARSER_NAME
    parser_version = PARSER_VERSION

    def parse(self, *, document_version_id: str, content: bytes) -> ParseOutcome:
        if not content:
            return ParseFailed(ParseFailureReason.EMPTY_DOCUMENT, "zero-byte upload")
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages = pdf.pages
                if not pages:
                    return ParseFailed(ParseFailureReason.EMPTY_DOCUMENT, "PDF has zero pages")
                regions: list[DocumentRegion] = []
                has_text_layer = False
                for page in pages:
                    page_no = page.page_number
                    regions.append(
                        _page_region(document_version_id, page_no, page.width, page.height)
                    )
                    text = page.extract_text() or ""
                    if text.strip():
                        has_text_layer = True
                    words = page.extract_words()
                    block = _block_region(document_version_id, page_no, text, list(words))
                    if block is not None:
                        regions.append(block)
                    for table_index, table in enumerate(page.find_tables(), start=1):
                        regions.extend(
                            _table_regions_for_page(
                                document_version_id, page_no, table_index, table
                            )
                        )
        except Exception as exc:  # noqa: BLE001 — see module docstring.
            return ParseFailed(ParseFailureReason.CORRUPT_FILE, str(exc))

        artifact = ParseArtifact(
            id=f"{document_version_id}/parse/{PARSER_NAME}/{PARSER_VERSION}",
            document_version_id=document_version_id,
            parser_name=PARSER_NAME,
            parser_version=PARSER_VERSION,
            parse_quality=1.0 if has_text_layer else None,
            has_text_layer=has_text_layer,
            used_ocr=False,
            regions=tuple(regions),
        )
        return ParseSucceeded(artifact=artifact)
