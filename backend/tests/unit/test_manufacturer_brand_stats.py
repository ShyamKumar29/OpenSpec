"""Descriptive resolution statistics over the *real* `sample_input.csv` (`RES`,
UH2 — docs/16-unilog-alignment.md G3, UH2 brief §10). Every number asserted
here was computed by actually running
`compute_manufacturer_brand_resolution_stats` against the real 1,000-row file
and reading its output — not guessed and not backfilled to make a test pass.
If the source file changes, these numbers should change and this test should
fail loudly (the same "spot check against real values" contract
`test_reference_data_sample_input.py` already uses for UH0's loaders).

These are corpus-shape statistics (normalisation clusters, embedded-code
extraction, cross-field near-miss conflicts) — never a resolution-accuracy
claim. No genuine approved-vocabulary match has ever been checked against
real data in this environment (the workbook is missing).
"""

from __future__ import annotations

from openspec.infrastructure.reference_data.manufacturer_brand_stats import (
    compute_manufacturer_brand_resolution_stats,
)
from openspec.infrastructure.reference_data.sample_input import load_sample_input_rows


class TestFieldStatsAgainstTheRealFile:
    def test_row_count(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert stats.row_count == 1000
        assert stats.source_file == "sample_input.csv"

    def test_part_manuf(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert stats.part_manuf.raw_distinct_count == 76
        assert stats.part_manuf.placeholder_count == 41  # the "-" token, per sample_input.py
        assert stats.part_manuf.non_placeholder_raw_count == 959
        # 75, not 76: at least two distinct raw Part_Manuf strings normalise to
        # the same key (case/punctuation/suffix collapse) — a real, measured
        # normalisation cluster, not assumed.
        assert stats.part_manuf.normalized_cluster_count == 75

    def test_e1_brand(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert stats.e1_brand.raw_distinct_count == 13
        assert stats.e1_brand.placeholder_count == 799  # "-- Unbranded --" dominates this column
        assert stats.e1_brand.normalized_cluster_count == 12

    def test_dib_brand(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert stats.dib_brand.raw_distinct_count == 24
        # "-- No DIB Brand --" dominates this column
        assert stats.dib_brand.placeholder_count == 755
        assert stats.dib_brand.normalized_cluster_count == 23


class TestEmbeddedCodeExtraction:
    def test_every_non_placeholder_part_manuf_value_carries_a_code(self) -> None:
        """Verified against the actual file: `Part_Manuf` is consistently
        formatted `<name> (<code>)` wherever it isn't the `-` placeholder."""
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert stats.part_manuf_embedded_codes.values_with_code == 959
        assert stats.part_manuf_embedded_codes.values_without_code == 0
        assert stats.part_manuf_embedded_codes.distinct_codes == 75


class TestCrossFieldConflictDetection:
    """UH2 brief §12's general conflict-detection capability, run against
    real data — no hardcoded Rheem/Frigidaire special case (rule §11): this
    compares `Part_Manuf` against `DIB_Brand` on the same row generally, and
    these are whatever it actually finds."""

    def test_finds_the_real_near_miss_candidates(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        assert len(stats.conflict_candidates) == 9

    def test_philips_vs_phillips_lighting_is_flagged(self) -> None:
        """A genuine spelling discrepancy found in the real file: `DIB_Brand`
        spells the brand `Philips`; `Part_Manuf` spells it `Phillips Lighting`
        (double-L) on the same 109 rows. Not a fabricated example — found by
        running the real conflict scan, the same class of finding
        docs/16-unilog-alignment.md §2 documents for Rheem/Frigidaire in a
        different file."""
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        match = next(
            c
            for c in stats.conflict_candidates
            if c.dib_brand_raw == "Philips" and c.part_manuf_raw.startswith("Phillips Lighting")
        )
        assert len(match.row_numbers) == 109
        assert 0.5 <= match.similarity < 1.0

    def test_every_candidate_is_a_genuine_near_miss_not_an_exact_or_unrelated_pair(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        for candidate in stats.conflict_candidates:
            assert 0.5 <= candidate.similarity < 1.0
            assert candidate.part_manuf_raw != candidate.dib_brand_raw
            assert candidate.row_numbers  # traceable back to real source rows

    def test_conflict_candidates_are_ranked_by_similarity_descending(self) -> None:
        rows = load_sample_input_rows()
        stats = compute_manufacturer_brand_resolution_stats(rows)
        scores = [c.similarity for c in stats.conflict_candidates]
        assert scores == sorted(scores, reverse=True)
