"""Contract tests for `POST /records/import` / `GET /records/import/{batch_id}`
(docs/api.md §Records) — the M0 vertical slice's actual demo checkpoint:
"ingests a CSV, persists it, shows records in a UI" (docs/10-roadmap.md).

Each test builds its own `InMemoryRecordRepository` + `LocalFsBlobStore` and
injects them via `app.dependency_overrides`, rather than going through
`api/deps.py`'s process-lifetime singleton — so a 1,000-row import here
never leaks into other test files sharing the same pytest process.
"""

from __future__ import annotations

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from openspec.api.deps import get_blob_store, get_import_repository, get_record_repository
from openspec.api.main import create_app
from openspec.infrastructure.blob.local import LocalFsBlobStore
from openspec.infrastructure.memory.repositories import InMemoryRecordRepository

_SAMPLE_INPUT_PATH = (
    Path(__file__).resolve().parents[2] / "resources" / "reference" / "unihack" / "sample_input.csv"
)


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app()
    repo = InMemoryRecordRepository()
    blob_store = LocalFsBlobStore(root=tmp_path / "blobs")
    app.dependency_overrides[get_record_repository] = lambda: repo
    app.dependency_overrides[get_import_repository] = lambda: repo
    app.dependency_overrides[get_blob_store] = lambda: blob_store
    with TestClient(app) as c:
        yield c


_CSV = (
    b"mpn,description,supplier\n"
    b"NEW-001,A freshly ingested valve,Apollo\n"
    b"NEW-002,Another freshly ingested valve,Nibco\n"
    b",Missing mpn row,Apollo\n"
)


def test_import_returns_202_with_batch_summary(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/records/import", files={"file": ("import.csv", io.BytesIO(_CSV), "text/csv")}
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["row_count"] == 3
    assert body["imported_count"] == 2
    assert body["error_count"] == 1
    assert body["errors"][0]["error_code"] == "MISSING_MPN"
    assert "batch_id" in body


def test_ingested_records_are_immediately_visible_in_get_records(client: TestClient) -> None:
    import_resp = client.post(
        "/api/v1/records/import", files={"file": ("import.csv", io.BytesIO(_CSV), "text/csv")}
    )
    batch_id = import_resp.json()["batch_id"]

    list_resp = client.get("/api/v1/records", params={"limit": 100})
    ids = [item["id"] for item in list_resp.json()["items"]]
    imported_ids = [i for i in ids if batch_id in i]
    assert len(imported_ids) == 2

    detail_resp = client.get(f"/api/v1/records/{imported_ids[0]}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["mpn_raw"] in ("NEW-001", "NEW-002")
    # Unenriched: CLS/EXT haven't run — honest "not classified yet", not a
    # fabricated class or attribute set (docs/10-roadmap.md M0's own scope).
    assert detail["class"] is None
    assert detail["attributes"] == []


def test_get_import_batch_status_reports_row_counts_and_errors(client: TestClient) -> None:
    import_resp = client.post(
        "/api/v1/records/import", files={"file": ("import.csv", io.BytesIO(_CSV), "text/csv")}
    )
    batch_id = import_resp.json()["batch_id"]

    status_resp = client.get(f"/api/v1/records/import/{batch_id}")
    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body["id"] == batch_id
    assert body["row_count"] == 3
    assert body["error_count"] == 1
    assert len(body["errors"]) == 1


def test_unknown_batch_id_returns_404(client: TestClient) -> None:
    resp = client.get("/api/v1/records/import/does-not-exist")
    assert resp.status_code == 404
    assert resp.json()["code"] == "NOT_FOUND"


def test_unresolvable_columns_return_422_ing_missing_column(client: TestClient) -> None:
    bad_csv = b"foo,bar\n1,2\n"
    resp = client.post(
        "/api/v1/records/import", files={"file": ("import.csv", io.BytesIO(bad_csv), "text/csv")}
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "ING_MISSING_COLUMN"


def test_explicit_column_mapping_is_honoured(client: TestClient) -> None:
    custom_csv = b"PN,Notes\nCUSTOM-1,A custom-header row\n"
    resp = client.post(
        "/api/v1/records/import",
        files={"file": ("import.csv", io.BytesIO(custom_csv), "text/csv")},
        data={"column_mapping": '{"mpn": "PN", "description": "Notes"}'},
    )
    assert resp.status_code == 202
    assert resp.json()["imported_count"] == 1


def test_original_file_is_retrievable_byte_identical_via_the_blob_store(
    client: TestClient, tmp_path: Path
) -> None:
    """FR-ING-7 (docs/04-data-model.md §3.1): "Original file retained
    byte-identical.\""""
    client.post(
        "/api/v1/records/import", files={"file": ("import.csv", io.BytesIO(_CSV), "text/csv")}
    )
    found = list((tmp_path / "blobs").rglob("*"))
    stored_files = [p for p in found if p.is_file()]
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == _CSV


@pytest.mark.skipif(not _SAMPLE_INPUT_PATH.exists(), reason="sample_input.csv not present")
def test_real_1000_row_sample_input_csv_imports_with_a_per_row_error_report(
    client: TestClient,
) -> None:
    """docs/10-roadmap.md M0's verification checklist, almost verbatim:
    "500-row CSV imports with a per-row error report" — exercised here
    against the real, larger `sample_input.csv` (1,000 rows,
    `docs/16-unilog-alignment.md` UH0) rather than a synthetic fixture, no
    explicit column_mapping needed since its headers (`Mfg_Part_Num`,
    `Part_Desc`, `Part_Manuf`) already match `DEFAULT_COLUMN_ALIASES`."""
    raw_bytes = _SAMPLE_INPUT_PATH.read_bytes()
    resp = client.post(
        "/api/v1/records/import",
        files={"file": ("sample_input.csv", io.BytesIO(raw_bytes), "text/csv")},
    )
    assert resp.status_code == 202
    body = resp.json()

    assert body["row_count"] == 1000
    assert body["imported_count"] + body["error_count"] == 1000
    # docs/15-backend-implementation-status.md §7: one known duplicate
    # Mfg_Part_Num ("AVM6EV") in the real file.
    assert body["error_count"] >= 1
    duplicate_errors = [e for e in body["errors"] if e["error_code"] == "DUPLICATE_MPN_IN_BATCH"]
    assert len(duplicate_errors) >= 1

    status_resp = client.get(f"/api/v1/records/import/{body['batch_id']}")
    assert status_resp.status_code == 200
    assert status_resp.json()["row_count"] == 1000

    list_resp = client.get("/api/v1/records", params={"limit": 1})
    assert list_resp.status_code == 200
