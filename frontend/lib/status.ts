/**
 * The semantic status system (docs/06-frontend.md §5) — six states, defined once as
 * tokens, never as ad-hoc classes scattered across components.
 *
 * Every rendering carries numeral/glyph/text/colour together (NFR-ACC-3 — confidence
 * and status are never colour-only). Components import `STATUS` and read a single
 * entry; nothing hardcodes a Tailwind colour class for a status anywhere else.
 */

export type SemanticStatus =
  "accepted" | "needs-review" | "needs-approval" | "unknown" | "rejected" | "superseded";

export interface StatusToken {
  status: SemanticStatus;
  /** Short, human label. Never abbreviated below this form in UI copy. */
  label: string;
  /** Text-equivalent glyph shown alongside colour (NFR-ACC-3). */
  glyph: string;
  /** One line explaining what the state means, for tooltips and screen readers. */
  description: string;
  /** Tailwind classes for the foreground (text/icon/border) use. */
  fg: string;
  /** Tailwind classes for the subtle chip/badge background use. */
  bg: string;
  /** Solid fill for meters and rules drawn in this status's colour. */
  rule: string;
  /** The "banded row" treatment (see `statusBand`): a solid left rule plus a faint tint.
   *  Written out literally rather than derived from `rule`/`bg` at runtime — Tailwind
   *  emits only class names it can see as literal source text, so a concatenated
   *  `"border-l-" + …` would silently produce no CSS at all. */
  band: string;
}

export const STATUS: Record<SemanticStatus, StatusToken> = {
  accepted: {
    status: "accepted",
    label: "Accepted",
    glyph: "●",
    description: "Verified and published — no human action required.",
    fg: "text-status-accepted",
    bg: "bg-status-accepted-bg",
    rule: "bg-status-accepted",
    band: "border-l-status-accepted bg-status-accepted-bg/35",
  },
  "needs-review": {
    status: "needs-review",
    label: "Needs review",
    glyph: "◐",
    description: "Below the auto-accept threshold or failed a check — queued for a reviewer.",
    fg: "text-status-needs-review",
    bg: "bg-status-needs-review-bg",
    rule: "bg-status-needs-review",
    band: "border-l-status-needs-review bg-status-needs-review-bg/35",
  },
  "needs-approval": {
    status: "needs-approval",
    label: "Needs approval",
    glyph: "⏸",
    description:
      "Tier 0 attribute — requires human approval regardless of confidence (INV-9). Never auto-accepted.",
    fg: "text-status-needs-approval",
    bg: "bg-status-needs-approval-bg",
    rule: "bg-status-needs-approval",
    band: "border-l-status-needs-approval bg-status-needs-approval-bg/35",
  },
  unknown: {
    status: "unknown",
    label: "Unknown",
    glyph: "❓",
    description: "No value asserted. Always carries a machine-readable reason (INV-4).",
    fg: "text-status-unknown",
    bg: "bg-status-unknown-bg",
    rule: "bg-status-unknown",
    band: "border-l-status-unknown bg-status-unknown-bg/35",
  },
  rejected: {
    status: "rejected",
    label: "Rejected",
    glyph: "✕",
    description: "A proposed value was rejected and did not become an accepted value.",
    fg: "text-status-rejected",
    bg: "bg-status-rejected-bg",
    rule: "bg-status-rejected",
    band: "border-l-status-rejected bg-status-rejected-bg/35",
  },
  superseded: {
    status: "superseded",
    label: "Superseded",
    glyph: "↺",
    description: "No longer current — replaced by a newer value. Retained for history (INV-8).",
    fg: "text-status-superseded",
    bg: "bg-status-superseded-bg",
    rule: "bg-status-superseded",
    band: "border-l-status-superseded bg-status-superseded-bg/35",
  },
};

export const SEMANTIC_STATUSES = Object.keys(STATUS) as SemanticStatus[];

/**
 * The "banded row" treatment from the Stitch corpus browser and catalog screens: a row
 * that needs attention gains a solid left rule in its status colour and a faint tint of
 * the same, so a problem is findable while scrolling a dense table rather than only
 * legible once read.
 *
 * Only `attention` states get a band. A table where every row is banded conveys nothing,
 * and the Stitch screens band exactly the rows that are not fine — so `accepted` and
 * `superseded` return the neutral treatment. The band is never the sole encoding: every
 * banded row still renders its status badge with glyph and label (NFR-ACC-3).
 */
export function statusBand(status: SemanticStatus, attention: boolean): string {
  return attention ? `border-l-2 ${STATUS[status].band}` : "border-l-2 border-l-transparent";
}
