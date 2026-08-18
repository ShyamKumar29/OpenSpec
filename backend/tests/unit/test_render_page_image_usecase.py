"""Tests for `application/usecases/render_page_image.py` — real rasterizer, real
`LocalFsBlobStore` against a tmp directory, proving cache hit avoids re-rendering."""

from __future__ import annotations

from pathlib import Path

from openspec.application.usecases.render_page_image import render_page_image
from openspec.infrastructure.blob.local import LocalFsBlobStore
from openspec.infrastructure.parsing.pypdfium2_rasterizer import Pypdfium2Rasterizer
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf


class _CountingRasterizer:
    def __init__(self, dpi: int = 200) -> None:
        self.dpi = dpi
        self._inner = Pypdfium2Rasterizer(dpi=dpi)
        self.render_calls = 0

    def render_page(self, *, content: bytes, page: int) -> bytes:
        self.render_calls += 1
        return self._inner.render_page(content=content, page=page)


def test_first_call_renders_second_call_hits_cache(tmp_path: Path) -> None:
    blob_store = LocalFsBlobStore(root=tmp_path)
    rasterizer = _CountingRasterizer(dpi=200)
    pdf_bytes = make_minimal_pdf(("Cache The Page",))

    first = render_page_image(
        content_hash="sha256_page_cache",
        content=pdf_bytes,
        page=1,
        rasterizer=rasterizer,
        blob_store=blob_store,
    )
    second = render_page_image(
        content_hash="sha256_page_cache",
        content=pdf_bytes,
        page=1,
        rasterizer=rasterizer,
        blob_store=blob_store,
    )
    assert first == second
    assert rasterizer.render_calls == 1  # second call was a cache hit


def test_different_pages_are_different_cache_entries(tmp_path: Path) -> None:
    blob_store = LocalFsBlobStore(root=tmp_path)
    rasterizer = _CountingRasterizer(dpi=200)
    pdf_bytes = make_minimal_pdf(("Only Page",))

    render_page_image(
        content_hash="sha256_multi",
        content=pdf_bytes,
        page=1,
        rasterizer=rasterizer,
        blob_store=blob_store,
    )
    # Same content_hash, different DPI rasterizer instance -> different cache key.
    other_rasterizer = _CountingRasterizer(dpi=100)
    render_page_image(
        content_hash="sha256_multi",
        content=pdf_bytes,
        page=1,
        rasterizer=other_rasterizer,
        blob_store=blob_store,
    )
    assert rasterizer.render_calls == 1
    assert other_rasterizer.render_calls == 1  # not served from the 200-dpi entry
