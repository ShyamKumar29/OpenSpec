"""Wire DTOs for `docs/api.md` §Documents. Field-for-field match with
`frontend/lib/contracts/document.ts` — same discipline `api/schemas/attribute_value.py`
already established (that frontend file is the acceptance test for this one).
"""

from __future__ import annotations

from pydantic import BaseModel

from openspec.application.ports.document_repository import (
    DocumentDetailRef,
    DocumentSummaryRef,
    RegionsSummary,
)
from openspec.domain.model.document import DocumentBinding, DocumentPage, DocumentRegion


class PageOut(BaseModel):
    n: int
    width_px: int
    height_px: int
    dpi: int


def _page_out(p: DocumentPage) -> PageOut:
    return PageOut(n=p.n, width_px=p.width_px, height_px=p.height_px, dpi=p.dpi)


class DocumentSummaryOut(BaseModel):
    document_version_id: str
    document_id: str
    publisher: str
    title: str
    doc_type: str
    page_count: int
    parse_status: str
    bound_record_count: int
    first_seen_at: str


def document_summary_from_domain(s: DocumentSummaryRef) -> DocumentSummaryOut:
    return DocumentSummaryOut(
        document_version_id=s.document_version_id,
        document_id=s.document_id,
        publisher=s.publisher,
        title=s.title,
        doc_type=s.doc_type.value,
        page_count=s.page_count,
        parse_status=s.parse_status.value,
        bound_record_count=s.bound_record_count,
        first_seen_at=s.first_seen_at,
    )


class RegionsSummaryOut(BaseModel):
    table_count: int
    row_count: int


def _regions_summary_out(r: RegionsSummary) -> RegionsSummaryOut:
    return RegionsSummaryOut(table_count=r.table_count, row_count=r.row_count)


class DocumentDetailOut(DocumentSummaryOut):
    content_hash: str
    source_url: str | None
    fetched_at: str
    effective_date: str | None
    parse_quality: float | None
    has_text_layer: bool
    used_ocr: bool
    pages: list[PageOut]
    regions_summary: RegionsSummaryOut


def document_detail_from_domain(d: DocumentDetailRef) -> DocumentDetailOut:
    summary = document_summary_from_domain(d.summary)
    return DocumentDetailOut(
        **summary.model_dump(),
        content_hash=d.content_hash,
        source_url=d.source_url,
        fetched_at=d.fetched_at,
        effective_date=d.effective_date,
        parse_quality=d.parse_quality,
        has_text_layer=d.has_text_layer,
        used_ocr=d.used_ocr,
        pages=[_page_out(p) for p in d.pages],
        regions_summary=_regions_summary_out(d.regions_summary),
    )


class DocumentRegionOut(BaseModel):
    id: str
    region_type: str
    page: int
    bbox: tuple[float, float, float, float]
    path: str
    text: str | None
    parent_region_id: str | None


def document_region_from_domain(r: DocumentRegion) -> DocumentRegionOut:
    return DocumentRegionOut(
        id=r.id,
        region_type=r.region_type.value,
        page=r.page,
        bbox=r.bbox,
        path=r.path,
        text=r.text,
        parent_region_id=r.parent_region_id,
    )


class DocumentBindingOut(BaseModel):
    document_version_id: str
    region_id: str | None
    confidence: float
    signals: dict[str, object]


def document_binding_from_domain(b: DocumentBinding) -> DocumentBindingOut:
    return DocumentBindingOut(
        document_version_id=b.document_version_id,
        region_id=b.region_id,
        confidence=b.confidence,
        signals=b.signals,
    )
