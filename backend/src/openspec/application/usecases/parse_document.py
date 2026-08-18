"""`parse_document` — the PRS orchestration use case (M2 brief: "document ->
retrieval -> parse/cache lookup -> parser -> pages -> text/table regions -> region
tree -> parse result"). Ties together the cache port, the `DocumentParser` port, and
— only when the parser reports no text layer — the OCR fallback chain
(`OcrProvider` + `PageRasterizer`), never calling either unless it's actually needed.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.ocr import OcrProvider, OcrUnavailable
from openspec.application.ports.parse_cache import ParseCacheRepository
from openspec.application.ports.parser import DocumentParser
from openspec.application.ports.rasterizer import PageRasterizer, RasterizeError
from openspec.domain.model.document import DocumentRegion, ParseArtifact, RegionType
from openspec.domain.prs.cache_key import ParseCacheKey
from openspec.domain.prs.parse_result import (
    ParseFailed,
    ParseFailureReason,
    ParseOutcome,
    ParseSucceeded,
)


@dataclass(frozen=True, slots=True)
class ParseDocumentResult:
    outcome: ParseOutcome
    from_cache: bool


def _ocr_fallback(
    *,
    document_version_id: str,
    content: bytes,
    artifact: ParseArtifact,
    ocr_provider: OcrProvider,
    rasterizer: PageRasterizer,
) -> ParseOutcome:
    """Rasterises each page and asks `ocr_provider` to recognise it, replacing the
    (empty) text-layer regions with OCR-derived `block` regions. Bails out on the
    first `OcrUnavailable` — a real OCR engine is available for the whole run or
    none of it, so failing fast on page 1 rather than looping through every page
    first is both correct and cheap for the common "no engine configured" case."""
    page_regions = [r for r in artifact.regions if r.region_type is RegionType.PAGE]
    if not page_regions:
        return ParseFailed(ParseFailureReason.EMPTY_DOCUMENT, "no pages to OCR")

    non_block_regions = tuple(r for r in artifact.regions if r.region_type is not RegionType.BLOCK)
    ocr_blocks: list[DocumentRegion] = []
    for page_region in page_regions:
        try:
            image = rasterizer.render_page(content=content, page=page_region.page)
        except RasterizeError as exc:
            return ParseFailed(
                ParseFailureReason.PARSER_ERROR,
                f"page {page_region.page} could not be rasterised for OCR: {exc}",
            )
        result = ocr_provider.recognize(image=image)
        if isinstance(result, OcrUnavailable):
            return ParseFailed(ParseFailureReason.NO_TEXT_LAYER_OCR_UNAVAILABLE, result.reason)
        if result.text.strip():
            ocr_blocks.append(
                DocumentRegion(
                    id=f"{document_version_id}/page:{page_region.page}/block:1",
                    region_type=RegionType.BLOCK,
                    page=page_region.page,
                    bbox=page_region.bbox,
                    path="block:1",
                    text=result.text,
                    parent_region_id=page_region.id,
                )
            )

    if not ocr_blocks:
        return ParseFailed(
            ParseFailureReason.NO_TEXT_LAYER_OCR_UNAVAILABLE,
            "OCR engine ran but recognised no text on any page",
        )

    new_artifact = ParseArtifact(
        id=artifact.id,
        document_version_id=artifact.document_version_id,
        parser_name=artifact.parser_name,
        parser_version=artifact.parser_version,
        parse_quality=artifact.parse_quality,
        has_text_layer=True,
        used_ocr=True,
        regions=non_block_regions + tuple(ocr_blocks),
    )
    return ParseSucceeded(artifact=new_artifact)


def parse_document(
    *,
    document_version_id: str,
    content_hash: str,
    content: bytes,
    parser: DocumentParser,
    cache: ParseCacheRepository,
    ocr_provider: OcrProvider | None = None,
    rasterizer: PageRasterizer | None = None,
) -> ParseDocumentResult:
    """Cache key = `(content_hash, parser_name, parser_version)`
    (`domain/prs/cache_key.py`). A cached artifact is always `has_text_layer=True`
    or a prior OCR fallback already ran — **failed parses are never cached** (see
    below), so a retried parse of a document that failed last time always gets a
    fresh attempt rather than replaying a stale failure forever."""
    key = ParseCacheKey(
        content_hash=content_hash,
        parser_name=parser.parser_name,
        parser_version=parser.parser_version,
    )
    cached = cache.get(key=key)
    if cached is not None:
        return ParseDocumentResult(outcome=ParseSucceeded(artifact=cached), from_cache=True)

    outcome = parser.parse(document_version_id=document_version_id, content=content)

    if (
        isinstance(outcome, ParseSucceeded)
        and not outcome.artifact.has_text_layer
        and ocr_provider is not None
        and rasterizer is not None
    ):
        outcome = _ocr_fallback(
            document_version_id=document_version_id,
            content=content,
            artifact=outcome.artifact,
            ocr_provider=ocr_provider,
            rasterizer=rasterizer,
        )
    elif isinstance(outcome, ParseSucceeded) and not outcome.artifact.has_text_layer:
        # No OCR chain configured at all — honest failure, never a silent empty doc.
        outcome = ParseFailed(
            ParseFailureReason.NO_TEXT_LAYER_OCR_UNAVAILABLE,
            "document has no text layer and no OCR provider/rasterizer was configured",
        )

    if isinstance(outcome, ParseSucceeded):
        cache.put(key=key, artifact=outcome.artifact)
    return ParseDocumentResult(outcome=outcome, from_cache=False)
