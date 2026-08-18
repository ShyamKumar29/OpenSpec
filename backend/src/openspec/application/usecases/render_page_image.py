"""`render_page_image` — server-side page rasterisation with caching (ADR-0012:
"cache the images by `(document_content_hash, page, dpi)`"). Reuses the existing
`BlobStore` port (`application/ports/blob.py`) as the image cache — M2 brief §7's
"do not invent a second caching system" applies here too: the parse cache and the
rendered-image cache are two different keys over the same underlying mechanism
(`BlobStore` for images, `ParseCacheRepository` for parse artifacts), not two
different systems.
"""

from __future__ import annotations

from openspec.application.ports.blob import BlobStore
from openspec.application.ports.rasterizer import PageRasterizer


def _image_blob_key(content_hash: str, page: int, dpi: int) -> str:
    return f"pages/{content_hash}/{page}/{dpi}.png"


def render_page_image(
    *,
    content_hash: str,
    content: bytes,
    page: int,
    rasterizer: PageRasterizer,
    blob_store: BlobStore,
) -> bytes:
    """Cache hit: returns the previously rendered PNG bytes without touching the
    rasteriser. Cache miss: renders once, stores it, and returns it — every
    subsequent call for the same `(content_hash, page, dpi)` is a hit (ADR-0012's
    whole point: parse/render once, reference from every record that binds to this
    document)."""
    key = _image_blob_key(content_hash, page, rasterizer.dpi)
    if blob_store.exists(key=key):
        return blob_store.get(key=key)
    png_bytes = rasterizer.render_page(content=content, page=page)
    blob_store.put(key=key, data=png_bytes)
    return png_bytes
