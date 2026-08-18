"""`CsvExportTarget` — the generic CSV implementation of
`application.ports.export.ExportTarget` (UH7, ADR-0010: "Generic CSV/JSON/XLSX
adapters ship first"). Knows nothing about the Delivery Format specifically —
any `(column_order, rows)` pair serialises the same way.
"""

from __future__ import annotations

import csv
import io


class CsvExportTarget:
    def export_rows(self, rows: tuple[dict[str, str], ...], column_order: tuple[str, ...]) -> bytes:
        buffer = io.StringIO(newline="")
        writer = csv.DictWriter(buffer, fieldnames=list(column_order), lineterminator="\r\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return buffer.getvalue().encode("utf-8")
