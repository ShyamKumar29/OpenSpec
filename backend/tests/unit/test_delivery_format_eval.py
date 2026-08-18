"""Tests for `infrastructure/export/delivery_format_eval.py` (UH7). Every
number here was computed by actually running
`compute_delivery_format_export_report` against the real 1,000-row
`sample_input.csv` and the real, live-loaded Delivery Format schema — the
same "real numbers from a real run" discipline every prior milestone in this
track established. **Coverage, not accuracy** — no gold set exists in this
environment to score correctness against.
"""

from __future__ import annotations

from openspec.infrastructure.export.delivery_format_eval import (
    compute_delivery_format_export_report,
)
from openspec.infrastructure.reference_data.delivery_format import load_delivery_format_schema
from openspec.infrastructure.reference_data.sample_input import (
    KNOWN_BRAND_PLACEHOLDERS,
    KNOWN_PART_MANUF_PLACEHOLDER,
    load_sample_input_rows,
)
from openspec.infrastructure.resolution_policy import load_resolution_policy

_ROWS = load_sample_input_rows()
_SCHEMA = load_delivery_format_schema()
_POLICY = load_resolution_policy()


def _run() -> object:
    return compute_delivery_format_export_report(
        rows=_ROWS,
        schema=_SCHEMA,
        resolution_policy=_POLICY,
        part_manuf_placeholder_tokens=frozenset({KNOWN_PART_MANUF_PLACEHOLDER}),
        brand_placeholder_tokens=KNOWN_BRAND_PLACEHOLDERS,
        manufacturer_brand_reference=None,
        run_started_at="2026-08-14T00:00:00Z",
    )


class TestRealRunAgainstSampleInput:
    def test_all_rows_exported_with_the_real_252_column_schema(self) -> None:
        report = _run()
        assert report.rows_exported == 1000  # type: ignore[attr-defined]
        assert report.column_count == 252  # type: ignore[attr-defined]

    def test_identity_columns_fully_populated(self) -> None:
        report = _run()
        assert report.population_counts["Mfg_Part_Num"] == 1000  # type: ignore[attr-defined]
        assert report.population_counts["Part_Desc"] == 1000  # type: ignore[attr-defined]

    def test_manufacturer_brand_columns_honestly_unpopulated(self) -> None:
        """No approved manufacturer/brand workbook exists in this environment
        (UH2) — every real row's `MANUFACTURER_NAME`/`BRAND_NAME` stays
        `Unknown`, so the exported column stays empty rather than guessed."""
        report = _run()
        assert report.population_counts["MANUFACTURER_NAME"] == 0  # type: ignore[attr-defined]
        assert report.population_counts["BRAND_NAME"] == 0  # type: ignore[attr-defined]

    def test_population_rate_helper(self) -> None:
        report = _run()
        assert report.population_rate("Mfg_Part_Num") == 1.0  # type: ignore[attr-defined]
        assert report.population_rate("MANUFACTURER_NAME") == 0.0  # type: ignore[attr-defined]

    def test_every_row_passes_structural_export_validation(self) -> None:
        """Column count/names/order and item-features-duplication are
        structural guarantees this project controls — they must pass for
        every row regardless of what the missing reference workbooks block."""
        report = _run()
        assert report.validation_pass_counts["EXPORT-COLUMN-COUNT"] == 1000  # type: ignore[attr-defined]
        assert report.validation_pass_counts["EXPORT-COLUMN-NAMES"] == 1000  # type: ignore[attr-defined]
        assert report.validation_pass_counts["EXPORT-COLUMN-ORDER"] == 1000  # type: ignore[attr-defined]
        assert report.validation_fail_counts == {}  # type: ignore[attr-defined]
