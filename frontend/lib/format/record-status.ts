/**
 * Human-facing copy and semantic-status mapping for `RecordStatus`
 * (docs/14-frontend-implementation-plan.md §4.2 "Mandatory record state coverage").
 * Distinct from `AttributeValueStatus` (lib/status.ts) — a record's overall state is not
 * an attribute's status — but reuses the same six-token colour system rather than
 * inventing a second palette, per docs/06-frontend.md §5 ("Colour semantics").
 */
import type { RecordStatus } from "@/lib/contracts/record";
import type { SemanticStatus } from "@/lib/status";

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  healthy: "Healthy",
  incomplete: "Incomplete",
  partially_enriched: "Partially enriched",
  awaiting_tier0_approval: "Awaiting Tier-0 approval",
  unknown_heavy: "Unknown-heavy",
  class_unresolved: "Class unresolved",
  unbound: "No document bound",
  conflicting_sources: "Conflicting sources",
};

export const RECORD_STATUS_DESCRIPTION: Record<RecordStatus, string> = {
  healthy: "All mandatory attributes filled and accepted.",
  incomplete: "Some mandatory attributes are not yet filled.",
  partially_enriched: "A meaningful share of attributes are still pending review.",
  awaiting_tier0_approval: "One or more Tier-0 attributes await human approval (INV-9).",
  unknown_heavy: "Most mandatory attributes are Unknown.",
  class_unresolved: "The taxonomy class could not be resolved — schema is blocked.",
  unbound: "No source document is bound to this record.",
  conflicting_sources: "Two or more sources disagree and neither was chosen automatically.",
};

/** Reuses lib/status.ts's six tokens for colour/glyph only — the label always comes
 *  from RECORD_STATUS_LABEL, so no meaning is lost in the reuse (NFR-ACC-3). */
export const RECORD_STATUS_SEMANTIC: Record<RecordStatus, SemanticStatus> = {
  healthy: "accepted",
  incomplete: "needs-review",
  partially_enriched: "needs-review",
  awaiting_tier0_approval: "needs-approval",
  unknown_heavy: "unknown",
  class_unresolved: "rejected",
  unbound: "rejected",
  conflicting_sources: "rejected",
};
