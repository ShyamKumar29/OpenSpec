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
}

export const STATUS: Record<SemanticStatus, StatusToken> = {
  accepted: {
    status: "accepted",
    label: "Accepted",
    glyph: "●",
    description: "Verified and published — no human action required.",
    fg: "text-status-accepted",
    bg: "bg-status-accepted-bg",
  },
  "needs-review": {
    status: "needs-review",
    label: "Needs review",
    glyph: "◐",
    description: "Below the auto-accept threshold or failed a check — queued for a reviewer.",
    fg: "text-status-needs-review",
    bg: "bg-status-needs-review-bg",
  },
  "needs-approval": {
    status: "needs-approval",
    label: "Needs approval",
    glyph: "⏸",
    description:
      "Tier 0 attribute — requires human approval regardless of confidence (INV-9). Never auto-accepted.",
    fg: "text-status-needs-approval",
    bg: "bg-status-needs-approval-bg",
  },
  unknown: {
    status: "unknown",
    label: "Unknown",
    glyph: "❓",
    description: "No value asserted. Always carries a machine-readable reason (INV-4).",
    fg: "text-status-unknown",
    bg: "bg-status-unknown-bg",
  },
  rejected: {
    status: "rejected",
    label: "Rejected",
    glyph: "✕",
    description: "A proposed value was rejected and did not become an accepted value.",
    fg: "text-status-rejected",
    bg: "bg-status-rejected-bg",
  },
  superseded: {
    status: "superseded",
    label: "Superseded",
    glyph: "↺",
    description: "No longer current — replaced by a newer value. Retained for history (INV-8).",
    fg: "text-status-superseded",
    bg: "bg-status-superseded-bg",
  },
};

export const SEMANTIC_STATUSES = Object.keys(STATUS) as SemanticStatus[];
