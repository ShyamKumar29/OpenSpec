"""Loads `resources/reference/unihack/delivery_format.csv` — the 252-column export
target schema (`docs/16-unilog-alignment.md` §3, ADR-0014). This module produces a
**machine-readable representation of the schema only**; it does not build the export
adapter (`ExportTarget`, UH7) or the description builder (`DSC`, UH5).

The column list is never hand-typed here — it is parsed from the supplied CSV's
header row every time, which is what §9 of the UH0 brief asks for ("generate the
schema representation from the source rather than manually typing 252 values and
risking drift"). `scripts/generate_delivery_format_snapshot.py` freezes a copy of
that derived schema as a resource (`delivery_format.schema.json`); the test suite
compares the two so an accidental change to the header row fails loudly instead of
silently drifting.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from openspec.infrastructure.reference_data.errors import (
    ReferenceDataMissing,
    ReferenceDataSchemaDrift,
)

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_DELIVERY_FORMAT_PATH = _RESOURCES_ROOT / "reference" / "unihack" / "delivery_format.csv"

# A trailing " N" or "_N" on a column name marks it as the Nth member of a repeating
# group (e.g. "ATTRIBUTE_LABEL 7", "ITEM_FEATURES_12"). Purely structural — derived
# from the header text itself, not a hardcoded list of which columns repeat.
_GROUP_SUFFIX = re.compile(r"^(?P<base>.+?)[ _](?P<num>\d+)$")


@dataclass(frozen=True, slots=True)
class DeliveryFormatColumn:
    index: int
    name: str
    group_base: str | None  # e.g. "ATTRIBUTE_LABEL", None if this column doesn't repeat
    group_index: int | None  # the N in "ATTRIBUTE_LABEL N"


@dataclass(frozen=True, slots=True)
class AttributeSlot:
    """One of the 50 `(ATTRIBUTE_LABEL n, ATTRIBUTE_VALUE n, ATTRIBUTE_UOM n)`
    triples — the LOV-style label/value/UOM structure `docs/16-unilog-alignment.md`
    UH0 §3 calls out by name. Later milestones (UH4/UH5) fill these; UH0 only proves
    the slots exist and are contiguous."""

    index: int
    label_column: str
    value_column: str
    uom_column: str


@dataclass(frozen=True, slots=True)
class DeliveryFormatSchema:
    source_path: Path
    columns: tuple[DeliveryFormatColumn, ...]

    def column_names(self) -> tuple[str, ...]:
        return tuple(c.name for c in self.columns)

    def attribute_slots(self) -> tuple[AttributeSlot, ...]:
        by_index: dict[int, dict[str, str]] = {}
        for c in self.columns:
            if c.group_base in ("ATTRIBUTE_LABEL", "ATTRIBUTE_VALUE", "ATTRIBUTE_UOM"):
                assert c.group_index is not None
                by_index.setdefault(c.group_index, {})[c.group_base] = c.name
        slots = []
        for n in sorted(by_index):
            slot_cols = by_index[n]
            missing = {"ATTRIBUTE_LABEL", "ATTRIBUTE_VALUE", "ATTRIBUTE_UOM"} - slot_cols.keys()
            if missing:
                raise ReferenceDataSchemaDrift(
                    f"attribute slot {n} is missing column(s) {sorted(missing)} — "
                    "delivery_format.csv's header no longer forms complete "
                    "LABEL/VALUE/UOM triples"
                )
            slots.append(
                AttributeSlot(
                    index=n,
                    label_column=slot_cols["ATTRIBUTE_LABEL"],
                    value_column=slot_cols["ATTRIBUTE_VALUE"],
                    uom_column=slot_cols["ATTRIBUTE_UOM"],
                )
            )
        return tuple(slots)

    def item_features_columns(self) -> tuple[str, ...]:
        matches = [
            (c.group_index, c.name)
            for c in self.columns
            if c.group_base == "ITEM_FEATURES" and c.group_index is not None
        ]
        matches.sort(key=lambda pair: pair[0])
        return tuple(name for _, name in matches)


def _classify(name: str) -> tuple[str | None, int | None]:
    m = _GROUP_SUFFIX.match(name)
    if not m:
        return None, None
    return m.group("base"), int(m.group("num"))


def load_delivery_format_schema(
    path: Path = DEFAULT_DELIVERY_FORMAT_PATH,
) -> DeliveryFormatSchema:
    if not path.exists():
        raise ReferenceDataMissing(f"Delivery Format schema file not found: {path}")
    with path.open(encoding="utf-8-sig", newline="") as f:
        header = next(csv.reader(f))

    seen: dict[str, int] = {}
    duplicates: set[str] = set()
    for name in header:
        if name in seen:
            duplicates.add(name)
        seen[name] = seen.get(name, 0) + 1
    if duplicates:
        raise ReferenceDataSchemaDrift(
            f"delivery_format.csv header has duplicate column name(s): {sorted(duplicates)}"
        )
    if not header or any(not name.strip() for name in header):
        raise ReferenceDataSchemaDrift("delivery_format.csv header has a blank column name")

    columns = []
    for i, name in enumerate(header):
        base, num = _classify(name)
        columns.append(DeliveryFormatColumn(index=i, name=name, group_base=base, group_index=num))
    return DeliveryFormatSchema(source_path=path, columns=tuple(columns))


def load_delivery_format_rows(
    path: Path = DEFAULT_DELIVERY_FORMAT_PATH,
) -> tuple[dict[str, str], ...]:
    """The example row(s) shipped with the schema file, as raw source strings —
    for spot-checking only (UH0 §11). Never interpreted or normalised here."""
    if not path.exists():
        raise ReferenceDataMissing(f"Delivery Format file not found: {path}")
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = tuple(dict(row) for row in reader)
    return rows
