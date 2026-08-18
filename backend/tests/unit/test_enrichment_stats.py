"""Tests for `infrastructure/reference_data/enrichment_stats.py` (UH4 —
docs/16-unilog-alignment.md UH4's evaluation instructions). Every number
asserted here was computed by actually running
`compute_enrichment_coverage_stats` against the real 1,000-row
`sample_input.csv` and reading its output — the same "real numbers from a
real run" discipline `test_manufacturer_brand_stats.py` established for UH2.
These are **coverage statistics, not accuracy** — there is no gold set in
this environment to score correctness against (UH0's still-open gap).
"""

from __future__ import annotations

from openspec.infrastructure.reference_data.enrichment_stats import (
    compute_enrichment_coverage_stats,
)
from openspec.infrastructure.reference_data.sample_input import (
    KNOWN_BRAND_PLACEHOLDERS,
    KNOWN_PART_MANUF_PLACEHOLDER,
    load_sample_input_rows,
)
from openspec.infrastructure.resolution_policy import load_resolution_policy

_ROWS = load_sample_input_rows()
_POLICY = load_resolution_policy()


def _run() -> object:
    return compute_enrichment_coverage_stats(
        rows=_ROWS,
        resolution_policy=_POLICY,
        part_manuf_placeholder_tokens=frozenset({KNOWN_PART_MANUF_PLACEHOLDER}),
        brand_placeholder_tokens=KNOWN_BRAND_PLACEHOLDERS,
        manufacturer_brand_reference=None,
        run_started_at="2026-08-14T00:00:00Z",
    )


class TestRealRunAgainstSampleInput:
    def test_all_rows_processed(self) -> None:
        stats = _run()
        assert stats.rows_processed == 1000  # type: ignore[attr-defined]

    def test_mfg_part_num_always_accepted(self) -> None:
        """`Mfg_Part_Num` is required non-blank by the loader itself
        (`sample_input.py`), so every row's verbatim extraction is `ACCEPTED`."""
        stats = _run()
        assert stats.accepted_counts["MFG_PART_NUM"] == 1000  # type: ignore[attr-defined]
        assert stats.unknown_reason_counts["MFG_PART_NUM"] == {}  # type: ignore[attr-defined]

    def test_item_description_accepted_for_every_row(self) -> None:
        """Verified against the real file: no row has a blank `Part_Desc`."""
        stats = _run()
        assert stats.accepted_counts["ITEM_DESCRIPTION"] == 1000  # type: ignore[attr-defined]

    def test_manufacturer_name_is_honestly_unresolved_without_reference_data(self) -> None:
        stats = _run()
        reasons = stats.unknown_reason_counts["MANUFACTURER_NAME"]  # type: ignore[attr-defined]
        assert stats.accepted_counts["MANUFACTURER_NAME"] == 0  # type: ignore[attr-defined]
        assert reasons["REFERENCE_DATA_UNAVAILABLE"] == 959
        assert reasons["NO_BRAND_DECLARED"] == 41

    def test_brand_name_is_honestly_unresolved_without_reference_data(self) -> None:
        stats = _run()
        reasons = stats.unknown_reason_counts["BRAND_NAME"]  # type: ignore[attr-defined]
        assert stats.accepted_counts["BRAND_NAME"] == 0  # type: ignore[attr-defined]
        assert reasons["NO_BRAND_DECLARED"] == 755
        assert reasons["REFERENCE_DATA_UNAVAILABLE"] == 245

    def test_evidence_coverage_is_full_for_verbatim_attributes(self) -> None:
        stats = _run()
        assert stats.evidence_coverage("MFG_PART_NUM") == 1.0  # type: ignore[attr-defined]
        assert stats.evidence_coverage("ITEM_DESCRIPTION") == 1.0  # type: ignore[attr-defined]

    def test_evidence_coverage_is_zero_for_manufacturer_without_reference_data(self) -> None:
        stats = _run()
        assert stats.evidence_coverage("MANUFACTURER_NAME") == 0.0  # type: ignore[attr-defined]
