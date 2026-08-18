"""Tests for `application/usecases/ingest_document.py` — real `PdfplumberParser`,
`InMemoryParseCache`, `InMemoryDocumentRepository`, and a tmp-dir `LocalFsBlobStore`.
Run against the hand-built PDF fixture (`tests/fixtures/pdf/minimal_pdf.py`) — real
end-to-end ingestion, not a real-world corpus proof (none exists in this environment).
"""

from __future__ import annotations

from pathlib import Path

from openspec.application.usecases.ingest_document import ingest_document
from openspec.domain.model.document import DocType, ParseStatus, RegionType
from openspec.infrastructure.blob.local import LocalFsBlobStore
from openspec.infrastructure.memory.document_repository import InMemoryDocumentRepository
from openspec.infrastructure.parsing.parse_cache import InMemoryParseCache
from openspec.infrastructure.parsing.pdfplumber_parser import PdfplumberParser
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf


def _ingest(content: bytes, repo: InMemoryDocumentRepository, blob_store: LocalFsBlobStore):
    return ingest_document(
        tenant_id="tenant_demo",
        publisher="Apollo",
        title="Test Spec Sheet",
        doc_type=DocType.SPEC_SHEET,
        source_url=None,
        content=content,
        created_at="2026-08-14T00:00:00Z",
        blob_store=blob_store,
        parser=PdfplumberParser(),
        document_repo=repo,
        parse_cache=InMemoryParseCache(),
    )


def test_ingest_registers_a_parsed_version(tmp_path: Path) -> None:
    repo = InMemoryDocumentRepository()
    blob_store = LocalFsBlobStore(root=tmp_path)
    result = _ingest(make_minimal_pdf(("Ingest Me",)), repo, blob_store)

    assert result.already_existed is False
    assert result.version.parse_status is ParseStatus.PARSED
    assert result.version.page_count == 1

    detail = repo.get_detail(tenant_id="tenant_demo", document_version_id=result.version.id)
    assert detail is not None
    assert detail.summary.publisher == "Apollo"
    assert detail.has_text_layer is True


def test_reuploading_identical_bytes_is_idempotent(tmp_path: Path) -> None:
    repo = InMemoryDocumentRepository()
    blob_store = LocalFsBlobStore(root=tmp_path)
    content = make_minimal_pdf(("Same Bytes",))

    first = _ingest(content, repo, blob_store)
    second = _ingest(content, repo, blob_store)

    assert first.already_existed is False
    assert second.already_existed is True
    assert second.version.id == first.version.id


def test_corrupt_upload_is_registered_as_unparseable(tmp_path: Path) -> None:
    repo = InMemoryDocumentRepository()
    blob_store = LocalFsBlobStore(root=tmp_path)
    result = _ingest(b"not a pdf at all", repo, blob_store)

    assert result.parse_failure_reason is not None
    assert result.version.parse_status is ParseStatus.UNPARSEABLE
    assert result.version.page_count == 0

    detail = repo.get_detail(tenant_id="tenant_demo", document_version_id=result.version.id)
    assert detail is not None  # registered, not silently dropped
    regions = repo.get_regions(document_version_id=result.version.id)
    assert regions == ()  # honestly empty, not None (the version does exist)


def test_regions_are_retrievable_after_ingestion(tmp_path: Path) -> None:
    repo = InMemoryDocumentRepository()
    blob_store = LocalFsBlobStore(root=tmp_path)
    result = _ingest(make_minimal_pdf(("Region Check",)), repo, blob_store)

    regions = repo.get_regions(document_version_id=result.version.id)
    assert regions is not None
    assert any(r.region_type is RegionType.PAGE for r in regions)


def test_unknown_document_version_regions_is_none(tmp_path: Path) -> None:
    repo = InMemoryDocumentRepository()
    assert repo.get_regions(document_version_id="docver_never_ingested") is None
