"""Pure gold-set row validation (`EVL`, M1 brief §5: "Define a typed
gold-set representation. Validate: required identifier, expected columns,
duplicate identifiers, malformed rows, missing expected fields, invalid
values."). Takes already-parsed raw rows (I/O for reading the underlying
file lives in `infrastructure/reference_data/gold_set.py`) and either
returns a validated `GoldSet` or a tuple of structured errors — never raises
for an expected-shape problem; a malformed gold file is data to report, not
a system fault (INV-6).
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.gold import GoldLabel, GoldSet

REQUIRED_COLUMNS = ("record_id", "field", "expected_value", "expected_unknown_reason", "is_real")


@dataclass(frozen=True, slots=True)
class GoldRowError:
    """One structured validation failure. `row_number` is 1-based over the
    data rows (excluding the header), matching how a spreadsheet-literate
    reviewer would count rows."""

    row_number: int
    code: str  # "MISSING_COLUMN" | "MALFORMED_ROW" | "DUPLICATE_IDENTIFIER" | "INVALID_VALUE"
    detail: str

    def render(self) -> str:
        return f"row {self.row_number}: {self.code} — {self.detail}"


def validate_gold_rows(
    rows: tuple[dict[str, str], ...], *, source_name: str, label_version: str
) -> tuple[GoldSet | None, tuple[GoldRowError, ...]]:
    """Returns `(GoldSet, ())` when every row is valid, or `(None, errors)`
    otherwise — never a partially-valid `GoldSet` silently dropping the bad
    rows. A caller that wants "load what's valid, report the rest" is
    exactly the failure mode this function is designed to prevent: an
    `INVALID_GOLD_SET` result must be all-or-nothing so a corrupted file can
    never quietly score against fewer rows than it claims to have."""
    errors: list[GoldRowError] = []
    labels: list[GoldLabel] = []
    seen: dict[tuple[str, str], int] = {}

    for i, row in enumerate(rows, start=1):
        missing = [c for c in REQUIRED_COLUMNS if c not in row]
        if missing:
            errors.append(
                GoldRowError(
                    row_number=i, code="MISSING_COLUMN", detail=f"missing columns: {missing}"
                )
            )
            continue

        record_id = row["record_id"].strip()
        field = row["field"].strip()
        if not record_id or not field:
            errors.append(
                GoldRowError(
                    row_number=i,
                    code="MALFORMED_ROW",
                    detail="record_id and field must both be non-blank",
                )
            )
            continue

        key = (record_id, field)
        if key in seen:
            errors.append(
                GoldRowError(
                    row_number=i,
                    code="DUPLICATE_IDENTIFIER",
                    detail=f"(record_id, field)={key!r} already seen at row {seen[key]}",
                )
            )
            continue
        seen[key] = i

        is_real_raw = row["is_real"].strip().lower()
        if is_real_raw not in {"true", "false"}:
            errors.append(
                GoldRowError(
                    row_number=i,
                    code="INVALID_VALUE",
                    detail=f"is_real must be 'true' or 'false', got {row['is_real']!r}",
                )
            )
            continue

        expected_value = row["expected_value"].strip() or None
        expected_unknown_reason = row["expected_unknown_reason"].strip() or None
        try:
            labels.append(
                GoldLabel(
                    record_id=record_id,
                    field=field,
                    expected_value=expected_value,
                    expected_unknown_reason=expected_unknown_reason,
                    is_real=is_real_raw == "true",
                )
            )
        except InvariantViolation as exc:
            errors.append(GoldRowError(row_number=i, code="INVALID_VALUE", detail=str(exc)))

    if errors or not labels:
        if not errors and not labels:
            errors.append(
                GoldRowError(row_number=0, code="MALFORMED_ROW", detail="no rows supplied")
            )
        return None, tuple(errors)
    return GoldSet(labels=tuple(labels), source_name=source_name, label_version=label_version), ()
