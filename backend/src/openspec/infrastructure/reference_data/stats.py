"""Deterministic reference-data statistics (`docs/16-unilog-alignment.md` UH0 §10).
Pure computation over already-loaded structures — no I/O here, the loaders in
`delivery_format.py` / `sample_input.py` own that. Kept separate so a future
`make eval`-style report can call these without re-parsing files.
"""

from __future__ import annotations

import collections
from dataclasses import dataclass

from openspec.infrastructure.reference_data.delivery_format import DeliveryFormatSchema
from openspec.infrastructure.reference_data.sample_input import SupplierInputRow


@dataclass(frozen=True, slots=True)
class DeliveryFormatStats:
    source_file: str
    row_count: int
    column_count: int
    attribute_slot_count: int
    item_features_count: int


@dataclass(frozen=True, slots=True)
class SampleInputStats:
    source_file: str
    row_count: int
    column_count: int
    unique_mfg_part_num_count: int
    duplicate_mfg_part_num_count: int
    duplicate_mfg_part_nums: tuple[str, ...]
    e1_brand_placeholder_count: int
    unilog_brand_placeholder_count: int
    dib_brand_placeholder_count: int
    part_manuf_placeholder_count: int
    unique_part_manuf_count: int


def compute_delivery_format_stats(
    schema: DeliveryFormatSchema, rows: tuple[dict[str, str], ...]
) -> DeliveryFormatStats:
    return DeliveryFormatStats(
        source_file=schema.source_path.name,
        row_count=len(rows),
        column_count=len(schema.columns),
        attribute_slot_count=len(schema.attribute_slots()),
        item_features_count=len(schema.item_features_columns()),
    )


def compute_sample_input_stats(rows: tuple[SupplierInputRow, ...]) -> SampleInputStats:
    mpn_counts = collections.Counter(r.mfg_part_num for r in rows)
    duplicates = tuple(sorted(mpn for mpn, n in mpn_counts.items() if n > 1))
    source_file = "sample_input.csv"
    return SampleInputStats(
        source_file=source_file,
        row_count=len(rows),
        column_count=6,
        unique_mfg_part_num_count=len(mpn_counts),
        duplicate_mfg_part_num_count=len(duplicates),
        duplicate_mfg_part_nums=duplicates,
        e1_brand_placeholder_count=sum(1 for r in rows if r.e1_brand_is_placeholder),
        unilog_brand_placeholder_count=sum(1 for r in rows if r.unilog_brand_is_placeholder),
        dib_brand_placeholder_count=sum(1 for r in rows if r.dib_brand_is_placeholder),
        part_manuf_placeholder_count=sum(1 for r in rows if r.part_manuf_is_placeholder),
        unique_part_manuf_count=len({r.part_manuf for r in rows}),
    )
