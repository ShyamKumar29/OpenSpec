
"""`GET /records`, `GET /records/{id}` (docs/api.md §Records) — the first vertical
slice (docs/13-implementation-blueprint.md step 8). Thin: validation, DI, and
serialisation only — no business rules live here (docs/05-backend.md §1: "`api/`...
Thin. Validation + authz + serialisation only").
"""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse

from openspec.api.deps import get_blob_store, get_import_repository, get_record_repository
from openspec.api.errors import correlation_id_for, problem
from openspec.api.schemas.import_batch import (
    import_accepted_from_result,
    import_batch_status_from_domain,
)
from openspec.api.schemas.records import (
    record_detail_from_domain,
    record_summary_from_domain,
)
from openspec.application.ports.blob import BlobStore
from openspec.application.ports.import_repository import ImportBatchRepository
from openspec.application.ports.repositories import RecordRepository
from openspec.application.stages.ing import ColumnMappingUnresolved
from openspec.application.usecases.ingest_batch import ingest_csv_batch
from openspec.config.settings import get_settings

router = APIRouter(tags=["records"])

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


def _decode_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return max(0, int(base64.urlsafe_b64decode(cursor.encode()).decode()))
    except (ValueError, UnicodeDecodeError):
        return 0


def _encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(str(offset).encode()).decode()


@router.get("/records")
def list_records(
    repo: Annotated[RecordRepository, Depends(get_record_repository)],
    cursor: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> dict[str, object]:
    tenant_id = get_settings().default_tenant_id
    offset = _decode_cursor(cursor)
    page, next_offset = repo.list_summaries(tenant_id=tenant_id, cursor=offset, limit=limit)
    
    return {
        "items": [record_summary_from_domain(s).model_dump() for s in page],
        "next_cursor": _encode_cursor(next_offset) if next_offset is not None else None
    }
    

@router.get("/records/{record_id}")
def get_record(
    record_id: str,
    request: Request,
    repo: Annotated[RecordRepository, Depends(get_record_repository)],
) -> dict[str, object] | object:
    tenant_id = get_settings().default_tenant_id
    detail = repo.get_detail(tenant_id=tenant_id, record_id=record_id)
    if detail is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"Record '{record_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    return record_detail_from_domain(detail).to_wire()


@router.post("/records/import")
async def import_records(
    request: Request,
    repo: Annotated[ImportBatchRepository, Depends(get_import_repository)],
    blob_store: Annotated[BlobStore, Depends(get_blob_store)],
    file: Annotated[UploadFile, File()],
    column_mapping: Annotated[str | None, Form()] = None,
) -> dict[str, object] | object:
    """`POST /records/import` (docs/api.md §Records): multipart CSV upload +
    optional column mapping -> batch summary. Synchronous today (no
    queue/worker yet — docs/15-backend-implementation-status.md §4), but
    shaped as the documented `202` + pollable status so a future async
    worker doesn't change the contract, only when the body becomes available."""
    tenant_id = get_settings().default_tenant_id
    raw_bytes = await file.read()

    explicit_mapping: dict[str, str] | None = None
    if column_mapping:
        try:
            explicit_mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            return problem(
                status=422,
                title="Validation failed",
                detail="column_mapping must be a JSON object of {canonical_field: header_name}.",
                code="ING_INVALID_COLUMN_MAPPING",
                correlation_id=correlation_id_for(request),
            )

    try:
        result = ingest_csv_batch(
            tenant_id=tenant_id,
            filename=file.filename or "upload.csv",
            raw_bytes=raw_bytes,
            created_by="api",
            created_at=datetime.now(UTC).isoformat(),
            blob_store=blob_store,
            repo=repo,
            explicit_mapping=explicit_mapping,
        )
    except ColumnMappingUnresolved as exc:
        return problem(
            status=422,
            title="Validation failed",
            detail=str(exc),
            code="ING_MISSING_COLUMN",
            correlation_id=correlation_id_for(request),
        )

    return JSONResponse(status_code=202, content=import_accepted_from_result(result).model_dump())


@router.get("/records/import/{batch_id}")
def get_import_batch(
    batch_id: str,
    request: Request,
    repo: Annotated[ImportBatchRepository, Depends(get_import_repository)],
) -> dict[str, object] | object:
    tenant_id = get_settings().default_tenant_id
    batch = repo.get_batch(tenant_id=tenant_id, batch_id=batch_id)
    if batch is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"Import batch '{batch_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    return import_batch_status_from_domain(batch).model_dump()
