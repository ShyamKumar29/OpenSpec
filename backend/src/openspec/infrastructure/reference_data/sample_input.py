"""Loads `resources/reference/unihack/sample_input.csv` — the supplied 1,000-row
supplier input corpus (`docs/16-unilog-alignment.md` UH0). Six columns
(`Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf`),
verified against the actual file, not assumed.

**Placeholders are detected, never stripped.** `docs/16-unilog-alignment.md` UH0's
one-line summary says to strip placeholder brand values at load time; the fuller UH0
brief for this session (§6) is more specific and takes precedence here: retain the
source value always, and record *whether* it matched a known placeholder as separate
metadata, deferring the "should a placeholder be excluded from candidates" decision
to `RES` (UH2) — this loader has no opinion on manufacturer/brand resolution.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from openspec.infrastructure.reference_data.errors import (
    ReferenceDataMalformedRow,
    ReferenceDataMissing,
    ReferenceDataSchemaDrift,
)

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_SAMPLE_INPUT_PATH = _RESOURCES_ROOT / "reference" / "unihack" / "sample_input.csv"

EXPECTED_COLUMNS = (
    "Mfg_Part_Num",
    "Part_Desc",
    "E1_Brand",
    "Unilog_Brand",
    "DIB_Brand",
    "Part_Manuf",
)

# Verified by inspecting the actual file (`README.md` in the same resource
# directory), not assumed from the brief's wording — every brand column's blank
# convention is one of these three tokens rather than an empty string.
KNOWN_BRAND_PLACEHOLDERS = frozenset(
    {"-- Unbranded --", "-- No Unilog Brand --", "-- No DIB Brand --"}
)
# `Part_Manuf` uses a different, single-character placeholder for "no manufacturer
# resolved" — also verified by inspection, distinct from the brand columns' tokens.
KNOWN_PART_MANUF_PLACEHOLDER = "-"


@dataclass(frozen=True, slots=True)
class SupplierInputRow:
    row_number: int  # 1-based, excluding header — for tracing back to the source file
    mfg_part_num: str
    part_desc: str
    e1_brand: str
    unilog_brand: str
    dib_brand: str
    part_manuf: str

    @property
    def e1_brand_is_placeholder(self) -> bool:
        return self.e1_brand in KNOWN_BRAND_PLACEHOLDERS

    @property
    def unilog_brand_is_placeholder(self) -> bool:
        return self.unilog_brand in KNOWN_BRAND_PLACEHOLDERS

    @property
    def dib_brand_is_placeholder(self) -> bool:
        return self.dib_brand in KNOWN_BRAND_PLACEHOLDERS

    @property
    def part_manuf_is_placeholder(self) -> bool:
        return self.part_manuf == KNOWN_PART_MANUF_PLACEHOLDER


def load_sample_input_rows(
    path: Path = DEFAULT_SAMPLE_INPUT_PATH,
) -> tuple[SupplierInputRow, ...]:
    if not path.exists():
        raise ReferenceDataMissing(f"Sample Input file not found: {path}")

    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration as exc:
            raise ReferenceDataSchemaDrift(f"{path} is empty — no header row") from exc

        if tuple(header) != EXPECTED_COLUMNS:
            raise ReferenceDataSchemaDrift(
                f"sample_input.csv header changed. Expected {EXPECTED_COLUMNS}, got {tuple(header)}"
            )

        rows: list[SupplierInputRow] = []
        for row_number, raw_row in enumerate(reader, start=1):
            if len(raw_row) != len(EXPECTED_COLUMNS):
                raise ReferenceDataMalformedRow(
                    f"sample_input.csv row {row_number} has {len(raw_row)} fields, "
                    f"expected {len(EXPECTED_COLUMNS)}"
                )
            mfg_part_num = raw_row[0]
            if not mfg_part_num.strip():
                raise ReferenceDataMalformedRow(
                    f"sample_input.csv row {row_number} has an empty Mfg_Part_Num"
                )
            rows.append(
                SupplierInputRow(
                    row_number=row_number,
                    mfg_part_num=mfg_part_num,
                    part_desc=raw_row[1],
                    e1_brand=raw_row[2],
                    unilog_brand=raw_row[3],
                    dib_brand=raw_row[4],
                    part_manuf=raw_row[5],
                )
            )
    return tuple(rows)
