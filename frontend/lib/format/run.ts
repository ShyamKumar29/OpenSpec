/**
 * Duration/cost formatting for the run stage timeline (docs/06-frontend.md §3.4: "0.4s",
 * "$0.041"). One place, mirroring `lib/format/confidence.ts`'s "format once" discipline —
 * tabular-numeral display only (docs/06-frontend.md §5).
 */

export function formatDurationMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatCostUsd(usd: number | null): string {
  if (usd === null) return "—";
  return `$${usd.toFixed(3)}`;
}
