"""Contract tests for the M2 document endpoints (`docs/api.md` §Documents) against
`frontend/lib/contracts/document.ts`. Each test builds its own isolated set of
in-memory adapters via `app.dependency_overrides` (same isolation pattern
`test_records_import_api.py` established) so uploads in one test never leak into
another sharing the same pytest process.

Run with the real `PdfplumberParser`/`Pypdfium2Rasterizer` against the hand-built
PDF fixture (`tests/fixtures/pdf/minimal_pdf.py`) — genuine end-to-end behaviour,
not a mocked pipeline. Not a real-corpus proof (none exists in this environment).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from openspec.api.deps import (
    get_binding_repository,
    get_blob_store,
    get_document_ingest_repository,
    get_document_parser,
    get_document_repository,
    get_page_rasterizer,
    get_parse_cache,
    get_record_repository,
)
from openspec.api.main import create_app
from openspec.infrastructure.blob.local import LocalFsBlobStore
from openspec.infrastructure.memory.document_repository import InMemoryDocumentRepository
from openspec.infrastructure.memory.repositories import (
    CANONICAL_RECORD_ID,
    InMemoryRecordRepository,
)
from openspec.infrastructure.parsing.parse_cache import InMemoryParseCache
from openspec.infrastructure.parsing.pdfplumber_parser import PdfplumberParser
from openspec.infrastructure.parsing.pypdfium2_rasterizer import Pypdfium2Rasterizer
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app()
    record_repo = InMemoryRecordRepository()
    document_repo = InMemoryDocumentRepository()
    blob_store = LocalFsBlobStore(root=tmp_path / "blobs")
    app.dependency_overrides[get_record_repository] = lambda: record_repo
    app.dependency_overrides[get_document_repository] = lambda: document_repo
    app.dependency_overrides[get_document_ingest_repository] = lambda: document_repo
    app.dependency_overrides[get_binding_repository] = lambda: document_repo
    app.dependency_overrides[get_blob_store] = lambda: blob_store
    app.dependency_overrides[get_document_parser] = lambda: PdfplumberParser()
    app.dependency_overrides[get_page_rasterizer] = lambda: Pypdfium2Rasterizer(dpi=200)
    app.dependency_overrides[get_parse_cache] = lambda: InMemoryParseCache()
    with TestClient(app) as c:
        yield c


def _upload(client: TestClient, lines: tuple[str, ...] = ("Hello",)) -> dict[str, object]:
    pdf_bytes = make_minimal_pdf(lines)
    resp = client.post(
        "/api/v1/documents",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        data={"publisher": "Apollo", "title": "Test Doc", "doc_type": "spec_sheet"},
    )
    assert resp.status_code == 202
    body: dict[str, object] = resp.json()
    return body


class TestListDocuments:
    def test_starts_empty_no_fabricated_corpus(self, client: TestClient) -> None:
        """M2 brief: 'Do not fabricate a PDF/document corpus.' The real backend's
        corpus is honestly empty until something is actually uploaded."""
        resp = client.get("/api/v1/documents")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"items": [], "next_cursor": None}

    def test_uploaded_document_appears_in_the_list(self, client: TestClient) -> None:
        _upload(client)
        resp = client.get("/api/v1/documents")
        body = resp.json()
        assert len(body["items"]) == 1
        item = body["items"][0]
        for field in (
            "document_version_id",
            "document_id",
            "publisher",
            "title",
            "doc_type",
            "page_count",
            "parse_status",
            "bound_record_count",
            "first_seen_at",
        ):
            assert field in item, field
        assert item["parse_status"] == "parsed"
        assert item["bound_record_count"] == 0

    def test_pagination_cursor_walks_the_full_list(self, client: TestClient) -> None:
        for i in range(3):
            _upload(client, (f"Document {i}",))
        first_page = client.get("/api/v1/documents", params={"limit": 2}).json()
        assert len(first_page["items"]) == 2
        assert first_page["next_cursor"] is not None
        second_page = client.get(
            "/api/v1/documents", params={"limit": 2, "cursor": first_page["next_cursor"]}
        ).json()
        assert len(second_page["items"]) == 1
        assert second_page["next_cursor"] is None
        all_ids = {i["document_version_id"] for i in first_page["items"] + second_page["items"]}
        assert len(all_ids) == 3


class TestDocumentDetail:
    def test_detail_shape_matches_contract(self, client: TestClient) -> None:
        upload = _upload(client, ("Contract Shape Check",))
        version_id = upload["document_version_id"]
        resp = client.get(f"/api/v1/documents/{version_id}")
        assert resp.status_code == 200
        body = resp.json()
        for field in (
            "document_version_id",
            "content_hash",
            "source_url",
            "fetched_at",
            "effective_date",
            "parse_quality",
            "has_text_layer",
            "used_ocr",
            "pages",
            "regions_summary",
        ):
            assert field in body, field
        assert body["pages"] == [{"n": 1, "width_px": 1700, "height_px": 2200, "dpi": 200}]
        assert body["regions_summary"] == {"table_count": 0, "row_count": 0}

    def test_unknown_version_is_404(self, client: TestClient) -> None:
        resp = client.get("/api/v1/documents/docver_never_existed")
        assert resp.status_code == 404
        assert resp.headers["content-type"] == "application/problem+json"


class TestDocumentRegions:
    def test_regions_shape_matches_contract(self, client: TestClient) -> None:
        upload = _upload(client, ("Region Shape Check",))
        version_id = upload["document_version_id"]
        resp = client.get(f"/api/v1/documents/{version_id}/regions")
        assert resp.status_code == 200
        regions = resp.json()["regions"]
        assert len(regions) >= 1
        for field in ("id", "region_type", "page", "bbox", "path", "text", "parent_region_id"):
            assert field in regions[0], field
        assert any(r["region_type"] == "page" for r in regions)

    def test_unknown_version_regions_is_404(self, client: TestClient) -> None:
        resp = client.get("/api/v1/documents/docver_never_existed/regions")
        assert resp.status_code == 404


class TestDocumentPageImage:
    def test_page_image_is_real_png_bytes(self, client: TestClient) -> None:
        upload = _upload(client, ("Page Image Check",))
        version_id = upload["document_version_id"]
        resp = client.get(f"/api/v1/documents/{version_id}/pages/1/image")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_out_of_range_page_is_404(self, client: TestClient) -> None:
        upload = _upload(client, ("One Page Only",))
        version_id = upload["document_version_id"]
        resp = client.get(f"/api/v1/documents/{version_id}/pages/99/image")
        assert resp.status_code == 404

    def test_unknown_version_page_is_404(self, client: TestClient) -> None:
        resp = client.get("/api/v1/documents/docver_never_existed/pages/1/image")
        assert resp.status_code == 404


class TestUploadDocument:
    def test_corrupt_upload_is_still_registered_as_unparseable(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/documents",
            files={"file": ("bad.pdf", b"not a pdf", "application/pdf")},
            data={"publisher": "Apollo", "title": "Corrupt", "doc_type": "spec_sheet"},
        )
        assert resp.status_code == 202
        body = resp.json()
        assert body["parse_status"] == "unparseable"
        assert body["parse_failure_reason"] is not None

    def test_reupload_of_identical_bytes_is_idempotent(self, client: TestClient) -> None:
        first = _upload(client, ("Idempotent Check",))
        pdf_bytes = make_minimal_pdf(("Idempotent Check",))
        resp = client.post(
            "/api/v1/documents",
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
            data={"publisher": "Apollo", "title": "Test Doc", "doc_type": "spec_sheet"},
        )
        body = resp.json()
        assert body["already_existed"] is True
        assert body["document_version_id"] == first["document_version_id"]

    def test_invalid_doc_type_is_422(self, client: TestClient) -> None:
        pdf_bytes = make_minimal_pdf(("Bad Type",))
        resp = client.post(
            "/api/v1/documents",
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
            data={"publisher": "Apollo", "title": "Test Doc", "doc_type": "not_a_real_type"},
        )
        assert resp.status_code == 422


class TestBindings:
    def test_manual_attach_returns_201_with_binding_shape(self, client: TestClient) -> None:
        upload = _upload(client, ("Binding Target",))
        version_id = upload["document_version_id"]
        resp = client.post(
            f"/api/v1/records/{CANONICAL_RECORD_ID}/bindings",
            json={"document_version_id": version_id, "confidence": 1.0},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["document_version_id"] == version_id
        assert body["confidence"] == 1.0

    def test_attach_to_unknown_record_is_404(self, client: TestClient) -> None:
        upload = _upload(client, ("Binding Target 2",))
        resp = client.post(
            "/api/v1/records/rec_does_not_exist/bindings",
            json={"document_version_id": upload["document_version_id"]},
        )
        assert resp.status_code == 404

    def test_attach_then_bound_record_count_increments(self, client: TestClient) -> None:
        upload = _upload(client, ("Bound Count Check",))
        version_id = upload["document_version_id"]
        client.post(
            f"/api/v1/records/{CANONICAL_RECORD_ID}/bindings",
            json={"document_version_id": version_id},
        )
        resp = client.get(f"/api/v1/documents/{version_id}")
        assert resp.json()["bound_record_count"] == 1

    def test_detach_unknown_binding_is_404(self, client: TestClient) -> None:
        resp = client.delete(f"/api/v1/records/{CANONICAL_RECORD_ID}/bindings/binding_nope")
        assert resp.status_code == 404
