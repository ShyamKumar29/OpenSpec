"""`application/usecases/ingest_batch.py` against fake ports (docs/05-backend.md
§9: "unit tests with fake ports")."""

from __future__ import annotations

from openspec.application.ports.import_repository import ImportBatchSummary, ImportRowError
from openspec.application.usecases.ingest_batch import ingest_csv_batch
from openspec.domain.model.record import CatalogRecord


class _FakeBlobStore:
    def __init__(self) -> None:
        self.put_calls: list[tuple[str, bytes]] = []

    def put(self, *, key: str, data: bytes) -> str:
        self.put_calls.append((key, data))
        return key

    def get(self, *, key: str) -> bytes:
        return dict(self.put_calls)[key]

    def exists(self, *, key: str) -> bool:
        return any(k == key for k, _ in self.put_calls)


class _FakeImportRepo:
    def __init__(self) -> None:
        self.batches: dict[str, dict[str, object]] = {}
        self.records: list[CatalogRecord] = []
        self.errors: list[ImportRowError] = []

    def create_batch(
        self, *, id: str, tenant_id: str, filename: str, raw_blob_key: str, created_by: str
    ) -> None:
        self.batches[id] = {
            "tenant_id": tenant_id,
            "filename": filename,
            "raw_blob_key": raw_blob_key,
            "created_by": created_by,
            "row_count": 0,
            "error_count": 0,
        }

    def add_record(self, *, batch_id: str, record: CatalogRecord) -> None:
        self.records.append(record)

    def add_row_error(self, *, batch_id: str, error: ImportRowError) -> None:
        self.errors.append(error)

    def finalize_batch(self, *, batch_id: str, row_count: int, error_count: int) -> None:
        self.batches[batch_id]["row_count"] = row_count
        self.batches[batch_id]["error_count"] = error_count

    def get_batch(self, *, tenant_id: str, batch_id: str) -> ImportBatchSummary | None:
        raise NotImplementedError


_CSV = b"mpn,description\nABC-123,A valve\n,Missing mpn\nDEF-456,Another valve\n"


def test_ingest_writes_the_raw_bytes_to_the_blob_store() -> None:
    blob_store = _FakeBlobStore()
    repo = _FakeImportRepo()

    result = ingest_csv_batch(
        tenant_id="tenant_demo",
        filename="import.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=blob_store,
        repo=repo,
    )

    assert len(blob_store.put_calls) == 1
    key, data = blob_store.put_calls[0]
    assert result.batch_id in key
    assert data == _CSV


def test_ingest_persists_only_valid_rows_as_records() -> None:
    repo = _FakeImportRepo()
    result = ingest_csv_batch(
        tenant_id="tenant_demo",
        filename="import.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=_FakeBlobStore(),
        repo=repo,
    )

    assert len(repo.records) == 2
    assert result.imported_count == 2
    assert result.error_count == 1
    assert result.row_count == 3


def test_ingest_records_the_row_error_via_the_repo() -> None:
    repo = _FakeImportRepo()
    ingest_csv_batch(
        tenant_id="tenant_demo",
        filename="import.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=_FakeBlobStore(),
        repo=repo,
    )

    assert len(repo.errors) == 1
    assert repo.errors[0].error_code == "MISSING_MPN"


def test_ingest_finalizes_the_batch_with_final_counts() -> None:
    repo = _FakeImportRepo()
    result = ingest_csv_batch(
        tenant_id="tenant_demo",
        filename="import.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=_FakeBlobStore(),
        repo=repo,
    )

    assert repo.batches[result.batch_id]["row_count"] == 3
    assert repo.batches[result.batch_id]["error_count"] == 1


def test_each_call_generates_a_distinct_batch_id() -> None:
    repo = _FakeImportRepo()
    first = ingest_csv_batch(
        tenant_id="t",
        filename="a.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=_FakeBlobStore(),
        repo=repo,
    )
    second = ingest_csv_batch(
        tenant_id="t",
        filename="a.csv",
        raw_bytes=_CSV,
        created_by="tester",
        created_at="2026-08-14T00:00:00Z",
        blob_store=_FakeBlobStore(),
        repo=repo,
    )
    assert first.batch_id != second.batch_id
