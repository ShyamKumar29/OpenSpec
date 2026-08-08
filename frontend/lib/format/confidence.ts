/**
 * Confidence is a calibrated composite of measured signals (CLAUDE.md), never a model
 * self-report, and it is never rendered by colour alone (NFR-ACC-3). This module is the
 * ONLY place that formats a raw confidence number or picks its glyph — enforced by
 * tests/architecture/confidence-formatting.test.ts. Every other component renders
 * confidence through <ConfidenceIndicator /> (components/attribute/confidence-indicator.tsx).
 *
 * The glyph thresholds below are a *display* convention, not a business threshold — the
 * tau values that gate auto-accept/review/approval live in the backend's
 * `/admin/thresholds` (Track B) and never appear in frontend code.
 */

export type ConfidenceGlyph = "●" | "◐" | "○";

const GLYPH_HIGH = 0.85;
const GLYPH_MID = 0.6;

export function confidenceGlyph(value: number): ConfidenceGlyph {
  if (value >= GLYPH_HIGH) return "●";
  if (value >= GLYPH_MID) return "◐";
  return "○";
}

/** Two-decimal fixed form, e.g. 0.97, 0.4 -> "0.40". Tabular-numeral display only. */
export function formatConfidence(value: number): string {
  return value.toFixed(2);
}
