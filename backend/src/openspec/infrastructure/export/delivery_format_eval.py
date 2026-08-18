"""Delivery Format export coverage report (UH7 — docs/16-unilog-alignment.md
UH7's evaluation instructions: "processed rows, extracted values, unknowns,
review cases, evidence coverage... validation failures, deterministic
statistics"). Runs the real pipeline (`enrich_catalog_row`, UH4) against the
real `sample_input.csv`, projects each result onto a Delivery Format row
(UH7), validates it, and reports what actually happened — **no accuracy
number**, because there is no gold set in this environment to score
correctness against (UH0's still-open gap, unchanged through every milestone
in this track).
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.manufacturer_brand import ManufacturerBrandReference
from openspec.application.usecases.enrich_catalog_row import enrich_catalog_row
from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy
from openspec.infrastructure.export.delivery_format_projection import (
    ATTRIBUTE_TO_COLUMN,
    project_record_to_delivery_format_row,
)
from openspec.infrastructure.export.delivery_format_validation import (
    validate_delivery_format_row,
)
from openspec.infrastructure.reference_data.delivery_format import DeliveryFormatSchema
from openspec.infrastructure.reference_data.sample_input import SupplierInputRow


@dataclass(frozen=True, slots=True)
class DeliveryFormatExportReport:
    rows_exported: int
    column_count: int
    population_counts: dict[str, int]  # mapped column -> non-empty count
    validation_pass_counts: dict[str, int]  # rule_id -> pass count
    validation_fail_counts: dict[str, int]  # rule_id -> fail count

    def population_rate(self, column_name: str) -> float:
        if self.rows_exported == 0:
            return 0.0
        return self.population_counts.get(column_name, 0) / self.rows_exported


def compute_delivery_format_export_report(
    rows: tuple[SupplierInputRow, ...],
    *,
    schema: DeliveryFormatSchema,
    resolution_policy: ResolutionPolicy,
    part_manuf_placeholder_tokens: frozenset[str],
    brand_placeholder_tokens: frozenset[str],
    manufacturer_brand_reference: ManufacturerBrandReference | None,
    run_started_at: str,
) -> DeliveryFormatExportReport:
    population_counts: dict[str, int] = dict.fromkeys(ATTRIBUTE_TO_COLUMN.values(), 0)
    validation_pass_counts: dict[str, int] = {}
    validation_fail_counts: dict[str, int] = {}

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
        attribute_values = {
            "MFG_PART_NUM": result.mfg_part_num,
            "ITEM_DESCRIPTION": result.item_description,
            "MANUFACTURER_NAME": result.manufacturer_name,
            "BRAND_NAME": result.brand_name,
        }
        export_row = project_record_to_delivery_format_row(schema, attribute_values)

        for column_name in ATTRIBUTE_TO_COLUMN.values():
            if export_row.get(column_name):
                population_counts[column_name] += 1

        for validation in validate_delivery_format_row(export_row, schema):
            counts = validation_pass_counts if validation.passed else validation_fail_counts
            counts[validation.rule_id] = counts.get(validation.rule_id, 0) + 1

    return DeliveryFormatExportReport(
        rows_exported=len(rows),
        column_count=len(schema.columns),
        population_counts=population_counts,
        validation_pass_counts=validation_pass_counts,
        validation_fail_counts=validation_fail_counts,
    )
