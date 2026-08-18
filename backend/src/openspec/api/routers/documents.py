"""`GET /documents`, `GET /documents/{version_id}`, `GET /documents/{version_id}/regions`,
`GET /documents/{version_id}/pages/{n}/image`, `POST /documents`,
`POST /records/{id}/bindings`, `DELETE /records/{id}/bindings/{binding_id}`
(`docs/api.md` §Documents). Thin: validation, DI, serialisation only
(`docs/05-backend.md` §1) — orchestration lives in `application/usecases/`.
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

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
from openspec.api.errors import correlation_id_for, problem
from openspec.api.schemas.document import (
    document_binding_from_domain,
    document_detail_from_domain,
    document_region_from_domain,
    document_summary_from_domain,
)
from openspec.application.ports.binding_repository import BindingRepository
from openspec.application.ports.blob import BlobStore
from openspec.application.ports.document_repository import (
    DocumentIngestRepository,
    DocumentListFilters,
    DocumentRepository,
)
from openspec.application.ports.parser import DocumentParser
from openspec.application.ports.rasterizer import PageRasterizer, RasterizeError
from openspec.application.ports.repositories import RecordRepository
from openspec.application.usecases.ingest_document import ingest_document
from openspec.application.usecases.render_page_image import render_page_image
from openspec.config.settings import get_settings
from openspec.domain.model.document import (
    BindingMethod,
    BindingStatus,
    DocType,
    DocumentBinding,
    ParseStatus,
)

router = APIRouter(tags=["documents"])

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


@router.get("/documents")
def list_documents(
    repo: Annotated[DocumentRepository, Depends(get_document_repository)],
    cursor: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    publisher: str | None = None,
    parse_status: str | None = None,
    bound_count: str | None = None,
) -> dict[str, object]:
    tenant_id = get_settings().default_tenant_id
    offset = _decode_cursor(cursor)
    filters = DocumentListFilters(
        publisher=publisher,
        parse_status=ParseStatus(parse_status) if parse_status else None,
        bound_count=bound_count,
    )
    page, next_offset = repo.list_summaries(
        tenant_id=tenant_id, cursor=offset, limit=limit, filters=filters
    )
    return {
        "items": [document_summary_from_domain(s).model_dump() for s in page],
        "next_cursor": _encode_cursor(next_offset) if next_offset is not None else None,
    }


@router.get("/documents/{version_id}")
def get_document(
    version_id: str,
    request: Request,
    repo: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> dict[str, object] | object:
    tenant_id = get_settings().default_tenant_id
    detail = repo.get_detail(tenant_id=tenant_id, document_version_id=version_id)
    if detail is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"Document version '{version_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    return document_detail_from_domain(detail).model_dump()


@router.get("/documents/{version_id}/regions")
def get_document_regions(
    version_id: str,
    request: Request,
    repo: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> dict[str, object] | object:
    regions = repo.get_regions(document_version_id=version_id)
    if regions is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"Document version '{version_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    return {"regions": [document_region_from_domain(r).model_dump() for r in regions]}


@router.get("/documents/{version_id}/pages/{n}/image", response_model=None)
def get_document_page_image(
    version_id: str,
    n: int,
    request: Request,
    repo: Annotated[DocumentRepository, Depends(get_document_repository)],
    blob_store: Annotated[BlobStore, Depends(get_blob_store)],
    rasterizer: Annotated[PageRasterizer, Depends(get_page_rasterizer)],
) -> Response | object:
    tenant_id = get_settings().default_tenant_id
    detail = repo.get_detail(tenant_id=tenant_id, document_version_id=version_id)
    if detail is None or not any(p.n == n for p in detail.pages):
        return problem(
            status=404,
            title="Not found",
            detail=f"Page {n} of document version '{version_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    blob_key = repo.get_blob_key(document_version_id=version_id)
    if blob_key is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"No stored bytes for document version '{version_id}'.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    content = blob_store.get(key=blob_key)
    try:
        png_bytes = render_page_image(
            content_hash=detail.content_hash,
            content=content,
            page=n,
            rasterizer=rasterizer,
            blob_store=blob_store,
        )
    except RasterizeError as exc:
        return problem(
            status=422,
            title="Cannot render page",
            detail=str(exc),
            code="DOC_PAGE_RENDER_FAILED",
            correlation_id=correlation_id_for(request),
        )
    return Response(content=png_bytes, media_type="image/png")


@router.post("/documents")
async def upload_document(
    request: Request,
    document_repo: Annotated[DocumentIngestRepository, Depends(get_document_ingest_repository)],
    blob_store: Annotated[BlobStore, Depends(get_blob_store)],
    parser: Annotated[DocumentParser, Depends(get_document_parser)],
    file: Annotated[UploadFile, File()],
    publisher: Annotated[str, Form()],
    title: Annotated[str, Form()],
    doc_type: Annotated[str, Form()] = "spec_sheet",
    source_url: Annotated[str | None, Form()] = None,
) -> dict[str, object] | object:
    tenant_id = get_settings().default_tenant_id
    try:
        resolved_doc_type = DocType(doc_type)
    except ValueError:
        return problem(
            status=422,
            title="Validation failed",
            detail=f"doc_type must be one of {[d.value for d in DocType]}",
            code="DOC_INVALID_TYPE",
            correlation_id=correlation_id_for(request),
        )
    raw_bytes = await file.read()
    result = ingest_document(
        tenant_id=tenant_id,
        publisher=publisher,
        title=title,
        doc_type=resolved_doc_type,
        source_url=source_url,
        content=raw_bytes,
        created_at=datetime.now(UTC).isoformat(),
        blob_store=blob_store,
        parser=parser,
        document_repo=document_repo,
        parse_cache=get_parse_cache(),
    )
    body = {
        "document_version_id": result.version.id,
        "parse_status": result.version.parse_status.value,
        "already_existed": result.already_existed,
        "parse_failure_reason": result.parse_failure_reason,
    }
    return JSONResponse(status_code=202, content=body)


class AttachBindingIn(BaseModel):
    document_version_id: str
    region_id: str | None = None
    confidence: float = 1.0


@router.post("/records/{record_id}/bindings")
def attach_binding(
    record_id: str,
    body: AttachBindingIn,
    request: Request,
    record_repo: Annotated[RecordRepository, Depends(get_record_repository)],
    binding_repo: Annotated[BindingRepository, Depends(get_binding_repository)],
) -> dict[str, object] | object:
    """Manual attach (`docs/api.md` §Documents), `HUMAN` provenance — always
    `ACCEPTED` (a human made the call; `DocumentBinding`'s own structural guard
    already permits `HUMAN` at the auto-accept bar, `domain/model/document.py`)."""
    tenant_id = get_settings().default_tenant_id
    if record_repo.get_detail(tenant_id=tenant_id, record_id=record_id) is None:
        return problem(
            status=404,
            title="Not found",
            detail=f"Record '{record_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    binding = DocumentBinding(
        id=f"binding_human_{record_id}_{body.document_version_id}_{datetime.now(UTC).timestamp():.0f}",
        record_id=record_id,
        document_version_id=body.document_version_id,
        region_id=body.region_id,
        confidence=body.confidence,
        signals={"manual_attach": True},
        method=BindingMethod.HUMAN,
        status=BindingStatus.ACCEPTED,
        created_by_kind="human",
        created_at=datetime.now(UTC).isoformat(),
    )
    binding_repo.attach_binding(tenant_id=tenant_id, binding=binding)
    return JSONResponse(status_code=201, content=document_binding_from_domain(binding).model_dump())


@router.delete("/records/{record_id}/bindings/{binding_id}", response_model=None)
def detach_binding(
    record_id: str,
    binding_id: str,
    request: Request,
    binding_repo: Annotated[BindingRepository, Depends(get_binding_repository)],
) -> Response | object:
    tenant_id = get_settings().default_tenant_id
    detached = binding_repo.detach_binding(
        tenant_id=tenant_id, record_id=record_id, binding_id=binding_id
    )
    if not detached:
        return problem(
            status=404,
            title="Not found",
            detail=f"Binding '{binding_id}' on record '{record_id}' does not exist.",
            code="NOT_FOUND",
            correlation_id=correlation_id_for(request),
        )
    return Response(status_code=204)
