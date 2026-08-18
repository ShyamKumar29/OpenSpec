"""**Synthetic test fixture — never a substitute for the real manufacturer-document
corpus.** M2 brief §"DATA AVAILABILITY": the real PDF corpus is confirmed absent
from this environment (`docs/15-backend-implementation-status.md` §7 onward,
five-plus independent verification passes); these hand-built, deterministic PDFs
exist **only** to prove `PdfplumberParser`/`Pypdfium2Rasterizer` genuinely
parse/render real PDF byte structure, not to stand in for real-world parsing
accuracy. Every test that uses this fixture says so in its own name/docstring.

Built by hand (no `reportlab`/`fpdf` dependency) using the PDF spec's plainest
object/xref/trailer structure — verified in this session to open correctly under
both `pdfplumber` (text/word/table extraction) and `pypdfium2` (rasterisation).
"""

from __future__ import annotations

import io


def _text_stream(lines: tuple[str, ...], *, x: int, y_start: int, line_height: int) -> bytes:
    content_ops = ["BT", "/F1 24 Tf", f"{x} {y_start} Td"]
    for i, line in enumerate(lines):
        if i > 0:
            content_ops.append(f"0 {-line_height} Td")  # relative move to the next line
        escaped = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        content_ops.append(f"({escaped}) Tj")
    content_ops.append("ET")
    return "\n".join(content_ops).encode("latin-1")


def make_multi_page_pdf(
    pages: tuple[tuple[str, ...], ...],
    *,
    x: int = 100,
    y_start: int = 700,
    line_height: int = 30,
) -> bytes:
    """One 612x792pt (US Letter) page per entry in `pages`, each with its own lines
    drawn top-to-bottom in Helvetica 24pt. Shares one font resource across pages,
    the same as a real multi-page PDF produced by any ordinary writer."""
    if not pages:
        raise ValueError("make_multi_page_pdf requires at least one page")

    n_pages = len(pages)
    # Object numbering: 1=Catalog, 2=Pages, 3..3+n-1=Page objects,
    # 3+n=Font, 4+n..4+2n-1=Content streams.
    page_obj_ids = [3 + i for i in range(n_pages)]
    font_obj_id = 3 + n_pages
    content_obj_ids = [font_obj_id + 1 + i for i in range(n_pages)]

    kids = " ".join(f"{oid} 0 R" for oid in page_obj_ids)
    objs: dict[int, bytes] = {
        1: b"<</Type/Catalog/Pages 2 0 R>>",
        2: f"<</Type/Pages/Kids[{kids}]/Count {n_pages}>>".encode(),
        font_obj_id: b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    }
    for i, lines in enumerate(pages):
        page_oid = page_obj_ids[i]
        content_oid = content_obj_ids[i]
        objs[page_oid] = (
            f"<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 {font_obj_id} 0 R>>>>"
            f"/MediaBox[0 0 612 792]/Contents {content_oid} 0 R>>"
        ).encode()
        stream_content = _text_stream(lines, x=x, y_start=y_start, line_height=line_height)
        objs[content_oid] = (
            b"<</Length %d>>\nstream\n" % len(stream_content) + stream_content + b"\nendstream"
        )

    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    max_obj = max(objs)
    offsets: dict[int, int] = {}
    for oid in range(1, max_obj + 1):
        if oid not in objs:
            continue
        offsets[oid] = buf.tell()
        buf.write(f"{oid} 0 obj".encode() + b"\n" + objs[oid] + b"\nendobj\n")
    xref_offset = buf.tell()
    buf.write(f"xref\n0 {max_obj + 1}\n".encode())
    buf.write(b"0000000000 65535 f \n")
    for oid in range(1, max_obj + 1):
        off = offsets.get(oid, 0)
        flag = "n" if oid in offsets else "f"
        buf.write(f"{off:010d} 00000 {flag} \n".encode())
    buf.write(f"trailer<</Size {max_obj + 1}/Root 1 0 R>>\n".encode())
    buf.write(f"startxref\n{xref_offset}\n%%EOF".encode())
    return buf.getvalue()


def make_table_pdf(
    rows: tuple[tuple[str, ...], ...],
    *,
    origin_x: int = 100,
    origin_y: int = 500,
    row_height: int = 50,
    col_width: int = 150,
) -> bytes:
    """A single-page PDF with a real stroked grid (outer rect + internal vertical/
    horizontal rule lines) and one text label per cell — verified in this session
    to make `pdfplumber.Page.find_tables()` genuinely detect the grid as a table
    (its default 'lines' strategy reads real vector graphics, not just text
    alignment). `rows` must be rectangular (every row the same cell count)."""
    if not rows or not all(len(r) == len(rows[0]) for r in rows):
        raise ValueError("make_table_pdf requires at least one row, all the same width")
    n_rows = len(rows)
    n_cols = len(rows[0])
    width = n_cols * col_width
    height = n_rows * row_height
    top = origin_y + height

    ops = ["1 w", f"{origin_x} {origin_y} {width} {height} re S"]
    for c in range(1, n_cols):
        x = origin_x + c * col_width
        ops.append(f"{x} {origin_y} m {x} {top} l S")
    for r in range(1, n_rows):
        y = origin_y + r * row_height
        ops.append(f"{origin_x} {y} m {origin_x + width} {y} l S")
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            cell_x = origin_x + c * col_width + 10
            cell_y = top - r * row_height - row_height // 2
            escaped = cell.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
            ops.append(f"BT /F1 12 Tf {cell_x} {cell_y} Td ({escaped}) Tj ET")
    stream_content = "\n".join(ops).encode("latin-1")

    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>"
        b"/MediaBox[0 0 612 792]/Contents 5 0 R>>",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
        b"<</Length %d>>\nstream\n" % len(stream_content) + stream_content + b"\nendstream",
    ]
    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objs, start=1):
        offsets.append(buf.tell())
        buf.write(f"{i} 0 obj".encode() + b"\n" + obj + b"\nendobj\n")
    xref_offset = buf.tell()
    n = len(objs) + 1
    buf.write(f"xref\n0 {n}\n".encode())
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode())
    buf.write(f"trailer<</Size {n}/Root 1 0 R>>\n".encode())
    buf.write(f"startxref\n{xref_offset}\n%%EOF".encode())
    return buf.getvalue()


def make_minimal_pdf(
    lines: tuple[str, ...] = ("Hello World",),
    *,
    x: int = 100,
    y_start: int = 700,
    line_height: int = 30,
) -> bytes:
    """A single-page, 612x792pt (US Letter) PDF with `lines` drawn top-to-bottom in
    Helvetica 24pt starting at `(x, y_start)`. No tables, no images — just enough
    structure for a parser's text-extraction path to have real bytes to read."""
    return make_multi_page_pdf((lines,), x=x, y_start=y_start, line_height=line_height)
