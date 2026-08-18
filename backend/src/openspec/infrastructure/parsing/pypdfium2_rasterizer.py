"""`Pypdfium2Rasterizer` — the real `PageRasterizer` adapter (ADR-0012: "Render
pages server-side with `pypdfium2` at a fixed DPI"; ADR-0005: permissive-licensed,
picked over PyMuPDF specifically for this). Verified in this session against the
same hand-built PDF fixture the parser adapter uses
(`tests/fixtures/pdf/minimal_pdf.py`) — real rendering, not a stub; the M2 brief's
"real corpus validation BLOCKED" is about the missing 150+ document corpus, not
about whether this adapter renders real PDF bytes.
"""

from __future__ import annotations

import io

import pypdfium2 as pdfium

from openspec.application.ports.rasterizer import RasterizeError


class Pypdfium2Rasterizer:
    """`dpi` is fixed per instance (ADR-0012: "same fixed-DPI pixel space" the
    parser's bboxes and the frontend's `bboxToNormalizedRect` both agree on —
    `docs/api.md` §Documents documents 200 DPI as the convention this project uses)."""

    def __init__(self, dpi: int = 200) -> None:
        self.dpi = dpi

    def render_page(self, *, content: bytes, page: int) -> bytes:
        if page < 1:
            raise RasterizeError(f"page must be >= 1, got {page}")
        try:
            pdf = pdfium.PdfDocument(content)
        except Exception as exc:  # noqa: BLE001 — third-party byte content boundary,
            # same justification as PdfplumberParser's broad catch.
            raise RasterizeError(f"cannot open PDF for rasterisation: {exc}") from exc
        try:
            if page > len(pdf):
                raise RasterizeError(f"page {page} out of range (document has {len(pdf)} pages)")
            pdf_page = pdf[page - 1]
            bitmap = pdf_page.render(scale=self.dpi / 72)
            image = bitmap.to_pil()
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            return buf.getvalue()
        finally:
            pdf.close()
