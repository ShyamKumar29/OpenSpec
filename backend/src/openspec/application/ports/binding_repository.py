"""`BindingRepository` — read/write port for `document_binding` rows behind
`POST /records/{id}/bindings` (manual attach, `HUMAN` provenance) and
`DELETE /records/{id}/bindings/{binding_id}` (soft detach) — `docs/api.md`
§Documents. Distinct from `RecordRepository`'s existing read-only `bindings` field
on `RecordDetail` (a live projection); this port is where a binding is actually
created or detached (INV-8: soft, never a hard delete).
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.model.document import DocumentBinding


class BindingRepository(Protocol):
    def list_bindings(self, *, tenant_id: str, record_id: str) -> tuple[DocumentBinding, ...]: ...

    def attach_binding(self, *, tenant_id: str, binding: DocumentBinding) -> None: ...

    def detach_binding(self, *, tenant_id: str, record_id: str, binding_id: str) -> bool:
        """Soft-detaches (INV-8: no hard delete anywhere). Returns `True` if a
        matching, still-attached binding was found and detached; `False` if no such
        binding exists (or it was already detached) — the API layer turns `False`
        into `404`, never a silent no-op success."""
        ...
