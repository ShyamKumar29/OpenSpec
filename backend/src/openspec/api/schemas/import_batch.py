"""Wire DTOs for `POST /records/import` / `GET /records/import/{batch_id}`
(docs/api.md §Records)."""

from __future__ import annotations

from pydantic import BaseModel

from openspec.application.ports.import_repository import ImportBatchSummary, ImportRowError
from openspec.application.usecases.ingest_batch import IngestBatchResult


class ImportRowErrorOut(BaseModel):
    row_number: int
    raw_row: str
    error_code: str
    message: str


def _row_error_out(e: ImportRowError) -> ImportRowErrorOut:
    return ImportRowErrorOut(
        row_number=e.row_number, raw_row=e.raw_row, error_code=e.error_code, message=e.message
    )


class ImportBatchAcceptedOut(BaseModel):
    """`POST /records/import`'s `202` body (docs/api.md: "-> 202 + batch_id").
    Synchronous in this milestone (no queue/worker yet, docs/15-backend-
    implementation-status.md §4) but still shaped as `202` + a pollable
    `GET /records/import/{batch_id}`, so a future async worker is a
    behavior change behind the same contract, not a breaking one."""

    batch_id: str
    row_count: int
    imported_count: int
    error_count: int
    errors: list[ImportRowErrorOut]


def import_accepted_from_result(result: IngestBatchResult) -> ImportBatchAcceptedOut:
    return ImportBatchAcceptedOut(
        batch_id=result.batch_id,
        row_count=result.row_count,
        imported_count=result.imported_count,
        error_count=result.error_count,
        errors=[_row_error_out(e) for e in result.errors],
    )


class ImportBatchStatusOut(BaseModel):
    """`GET /records/import/{batch_id}` (docs/api.md: "Batch status, row
    counts, error report link"). No separate downloadable artifact in this
    milestone — `errors[]` inline is the error report."""

    id: str
    filename: str
    row_count: int
    error_count: int
    created_at: str
    errors: list[ImportRowErrorOut]


def import_batch_status_from_domain(summary: ImportBatchSummary) -> ImportBatchStatusOut:
    return ImportBatchStatusOut(
        id=summary.id,
        filename=summary.filename,
        row_count=summary.row_count,
        error_count=summary.error_count,
        created_at=summary.created_at,
        errors=[_row_error_out(e) for e in summary.errors],
    )
