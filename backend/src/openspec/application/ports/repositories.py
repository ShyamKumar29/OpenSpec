"""Repository ports (docs/05-backend.md §1, `application/ports/repositories.py`).

`application/` depends on these `Protocol`s, never on a concrete store — the
architecture test `test_application_never_imports_infrastructure` enforces that a
repository *implementation* can only live in `infrastructure/`. Two implementations
exist today: `infrastructure/memory` (in-process, used by the API in this milestone
and by tests — the same "fast, free, deterministic" role `CachedProvider` plays for
the LLM port per docs/05-backend.md §10 recommendation 3) and the Postgres-targeted
SQLAlchemy models in `infrastructure/db/models.py`, whose repository implementation
is the next milestone (`docs/15-backend-implementation-status.md`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from openspec.domain.model.attribute import AttributeValue
from openspec.domain.model.record import CatalogRecord, ClassRef
from openspec.domain.sch.completeness import Completeness

__all__ = [
    "BindingRef",
    "Completeness",
    "RecordDetail",
    "RecordRepository",
    "RecordSummary",
]


@dataclass(frozen=True, slots=True)
class RecordSummary:
    """`GET /records` list-item shape (docs/api.md §Records) — computed live from
    current attribute state, never a frozen snapshot (the F1/F5/F6 stale-aggregate
    lesson this project already learned once on the frontend mock; see
    `frontend/mocks/fixtures/store.ts`'s `liveRecordSummary`). Any repository
    implementation must recompute this on every read, not cache it."""

    record: CatalogRecord
    class_ref: ClassRef | None
    completeness: Completeness
    tier0_pending_count: int
    unknown_count: int
    has_document: bool


@dataclass(frozen=True, slots=True)
class BindingRef:
    """`GET /records/{id}` `bindings[]` (docs/api.md §Records)."""

    document_version_id: str
    region_id: str | None
    confidence: float
    signals: dict[str, object]


@dataclass(frozen=True, slots=True)
class RecordDetail:
    summary: RecordSummary
    attributes: tuple[AttributeValue, ...]
    bindings: tuple[BindingRef, ...]


class RecordRepository(Protocol):
    """Read side of the `catalog_record` + live `attribute_value` aggregate
    (docs/04-data-model.md §3.1, §3.4). Mutation (ingest, review decisions,
    reclassification) is a separate port — not needed by this milestone's
    read-only `GET /records` / `GET /records/{id}` slice, and added when
    `RVW`/`ING` use cases land (docs/13-implementation-blueprint.md step 8/14)."""

    def list_summaries(
        self, *, tenant_id: str, cursor: int, limit: int
    ) -> tuple[list[RecordSummary], int | None]:
        """Returns `(page, next_offset)`; `next_offset` is `None` at the end."""
        ...

    def get_detail(self, *, tenant_id: str, record_id: str) -> RecordDetail | None: ...
