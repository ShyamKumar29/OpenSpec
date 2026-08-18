"""`ingest_csv_batch` — the ING use case (docs/13-implementation-blueprint.md
step 8: "First vertical slice (ING)"). Orchestrates: decode -> parse/validate
(pure, `application/stages/ing.py`) -> persist raw bytes (`BlobStore`) ->
persist the batch + successfully-mapped rows + per-row errors
(`ImportBatchRepository`). No business rule lives here — matches
docs/05-backend.md §1's "use cases: orchestration, no business rules".
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from openspec.application.ports.blob import BlobStore
from openspec.application.ports.import_repository import ImportBatchRepository, ImportRowError
from openspec.application.stages.ing import build_catalog_record, parse_csv_batch


@dataclass(frozen=True, slots=True)
class IngestBatchResult:
    batch_id: str
    row_count: int
    imported_count: int
    error_count: int
    errors: tuple[ImportRowError, ...]


def ingest_csv_batch(
    *,
    tenant_id: str,
    filename: str,
    raw_bytes: bytes,
    created_by: str,
    created_at: str,
    blob_store: BlobStore,
    repo: ImportBatchRepository,
    explicit_mapping: dict[str, str] | None = None,
) -> IngestBatchResult:
    batch_id = str(uuid.uuid4())
    raw_text = raw_bytes.decode("utf-8-sig")

    parsed = parse_csv_batch(raw_text, explicit_mapping=explicit_mapping)

    blob_key = blob_store.put(key=f"import_batches/{batch_id}/{filename}", data=raw_bytes)
    repo.create_batch(
        id=batch_id,
        tenant_id=tenant_id,
        filename=filename,
        raw_blob_key=blob_key,
        created_by=created_by,
    )

    for row in parsed.rows:
        record = build_catalog_record(
            row,
            tenant_id=tenant_id,
            source_batch_id=batch_id,
            created_at=created_at,
            id_prefix=f"rec_{batch_id}",
        )
        repo.add_record(batch_id=batch_id, record=record)

    port_errors = tuple(
        ImportRowError(
            row_number=e.row_number,
            raw_row=e.raw_row,
            error_code=e.error_code,
            message=e.message,
        )
        for e in parsed.errors
    )
    for error in port_errors:
        repo.add_row_error(batch_id=batch_id, error=error)

    repo.finalize_batch(
        batch_id=batch_id, row_count=parsed.row_count, error_count=len(parsed.errors)
    )

    return IngestBatchResult(
        batch_id=batch_id,
        row_count=parsed.row_count,
        imported_count=len(parsed.rows),
        error_count=len(parsed.errors),
        errors=port_errors,
    )
