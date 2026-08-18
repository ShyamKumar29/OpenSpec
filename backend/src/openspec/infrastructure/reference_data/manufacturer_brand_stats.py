"""Descriptive resolution statistics over `sample_input.csv` (`RES`, UH2 —
docs/16-unilog-alignment.md G3, UH2 brief §10: "measure what the available
data actually allows you to measure ... do not call this accuracy"). Every
number here is computable without the approved manufacturer/brand workbook —
it describes the *raw corpus itself* (normalisation cluster counts,
embedded-code extraction, cross-field near-miss conflicts), never a
resolution-accuracy claim, because no genuine approved-vocabulary match has
ever been checked against real data in this environment
(`infrastructure/reference_data/manufacturer_brand_list.py`).
"""

from __future__ import annotations

import collections
from dataclasses import dataclass

from openspec.domain.nrm.manufacturer_brand import (
    fuzzy_similarity,
    normalize_manufacturer_brand_name,
)
from openspec.infrastructure.reference_data.sample_input import SupplierInputRow

# The band a normalised Part_Manuf name and a normalised DIB_Brand can differ
# by and still be worth a human's attention — near enough to suspect the same
# entity, far enough not to be a normalisation miss. Below this, the two
# values are treated as unrelated (no signal); at/above it but < 1.0 (exact
# matches are excluded before scoring), flagged as a candidate conflict.
# Documented here rather than a bare literal per CLAUDE.md's "thresholds are
# configuration" rule — kept local, not YAML, because this is a diagnostic
# report threshold, not a resolution decision threshold (that one lives in
# resources/policy/manufacturer_brand_resolution.yaml).
NEAR_MISS_FLOOR = 0.5


@dataclass(frozen=True, slots=True)
class FieldNormalizationStats:
    field_name: str
    raw_distinct_count: int
    placeholder_count: int
    non_placeholder_raw_count: int
    normalized_cluster_count: int  # distinct normalized values among non-placeholder raws


@dataclass(frozen=True, slots=True)
class EmbeddedCodeStats:
    values_with_code: int
    values_without_code: int
    distinct_codes: int


@dataclass(frozen=True, slots=True)
class ManufacturerBrandConflictCandidate:
    """A `Part_Manuf`/`DIB_Brand` pair on the same row whose normalised forms
    are close but not equal — a candidate for the general conflict-detection
    capability UH2 brief §12 asks for. `row_numbers` lets a reviewer jump
    straight to the source rows (traceability, not just a statistic)."""

    part_manuf_raw: str
    dib_brand_raw: str
    similarity: float
    row_numbers: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class ManufacturerBrandResolutionStats:
    source_file: str
    row_count: int
    part_manuf: FieldNormalizationStats
    e1_brand: FieldNormalizationStats
    dib_brand: FieldNormalizationStats
    part_manuf_embedded_codes: EmbeddedCodeStats
    conflict_candidates: tuple[ManufacturerBrandConflictCandidate, ...]


def _field_stats(
    field_name: str, raw_values: list[str], is_placeholder: list[bool]
) -> FieldNormalizationStats:
    raw_distinct = len(set(raw_values))
    placeholder_count = sum(is_placeholder)
    non_placeholder = [v for v, p in zip(raw_values, is_placeholder, strict=True) if not p]
    normalized_set = {normalize_manufacturer_brand_name(v).normalized for v in non_placeholder}
    return FieldNormalizationStats(
        field_name=field_name,
        raw_distinct_count=raw_distinct,
        placeholder_count=placeholder_count,
        non_placeholder_raw_count=len(non_placeholder),
        normalized_cluster_count=len(normalized_set),
    )


def compute_manufacturer_brand_resolution_stats(
    rows: tuple[SupplierInputRow, ...],
) -> ManufacturerBrandResolutionStats:
    part_manuf_stats = _field_stats(
        "Part_Manuf",
        [r.part_manuf for r in rows],
        [r.part_manuf_is_placeholder for r in rows],
    )
    e1_brand_stats = _field_stats(
        "E1_Brand", [r.e1_brand for r in rows], [r.e1_brand_is_placeholder for r in rows]
    )
    dib_brand_stats = _field_stats(
        "DIB_Brand", [r.dib_brand for r in rows], [r.dib_brand_is_placeholder for r in rows]
    )

    codes = [
        normalize_manufacturer_brand_name(r.part_manuf).embedded_code
        for r in rows
        if not r.part_manuf_is_placeholder
    ]
    embedded_code_stats = EmbeddedCodeStats(
        values_with_code=sum(1 for c in codes if c is not None),
        values_without_code=sum(1 for c in codes if c is None),
        distinct_codes=len({c for c in codes if c is not None}),
    )

    conflict_rows: dict[tuple[str, str], list[int]] = collections.defaultdict(list)
    conflict_scores: dict[tuple[str, str], float] = {}
    for row in rows:
        if row.part_manuf_is_placeholder or row.dib_brand_is_placeholder:
            continue
        manuf_normalized = normalize_manufacturer_brand_name(row.part_manuf).normalized
        brand_normalized = normalize_manufacturer_brand_name(row.dib_brand).normalized
        if manuf_normalized == brand_normalized:
            continue
        score = fuzzy_similarity(manuf_normalized, brand_normalized)
        if score >= NEAR_MISS_FLOOR:
            key = (row.part_manuf, row.dib_brand)
            conflict_rows[key].append(row.row_number)
            conflict_scores[key] = score

    conflict_candidates = tuple(
        sorted(
            (
                ManufacturerBrandConflictCandidate(
                    part_manuf_raw=part_manuf_raw,
                    dib_brand_raw=dib_brand_raw,
                    similarity=conflict_scores[(part_manuf_raw, dib_brand_raw)],
                    row_numbers=tuple(row_numbers),
                )
                for (part_manuf_raw, dib_brand_raw), row_numbers in conflict_rows.items()
            ),
            key=lambda c: c.similarity,
            reverse=True,
        )
    )

    return ManufacturerBrandResolutionStats(
        source_file="sample_input.csv",
        row_count=len(rows),
        part_manuf=part_manuf_stats,
        e1_brand=e1_brand_stats,
        dib_brand=dib_brand_stats,
        part_manuf_embedded_codes=embedded_code_stats,
        conflict_candidates=conflict_candidates,
    )
