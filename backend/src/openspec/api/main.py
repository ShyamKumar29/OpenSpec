"""FastAPI app factory (docs/api.md: base `/api/v1`). `create_app()` rather than a
module-level `app` so tests can build isolated instances if adapters ever need
per-test overrides (`app.dependency_overrides`).
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from openspec.api.routers import metrics, runs, review, records, attributes, documents

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from openspec.api.errors import register_exception_handlers
from openspec.api.routers.documents import router as documents_router
from openspec.api.routers.records import router as records_router

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    app = FastAPI(title="OpenSpec API", version="0.1.0")
    register_exception_handlers(app)
    app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

    @app.middleware("http")
    async def correlation_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # docs/api.md §Conventions: "Correlation | X-Correlation-Id echoed on every
        # response." Set once here so every handler and error path agrees on the id
        # (see `api/errors.py::correlation_id_for`).
        cid = request.headers.get("x-correlation-id") or str(uuid.uuid4())
        request.state.correlation_id = cid
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = cid
        return response

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(records_router, prefix=API_PREFIX)
    app.include_router(documents_router, prefix=API_PREFIX)
    app.include_router(attributes.router)
    app.include_router(documents.router)
    app.include_router(runs.router)
    from openspec.api.routers import metrics
    app.include_router(metrics.router)
    return app


app = create_app()
