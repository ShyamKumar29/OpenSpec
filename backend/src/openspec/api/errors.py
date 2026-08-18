"""RFC 9457 `application/problem+json` (docs/api.md §Conventions). Domain error ->
HTTP mapping lives here and nowhere else — routers raise domain exceptions or FastAPI
`HTTPException`s; this module is the only place that knows the wire shape.
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from openspec.domain.errors import InvariantViolation


def correlation_id_for(request: Request) -> str:
    """Reads the id the `X-Correlation-Id` middleware (`api/main.py`) already
    attached to this request, so a problem+json body and its response header always
    agree — falls back to a fresh id only if called outside that middleware (e.g. a
    unit test constructing a bare `Request`)."""
    existing = getattr(request.state, "correlation_id", None)
    return existing if isinstance(existing, str) else str(uuid.uuid4())


def problem(
    *, status: int, title: str, detail: str, code: str, correlation_id: str
) -> JSONResponse:
    body = {
        "type": f"https://openspec.dev/errors/{code.lower().replace('_', '-')}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "correlation_id": correlation_id,
    }
    return JSONResponse(status_code=status, content=body, media_type="application/problem+json")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(InvariantViolation)
    async def _invariant_violation(request: Request, exc: InvariantViolation) -> JSONResponse:
        # A contract breach — CLAUDE.md: "crash loudly", but an API boundary can't
        # actually crash the process, so the loud version here is a 500 that names
        # the invariant rather than a generic error page.
        return problem(
            status=500,
            title="Invariant violation",
            detail=str(exc),
            code="INVARIANT_VIOLATION",
            correlation_id=correlation_id_for(request),
        )
