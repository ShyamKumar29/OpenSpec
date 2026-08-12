/**
 * Formats a `0..1` ratio as a whole-percent string, e.g. `0.583` -> `"58%"`. Tabular-
 * numeral display only (docs/06-frontend.md §5) — pair with the `.metric` utility class.
 * Used for rate-style dashboard metrics (STP, catalog-health ratios). Confidence has its
 * own dedicated formatter (`lib/format/confidence.ts`, guarded by
 * tests/architecture/confidence-formatting.test.ts) and must not use this one instead —
 * they are different concepts (a calibrated composite signal vs. a plain rate) that only
 * coincidentally share a `0..1` domain.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
