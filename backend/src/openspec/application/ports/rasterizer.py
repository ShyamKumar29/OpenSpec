"""`PageRasterizer` — server-side page-image rendering (ADR-0012: "Render pages
server-side with `pypdfium2` at a fixed DPI, cache the images by
`(document_content_hash, page, dpi)`"). The adapter is `infrastructure/parsing/
pypdfium2_rasterizer.py`; caching the rendered bytes is the caller's job (the
existing `BlobStore` port — `application/usecases/render_page_image.py`), the same
"one cache mechanism, not two" discipline the M2 brief asks for.
"""

from __future__ import annotations

from typing import Protocol


class RasterizeError(Exception):
    """The page number doesn't exist in this document, or the bytes can't be
    rendered at all (distinct from a parse failure — a document can rasterise fine
    while having no extractable text layer, and vice versa is not expected but is
    not assumed either)."""


class PageRasterizer(Protocol):
    dpi: int

    def render_page(self, *, content: bytes, page: int) -> bytes:
        """Returns PNG bytes for `page` (1-indexed) at `self.dpi`. Raises
        `RasterizeError` for an out-of-range page or unrenderable content — never
        returns empty bytes as a silent failure signal."""
        ...
