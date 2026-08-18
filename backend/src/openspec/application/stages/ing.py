"""`ING` — CSV import with column mapping and per-row error reporting
(docs/10-roadmap.md M0; docs/01-requirements.md FR-ING-1…9). Operates on an
already-decoded CSV string already resident in memory (the upload's bytes,
decoded by the caller) — no filesystem or network I/O here, the same "takes
primitive data, not a loaded resource" shape `application/stages/ext.py`
already establishes for this codebase's stage files.

**Scoped to CSV only for M0** — docs/10-roadmap.md's M0 deliverable bullet
says "CSV import with column mapping, per-row error reporting" (narrower than
FR-ING-1's "CSV/XLSX + REST intake"); XLSX intake is a straightforward
follow-on (an `openpyxl` adapter feeding the same `parse_csv_batch`-shaped
pipeline) deliberately left for when it's actually needed, per CLAUDE.md's
"if something is ambiguous, prefer... less output".
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from openspec.domain.errors import DomainAbstention
from openspec.domain.ing.mpn import canonicalize_mpn
from openspec.domain.model.record import CatalogRecord, Mpn

# canonical field -> accepted header aliases, case-insensitive. Covers this
# repo's own real supplier file (`Mfg_Part_Num`, `Part_Desc`,
# `resources/reference/unihack/sample_input.csv`) alongside generic aliases —
# not a guess, a union of every header this codebase has actually seen.
DEFAULT_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "mpn": ("mpn", "mfg_part_num", "part_number", "part_num", "manufacturer_part_number"),
    "description": ("description", "part_desc", "item_description", "desc"),
    "supplier_name": ("supplier", "supplier_name", "vendor", "part_manuf"),
}
REQUIRED_CANONICAL_FIELDS = ("mpn", "description")


class ImportRowErrorCode:
    """Closed set (docs/api.md's error-shape convention: `code` is not free
    text). Mirrors `import_error.error_code` (docs/04-data-model.md §3.1)."""

    MALFORMED_ROW = "MALFORMED_ROW"
    MISSING_MPN = "MISSING_MPN"
    MISSING_DESCRIPTION = "MISSING_DESCRIPTION"
    DUPLICATE_MPN_IN_BATCH = "DUPLICATE_MPN_IN_BATCH"


class ColumnMappingUnresolved(Exception):
    """A required canonical field (`mpn`, `description`) could not be
    resolved from the header, explicit mapping, or default aliases — a
    whole-file failure (docs/api.md's `ING_MISSING_COLUMN` example), not a
    per-row one. Raised before any row is processed."""


@dataclass(frozen=True, slots=True)
class RowError:
    row_number: int  # 1-based, excluding header
    raw_row: str
    error_code: str
    message: str


@dataclass(frozen=True, slots=True)
class ParsedRow:
    row_number: int
    mpn: Mpn
    description_raw: str
    supplier_name: str | None


@dataclass(frozen=True, slots=True)
class IngestParseResult:
    column_mapping: dict[str, str]  # canonical field -> resolved header name
    rows: tuple[ParsedRow, ...]
    errors: tuple[RowError, ...]

    @property
    def row_count(self) -> int:
        return len(self.rows) + len(self.errors)


def resolve_column_mapping(
    header: tuple[str, ...], explicit_mapping: dict[str, str] | None = None
) -> dict[str, str]:
    """`explicit_mapping` (canonical field -> header name, as supplied by the
    caller — docs/api.md's "column mapping") takes precedence; unmapped
    canonical fields fall back to `DEFAULT_COLUMN_ALIASES`, matched
    case-insensitively against `header`.

    Raises `ColumnMappingUnresolved` if `mpn` or `description` can't be
    resolved either way."""
    header_by_lower = {h.strip().lower(): h for h in header}
    resolved: dict[str, str] = {}

    for field, requested_header in (explicit_mapping or {}).items():
        if requested_header not in header:
            raise ColumnMappingUnresolved(
                f"column_mapping requested '{requested_header}' for field '{field}', "
                f"but the file's header is {header}"
            )
        resolved[field] = requested_header

    for field, aliases in DEFAULT_COLUMN_ALIASES.items():
        if field in resolved:
            continue
        for alias in aliases:
            if alias in header_by_lower:
                resolved[field] = header_by_lower[alias]
                break

    missing = [f for f in REQUIRED_CANONICAL_FIELDS if f not in resolved]
    if missing:
        raise ColumnMappingUnresolved(
            f"could not resolve required column(s) {missing} from header {header} "
            "— supply an explicit column_mapping"
        )
    return resolved


def parse_csv_batch(
    raw_text: str, *, explicit_mapping: dict[str, str] | None = None
) -> IngestParseResult:
    """Pure over its inputs (no I/O): `raw_text` is already-decoded CSV.
    Produces `ParsedRow`s, not `CatalogRecord`s — record ids/timestamps are
    assigned by `build_catalog_record` below, kept separate so this function
    stays free of any clock/UUID dependency (INV-6's "no clock" spirit,
    applied one layer up — this is `application/`, not `domain/`, but the
    same determinism discipline keeps it unit-testable on fixed input alone).
    """
    reader = csv.reader(io.StringIO(raw_text))
    try:
        header = tuple(next(reader))
    except StopIteration:
        return IngestParseResult(column_mapping={}, rows=(), errors=())

    mapping = resolve_column_mapping(header, explicit_mapping)
    header_index = {name: idx for idx, name in enumerate(header)}
    mpn_idx = header_index[mapping["mpn"]]
    desc_idx = header_index[mapping["description"]]
    supplier_idx = header_index.get(mapping.get("supplier_name", ""))

    rows: list[ParsedRow] = []
    errors: list[RowError] = []
    seen_canonical_mpns: set[str] = set()

    for row_number, raw_row in enumerate(reader, start=1):
        raw_row_text = ",".join(raw_row)
        if len(raw_row) != len(header):
            errors.append(
                RowError(
                    row_number=row_number,
                    raw_row=raw_row_text,
                    error_code=ImportRowErrorCode.MALFORMED_ROW,
                    message=f"expected {len(header)} columns, got {len(raw_row)}",
                )
            )
            continue

        mpn_raw = raw_row[mpn_idx]
        description_raw = raw_row[desc_idx]
        supplier_name = raw_row[supplier_idx] if supplier_idx is not None else None

        if not description_raw.strip():
            errors.append(
                RowError(
                    row_number=row_number,
                    raw_row=raw_row_text,
                    error_code=ImportRowErrorCode.MISSING_DESCRIPTION,
                    message="description column is blank",
                )
            )
            continue

        try:
            canonical = canonicalize_mpn(mpn_raw)
        except DomainAbstention:
            errors.append(
                RowError(
                    row_number=row_number,
                    raw_row=raw_row_text,
                    error_code=ImportRowErrorCode.MISSING_MPN,
                    message="mpn column is blank or has no alphanumeric characters",
                )
            )
            continue

        if canonical in seen_canonical_mpns:
            errors.append(
                RowError(
                    row_number=row_number,
                    raw_row=raw_row_text,
                    error_code=ImportRowErrorCode.DUPLICATE_MPN_IN_BATCH,
                    message=f"MPN '{mpn_raw}' (canonical '{canonical}') already seen in this batch",
                )
            )
            continue
        seen_canonical_mpns.add(canonical)

        rows.append(
            ParsedRow(
                row_number=row_number,
                mpn=Mpn(raw=mpn_raw, canonical=canonical),
                description_raw=description_raw,
                supplier_name=supplier_name.strip() if supplier_name else None,
            )
        )

    return IngestParseResult(column_mapping=mapping, rows=tuple(rows), errors=tuple(errors))


def build_catalog_record(
    row: ParsedRow, *, tenant_id: str, source_batch_id: str, created_at: str, id_prefix: str
) -> CatalogRecord:
    return CatalogRecord(
        id=f"{id_prefix}_{row.row_number}",
        tenant_id=tenant_id,
        mpn=row.mpn,
        description_raw=row.description_raw,
        supplier_name=row.supplier_name,
        source_batch_id=source_batch_id,
        created_at=created_at,
    )
