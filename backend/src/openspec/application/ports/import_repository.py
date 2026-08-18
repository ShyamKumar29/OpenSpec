"""`ImportBatchRepository` — the write-side port `ING` needs
(`application/ports/repositories.py`'s own docstring already flagged this as
"added when `RVW`/`ING` use cases land", docs/13-implementation-blueprint.md
step 8). Distinct from `RecordRepository` (read-only) rather than widening
that Protocol, so a caller that only needs `GET /records` still only depends
on the read surface — the same "small, specific ports" discipline
`manufacturer_brand.py`/`taxonomy.py` already establish for this codebase.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from openspec.domain.model.record import CatalogRecord


@dataclass(frozen=True, slots=True)
class ImportRowError:
    """`import_error` (docs/04-data-model.md §3.1): `row_number`, `raw_row`,
    `error_code`, `message`. `error_code` is a closed set —
    `application/stages/ing.py`'s `ImportRowErrorCode` — not free text."""

    row_number: int
    raw_row: str
    error_code: str
    message: str


@dataclass(frozen=True, slots=True)
class ImportBatchSummary:
    """`import_batch` (docs/04-data-model.md §3.1) plus its `import_error`
    rows, for `GET /records/import/{batch_id}` (docs/api.md §Records:
    "Batch status, row counts, error report link")."""

    id: str
    tenant_id: str
    filename: str
    row_count: int
    error_count: int
    created_at: str
    errors: tuple[ImportRowError, ...]


class ImportBatchRepository(Protocol):
    def create_batch(
        self, *, id: str, tenant_id: str, filename: str, raw_blob_key: str, created_by: str
    ) -> None: ...

    def add_record(self, *, batch_id: str, record: CatalogRecord) -> None:
        """Persists one successfully-mapped-and-validated row as a new
        `CatalogRecord` — unenriched (no class, no attribute values; those
        are `CLS`/`EXT`'s job, not built yet per docs/15-backend-
        implementation-status.md §4). `CatalogRecord` is immutable
        (docs/04-data-model.md §3.1: "Never mutated") — this is an insert,
        never an update."""
        ...

    def add_row_error(self, *, batch_id: str, error: ImportRowError) -> None: ...

    def finalize_batch(self, *, batch_id: str, row_count: int, error_count: int) -> None: ...

    def get_batch(self, *, tenant_id: str, batch_id: str) -> ImportBatchSummary | None: ...
