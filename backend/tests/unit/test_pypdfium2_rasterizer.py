"""Tests for `infrastructure/parsing/pypdfium2_rasterizer.py` — run against the same
hand-built PDF fixture the parser tests use. Real rendering, not a stub; not a proof
of real-corpus rasterisation (no such corpus exists in this environment)."""

from __future__ import annotations

import pytest

from openspec.application.ports.rasterizer import RasterizeError
from openspec.infrastructure.parsing.pypdfium2_rasterizer import Pypdfium2Rasterizer
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf


def test_renders_a_page_to_png_bytes() -> None:
    pdf_bytes = make_minimal_pdf(("Render Me",))
    png_bytes = Pypdfium2Rasterizer(dpi=200).render_page(content=pdf_bytes, page=1)
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"  # real PNG signature


def test_dpi_scales_output_dimensions() -> None:
    pdf_bytes = make_minimal_pdf(("DPI Check",))
    small = Pypdfium2Rasterizer(dpi=100).render_page(content=pdf_bytes, page=1)
    large = Pypdfium2Rasterizer(dpi=200).render_page(content=pdf_bytes, page=1)
    assert len(large) > len(small)  # a 2x-DPI render is a materially bigger PNG


def test_out_of_range_page_raises() -> None:
    pdf_bytes = make_minimal_pdf(("One Page Only",))
    with pytest.raises(RasterizeError):
        Pypdfium2Rasterizer(dpi=200).render_page(content=pdf_bytes, page=2)


def test_zero_page_raises() -> None:
    pdf_bytes = make_minimal_pdf(("Page Numbers Are 1-Indexed",))
    with pytest.raises(RasterizeError):
        Pypdfium2Rasterizer(dpi=200).render_page(content=pdf_bytes, page=0)


def test_corrupt_content_raises_rasterize_error_not_a_crash() -> None:
    with pytest.raises(RasterizeError):
        Pypdfium2Rasterizer(dpi=200).render_page(content=b"not a pdf", page=1)


def test_rendering_is_deterministic() -> None:
    pdf_bytes = make_minimal_pdf(("Deterministic Render",))
    rasterizer = Pypdfium2Rasterizer(dpi=200)
    png_1 = rasterizer.render_page(content=pdf_bytes, page=1)
    png_2 = rasterizer.render_page(content=pdf_bytes, page=1)
    assert png_1 == png_2
