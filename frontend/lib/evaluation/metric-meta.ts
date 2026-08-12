/**
 * Static target/threshold context for eval headline metrics (docs/01-requirements.md §4,
 * the QR table). Pure lookup + pure comparison — no I/O, no fetch — so target/stretch
 * numbers live in one place instead of being retyped (and silently drifting) in every
 * chart that renders them. This mirrors `components/dashboard/stp-meters.tsx` and
 * `components/dashboard/cost-panel.tsx`'s inline target constants, generalised so `/
 * evaluation` doesn't re-derive them a third way (CLAUDE.md: "Thresholds & policies:
 * Configuration, never literals in code" — this file *is* that configuration, not the
 * scattering of literals it replaces).
 *
 * `direction` matters: STP/precision/recall are higher-is-better (a fuller meter is
 * good); ECE and over-abstention are lower-is-better (a fuller meter is bad) — rendering
 * both with the same "fill toward 100%" bar would silently invert the second group's
 * meaning, which is exactly the kind of confidence-instrument bug NFR-ACC-3 exists to
 * prevent for the attribute-level confidence display. `thresholdStatus` is direction-
 * aware so callers never have to re-derive the comparison.
 */

export type MetricDirection = "higher-better" | "lower-better";

export interface MetricMeta {
  /** Human label for chart/tile headings. */
  label: string;
  direction: MetricDirection;
  /** `0..1` fraction. `null` means the metric has no codified QR target — report the
   *  number for completeness (docs/03-ai-pipeline.md §8.3) without implying a pass/fail. */
  target: number | null;
  stretch: number | null;
  /** The QR id(s) this ties back to, shown next to every rendering of the metric so it
   *  never appears as an unsourced number (risk E4, "vanity metrics"). */
  requirement: string;
}

export const METRIC_META: Record<string, MetricMeta> = {
  stp_all_mandatory: {
    label: "STP — all mandatory attributes",
    direction: "higher-better",
    target: 0.55,
    stretch: 0.7,
    requirement: "QR-3",
  },
  stp_auto_eligible_only: {
    label: "STP — auto-eligible attributes only",
    direction: "higher-better",
    target: 0.75,
    stretch: 0.9,
    requirement: "QR-4",
  },
  precision: {
    // Blended across tiers in this headline metric — target is QR-2's (Tier 2/3) floor,
    // the more inclusive bound; stretch is QR-1's (Tier 1) ceiling. The per-slice table
    // (real:ball_valve, etc.) is the closest this run gets to a tier/class breakdown.
    label: "Precision — auto-accepted",
    direction: "higher-better",
    target: 0.95,
    stretch: 0.99,
    requirement: "QR-1 / QR-2",
  },
  recall: {
    label: "Recall",
    direction: "higher-better",
    target: null,
    stretch: null,
    requirement: "§8.3 methodology — no codified QR target",
  },
  ece: {
    label: "Expected Calibration Error",
    direction: "lower-better",
    target: 0.05,
    stretch: 0.03,
    requirement: "QR-13",
  },
  over_abstention_rate: {
    label: "Over-abstention rate",
    direction: "lower-better",
    target: 0.18,
    stretch: 0.12,
    requirement: "QR-7",
  },
};

const FALLBACK_META: Omit<MetricMeta, "label"> = {
  direction: "higher-better",
  target: null,
  stretch: null,
  requirement: "unmapped metric",
};

/** Never throws on an unrecognised `metric_code` — an eval run from a newer harness
 *  version should still render, just without target context, rather than crash the page. */
export function metricMeta(metricCode: string): MetricMeta {
  return (
    METRIC_META[metricCode] ?? {
      label: metricCode.replaceAll("_", " "),
      ...FALLBACK_META,
    }
  );
}

export type ThresholdStatus = "below-target" | "target-met" | "stretch-met" | "unrated";

/** Direction-aware comparison against `meta`'s target/stretch. `unrated` when the metric
 *  carries no codified target (e.g. `recall`) — never fabricates a pass/fail in that case. */
export function thresholdStatus(value: number, meta: MetricMeta): ThresholdStatus {
  if (meta.target === null || meta.stretch === null) return "unrated";
  if (meta.direction === "higher-better") {
    if (value >= meta.stretch) return "stretch-met";
    if (value >= meta.target) return "target-met";
    return "below-target";
  }
  if (value <= meta.stretch) return "stretch-met";
  if (value <= meta.target) return "target-met";
  return "below-target";
}
