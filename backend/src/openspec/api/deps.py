"""Composition root (docs/05-backend.md §4). The **only** file under `api/` allowed to
import `infrastructure/` directly — enforced by
`tests/architecture/test_layering.py::test_api_never_imports_infrastructure_directly`.
`Settings -> build adapters -> build use cases -> hand to FastAPI dependencies.`
"""

from __future__ import annotations

from pathlib import Path

from openspec.application.ports.binding_repository import BindingRepository
from openspec.application.ports.blob import BlobStore
from openspec.application.ports.document_repository import (
    DocumentIngestRepository,
    DocumentRepository,
)
from openspec.application.ports.import_repository import ImportBatchRepository
from openspec.application.ports.parse_cache import ParseCacheRepository
from openspec.application.ports.parser import DocumentParser
from openspec.application.ports.rasterizer import PageRasterizer
from openspec.application.ports.repositories import RecordRepository
from openspec.config.settings import get_settings
from openspec.domain.errors import InvariantViolation
from openspec.infrastructure.blob.local import LocalFsBlobStore
from openspec.infrastructure.memory.document_repository import InMemoryDocumentRepository
from openspec.infrastructure.memory.repositories import InMemoryRecordRepository
from openspec.infrastructure.parsing.parse_cache import InMemoryParseCache
from openspec.infrastructure.parsing.pdfplumber_parser import PdfplumberParser
from openspec.infrastructure.parsing.pypdfium2_rasterizer import Pypdfium2Rasterizer

_record_repository: InMemoryRecordRepository | None = None
_blob_store: BlobStore | None = None
_document_repository: InMemoryDocumentRepository | None = None
_parse_cache: InMemoryParseCache | None = None
_document_parser: PdfplumberParser | None = None
_page_rasterizer: Pypdfium2Rasterizer | None = None


def _get_memory_repository() -> InMemoryRecordRepository:
    """`InMemoryRecordRepository` implements both `RecordRepository` (read)
    and `ImportBatchRepository` (write) — one process-lifetime instance so a
    record `ING` just wrote is visible to the very next `GET /records` call,
    the "ingests a CSV, persists it, shows records in a UI" M0 checkpoint
    (docs/10-roadmap.md) end to end."""
    global _record_repository
    if _record_repository is not None:
        return _record_repository

    settings = get_settings()
    if settings.repository_backend == "memory":
        _record_repository = InMemoryRecordRepository()
        return _record_repository

    # `postgres` is designed (infrastructure/db/models.py) but not yet wired to a
    # repository implementation — see docs/15-backend-implementation-status.md. Fail
    # fast rather than silently falling back to the in-memory demo store.
    raise InvariantViolation(
        "repository_backend='postgres' is not wired yet; "
        "the schema exists in infrastructure/db/models.py but no repository "
        "implementation reads/writes it. Use repository_backend='memory' for now."
    )


def get_record_repository() -> RecordRepository:
    return _get_memory_repository()


def get_import_repository() -> ImportBatchRepository:
    return _get_memory_repository()


def get_blob_store() -> BlobStore:
    """`local` topology default (docs/07-devops.md §3): filesystem under
    `.data/blobs/` at the repo root, gitignored. Swapping to `S3BlobStore`
    for the `cloud` topology is a change to this function only — nothing
    above `BlobStore` needs to change (the same composition-root-only swap
    `RecordRepository`'s own docstring already establishes)."""
    global _blob_store
    if _blob_store is None:
        # parents[3] = backend/ (deps.py is backend/src/openspec/api/deps.py) —
        # mirrors taxonomy_loader.py's `parents[3] / "resources"` convention.
        root = Path(__file__).resolve().parents[3] / ".data" / "blobs"
        _blob_store = LocalFsBlobStore(root=root)
    return _blob_store


def _get_memory_document_repository() -> InMemoryDocumentRepository:
    """One process-lifetime instance implementing `DocumentRepository` (read),
    `DocumentIngestRepository` (write, `POST /documents`), and `BindingRepository`
    (`POST`/`DELETE /records/{id}/bindings`) — the same "one store, several port
    roles" pattern `_get_memory_repository` above already establishes for records.
    **Starts genuinely empty**: no document corpus is fabricated (M2 brief) — it
    only ever holds what `POST /documents` actually ingests in this process."""
    global _document_repository
    if _document_repository is None:
        _document_repository = InMemoryDocumentRepository()
    return _document_repository


def get_document_repository() -> DocumentRepository:
    return _get_memory_document_repository()


def get_document_ingest_repository() -> DocumentIngestRepository:
    return _get_memory_document_repository()


def get_binding_repository() -> BindingRepository:
    return _get_memory_document_repository()


def get_parse_cache() -> ParseCacheRepository:
    global _parse_cache
    if _parse_cache is None:
        _parse_cache = InMemoryParseCache()
    return _parse_cache


def get_document_parser() -> DocumentParser:
    global _document_parser
    if _document_parser is None:
        _document_parser = PdfplumberParser()
    return _document_parser


def get_page_rasterizer() -> PageRasterizer:
    """Fixed 200 DPI (ADR-0012; `docs/api.md` §Documents' own example uses
    `dpi: 200`) — one rasteriser instance, one pixel space, shared by every page
    this process renders."""
    global _page_rasterizer
    if _page_rasterizer is None:
        _page_rasterizer = Pypdfium2Rasterizer(dpi=200)
    return _page_rasterizer
