"""`ingest_document` — `POST /documents` (`docs/api.md` §Documents): upload -> store
raw bytes (content-addressed, `docs/04-data-model.md` §3.3) -> parse -> register.
Ties together `BlobStore`, `DocumentParser`, and `DocumentRepository` the same way
`ingest_batch.py` ties together `BlobStore` + `ImportBatchRepository` for `ING`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from openspec.application.ports.blob import BlobStore
from openspec.application.ports.document_repository import DocumentIngestRepository
from openspec.application.ports.ocr import OcrProvider
from openspec.application.ports.parse_cache import ParseCacheRepository
from openspec.application.ports.parser import DocumentParser
from openspec.application.ports.rasterizer import PageRasterizer
from openspec.application.usecases.parse_document import parse_document
from openspec.domain.model.document import (
    DocType,
    Document,
    DocumentPage,
    DocumentVersion,
    ParseStatus,
    RegionType,
)
from openspec.domain.prs.parse_result import ParseFailed, ParseSucceeded


@dataclass(frozen=True, slots=True)
class DocumentIngested:
    version: DocumentVersion
    already_existed: bool  # content-addressed identity: re-uploading identical bytes is a no-op
    parse_failure_reason: str | None  # None on success


def _page_dims_px(page_bbox: tuple[float, float, float, float], dpi: int) -> tuple[int, int]:
    """`page.bbox` from the parser is in PDF point space (1/72in); the wire
    contract's `pages[].width_px/height_px` (`docs/api.md` §Documents) is the pixel
    space of the rendered image at the document's fixed DPI (ADR-0012) — this is the
    one place that conversion happens for a freshly ingested document."""
    _, _, x1, y1 = page_bbox
    return round(x1 * dpi / 72), round(y1 * dpi / 72)


def ingest_document(
    *,
    tenant_id: str,
    publisher: str,
    title: str,
    doc_type: DocType,
    source_url: str | None,
    content: bytes,
    created_at: str,
    blob_store: BlobStore,
    parser: DocumentParser,
    document_repo: DocumentIngestRepository,
    parse_cache: ParseCacheRepository,
    dpi: int = 200,
    ocr_provider: OcrProvider | None = None,
    rasterizer: PageRasterizer | None = None,
) -> DocumentIngested:
    content_hash = f"sha256_{hashlib.sha256(content).hexdigest()}"
    existing = document_repo.find_version_by_content_hash(
        tenant_id=tenant_id, content_hash=content_hash
    )
    if existing is not None:
        return DocumentIngested(version=existing, already_existed=True, parse_failure_reason=None)

    blob_key = f"documents/{content_hash}.pdf"
    blob_store.put(key=blob_key, data=content)

    document_id = f"doc_{content_hash}"
    document = Document(
        id=document_id,
        tenant_id=tenant_id,
        publisher=publisher,
        title=title,
        source_url=source_url,
        doc_type=doc_type,
        first_seen_at=created_at,
    )

    version_id = f"docver_{content_hash}"
    parse_result = parse_document(
        document_version_id=version_id,
        content_hash=content_hash,
        content=content,
        parser=parser,
        cache=parse_cache,
        ocr_provider=ocr_provider,
        rasterizer=rasterizer,
    )
    outcome = parse_result.outcome

    if isinstance(outcome, ParseFailed):
        version = DocumentVersion(
            id=version_id,
            document_id=document_id,
            content_hash=content_hash,
            blob_key=blob_key,
            page_count=0,
            fetched_at=created_at,
            effective_date=None,
            parse_status=ParseStatus.UNPARSEABLE,
            pages=(),
        )
        document_repo.upsert_document_version(
            tenant_id=tenant_id, document=document, version=version
        )
        return DocumentIngested(
            version=version, already_existed=False, parse_failure_reason=outcome.reason.value
        )

    assert isinstance(outcome, ParseSucceeded)  # noqa: S101 — exhaustiveness, not a runtime guard
    artifact = outcome.artifact
    page_regions = sorted(
        (r for r in artifact.regions if r.region_type is RegionType.PAGE), key=lambda r: r.page
    )
    pages = tuple(
        DocumentPage(n=r.page, width_px=w, height_px=h, dpi=dpi)
        for r in page_regions
        for w, h in (_page_dims_px(r.bbox, dpi),)
    )
    parse_status = ParseStatus.OCR_FALLBACK if artifact.used_ocr else ParseStatus.PARSED
    version = DocumentVersion(
        id=version_id,
        document_id=document_id,
        content_hash=content_hash,
        blob_key=blob_key,
        page_count=len(pages),
        fetched_at=created_at,
        effective_date=None,
        parse_status=parse_status,
        pages=pages,
    )
    document_repo.upsert_document_version(tenant_id=tenant_id, document=document, version=version)
    document_repo.save_parse_artifact(
        tenant_id=tenant_id, document_version_id=version_id, artifact=artifact
    )
    return DocumentIngested(version=version, already_existed=False, parse_failure_reason=None)
