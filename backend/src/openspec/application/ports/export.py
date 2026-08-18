"""`ExportTarget` — the generic export port (UH7, ADR-0010). Format-agnostic
by design: a target knows how to serialise `(column_order, rows)` into
bytes, and nothing about *what* the columns mean. The Delivery Format
projection (deciding which internal attribute becomes which of the 252
columns) is a separate concern —
`infrastructure/export/delivery_format_projection.py` — kept out of this
port so a future JSON/XLSX target or a CX1-specific field-mapping adapter
(ADR-0010's "CX1 adapter is a field-mapping configuration over the generic
export, not bespoke code") can reuse it unchanged.
"""

from __future__ import annotations

from typing import Protocol


class ExportTarget(Protocol):
    def export_rows(
        self, rows: tuple[dict[str, str], ...], column_order: tuple[str, ...]
    ) -> bytes: ...
