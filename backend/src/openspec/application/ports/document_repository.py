"""`DocumentRepository` — the DOC/PRS read port behind `GET /documents`,
`GET /documents/{version_id}`, `GET /documents/{version_id}/regions`, and the page
image endpoint (`docs/api.md` §Documents). Mirrors `application/ports/
repositories.py::RecordRepository`'s established shape (list + detail, tenant-scoped,
computed rather than cached at read time).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from openspec.domain.model.document import (
    DocType,
    Document,
    DocumentPage,
    DocumentRegion,
    DocumentVersion,
    ParseArtifact,
    ParseStatus,
)

__all__ = [
    "DocumentDetailRef",
    "DocumentIngestRepository",
    "DocumentListFilters",
    "DocumentRepository",
    "DocumentSummaryRef",
    "RegionsSummary",
]


@dataclass(frozen=True, slots=True)
class DocumentSummaryRef:
    """`GET /documents` list-item shape (`docs/api.md` §Documents)."""

    document_version_id: str
    document_id: str
    publisher: str
    title: str
    doc_type: DocType
    page_count: int
    parse_status: ParseStatus
    bound_record_count: int
    first_seen_at: str


@dataclass(frozen=True, slots=True)
class RegionsSummary:
    table_count: int
    row_count: int


@dataclass(frozen=True, slots=True)
class DocumentDetailRef:
    """`GET /documents/{version_id}` shape (`docs/api.md` §Documents) — the summary
    fields plus parse/version metadata and per-page pixel dimensions (the F0.5
    additive `pages[]` field the frontend's coordinate adapter depends on)."""

    summary: DocumentSummaryRef
    content_hash: str
    source_url: str | None
    fetched_at: str
    effective_date: str | None
    parse_quality: float | None
    has_text_layer: bool
    used_ocr: bool
    pages: tuple[DocumentPage, ...]
    regions_summary: RegionsSummary


@dataclass(frozen=True, slots=True)
class DocumentListFilters:
    publisher: str | None = None
    parse_status: ParseStatus | None = None
    bound_count: str | None = None  # "0" | "gt0", per docs/api.md §Documents


class DocumentRepository(Protocol):
    def list_summaries(
        self, *, tenant_id: str, cursor: int, limit: int, filters: DocumentListFilters
    ) -> tuple[list[DocumentSummaryRef], int | None]: ...

    def get_detail(
        self, *, tenant_id: str, document_version_id: str
    ) -> DocumentDetailRef | None: ...

    def get_regions(self, *, document_version_id: str) -> tuple[DocumentRegion, ...] | None:
        """`None` means the document version itself doesn't exist — distinct from
        `()`, which means it exists but has no regions (an unparseable document,
        honestly empty rather than a 404)."""
        ...

    def get_blob_key(self, *, document_version_id: str) -> str | None:
        """The `BlobStore` key holding this version's raw bytes — an internal
        storage detail, deliberately not part of `DocumentDetailRef` (the wire
        shape). The page-image endpoint uses this plus `PageRasterizer` +
        `application/usecases/render_page_image.py` to serve
        `GET /documents/{version_id}/pages/{n}/image`."""
        ...


class DocumentIngestRepository(Protocol):
    """The write side (`POST /documents`), separate from the read-only
    `DocumentRepository` — mirrors `RecordRepository`/`ImportBatchRepository`'s
    existing split (`application/ports/import_repository.py`)."""

    def find_version_by_content_hash(
        self, *, tenant_id: str, content_hash: str
    ) -> DocumentVersion | None:
        """Content-addressed identity (`docs/04-data-model.md` §3.3: "same bytes =
        same version"). A non-`None` result makes ingestion idempotent."""
        ...

    def upsert_document_version(
        self, *, tenant_id: str, document: Document, version: DocumentVersion
    ) -> None: ...

    def save_parse_artifact(
        self, *, tenant_id: str, document_version_id: str, artifact: ParseArtifact
    ) -> None: ...
