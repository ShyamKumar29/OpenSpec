"""Deterministic coverage statistics for `enrich_catalog_row` run against the
real `sample_input.csv` (UH4 — docs/16-unilog-alignment.md UH4's evaluation
instructions: "processed rows, extracted values, unknowns, review cases,
evidence coverage... deterministic statistics", explicitly **not** accuracy —
there is no gold set to score against in this environment, UH0's still-open
gap). Mirrors `manufacturer_brand_stats.py`'s pattern: real numbers from a
real run, never invented.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.manufacturer_brand import ManufacturerBrandReference
from openspec.application.usecases.enrich_catalog_row import enrich_catalog_row
from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy
from openspec.domain.model.attribute import AttributeValueStatus, is_unknown
from openspec.infrastructure.reference_data.sample_input import SupplierInputRow

_ATTRIBUTE_CODES = ("MFG_PART_NUM", "ITEM_DESCRIPTION", "MANUFACTURER_NAME", "BRAND_NAME")


@dataclass(frozen=True, slots=True)
class EnrichmentCoverageStats:
    rows_processed: int
    accepted_counts: dict[str, int]
    needs_review_counts: dict[str, int]
    unknown_reason_counts: dict[str, dict[str, int]]

    def evidence_coverage(self, attribute_code: str) -> float:
        """Fraction of processed rows that produced a value with evidence
        (`ACCEPTED` or `NEEDS_REVIEW`, both require evidence under INV-1) for
        `attribute_code`. `0.0` if `rows_processed` is `0`."""
        if self.rows_processed == 0:
            return 0.0
        with_evidence = self.accepted_counts.get(attribute_code, 0) + self.needs_review_counts.get(
            attribute_code, 0
        )
        return with_evidence / self.rows_processed


def compute_enrichment_coverage_stats(
    rows: tuple[SupplierInputRow, ...],
    *,
    resolution_policy: ResolutionPolicy,
    part_manuf_placeholder_tokens: frozenset[str],
    brand_placeholder_tokens: frozenset[str],
    manufacturer_brand_reference: ManufacturerBrandReference | None,
    run_started_at: str,
) -> EnrichmentCoverageStats:
    accepted_counts: dict[str, int] = {code: 0 for code in _ATTRIBUTE_CODES}
    needs_review_counts: dict[str, int] = {code: 0 for code in _ATTRIBUTE_CODES}
    unknown_reason_counts: dict[str, dict[str, int]] = {code: {} for code in _ATTRIBUTE_CODES}

    for row in rows:
        result = enrich_catalog_row(
            row_number=row.row_number,
            mfg_part_num_raw=row.mfg_part_num,
            part_desc_raw=row.part_desc,
            part_manuf_raw=row.part_manuf,
            dib_brand_raw=row.dib_brand,
            id_factory=lambda code, row_number=row.row_number: f"{row_number}:{code}",
            created_at=run_started_at,
            manufacturer_brand_reference=manufacturer_brand_reference,
            resolution_policy=resolution_policy,
            part_manuf_placeholder_tokens=part_manuf_placeholder_tokens,
            brand_placeholder_tokens=brand_placeholder_tokens,
        )
        by_code = {
            "MFG_PART_NUM": result.mfg_part_num,
            "ITEM_DESCRIPTION": result.item_description,
            "MANUFACTURER_NAME": result.manufacturer_name,
            "BRAND_NAME": result.brand_name,
        }
        for code, value in by_code.items():
            if is_unknown(value):
                reason = value.unknown_reason.value  # type: ignore[union-attr]
                unknown_reason_counts[code][reason] = unknown_reason_counts[code].get(reason, 0) + 1
            elif value.status is AttributeValueStatus.ACCEPTED:
                accepted_counts[code] += 1
            elif value.status is AttributeValueStatus.NEEDS_REVIEW:
                needs_review_counts[code] += 1

    return EnrichmentCoverageStats(
        rows_processed=len(rows),
        accepted_counts=accepted_counts,
        needs_review_counts=needs_review_counts,
        unknown_reason_counts=unknown_reason_counts,
    )
