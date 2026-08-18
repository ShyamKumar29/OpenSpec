/**
 * Human-facing copy for the six review reason codes — the queue tabs
 * (docs/06-frontend.md §3.3: "VERIFICATION_FAILED 88 · BELOW_THRESHOLD 141 · …").
 */
import type { ReviewReasonCode } from "@/lib/contracts/review";
import type { SemanticStatus } from "@/lib/status";

export const REVIEW_REASON_LABEL: Record<ReviewReasonCode, string> = {
  VERIFICATION_FAILED: "Verification failed",
  BELOW_THRESHOLD: "Below threshold",
  TIER0_APPROVAL: "Tier-0 approval",
  NO_DOCUMENT: "No document",
  AMBIGUOUS: "Ambiguous",
  CONFLICTING: "Conflicting",
};

/**
 * Reason code → the shared six-token colour system (`lib/status.ts`), for the reason chip
 * the Stitch review screen puts on every row of its task rail. Reuses those tokens rather
 * than inventing a seventh palette for reason codes, exactly as `RECORD_STATUS_SEMANTIC`
 * and `PARSE_STATUS_COPY` do — the label always travels with the colour, so nothing is
 * lost in the reuse (NFR-ACC-3).
 */
export const REVIEW_REASON_SEMANTIC: Record<ReviewReasonCode, SemanticStatus> = {
  VERIFICATION_FAILED: "rejected",
  BELOW_THRESHOLD: "needs-review",
  TIER0_APPROVAL: "needs-approval",
  NO_DOCUMENT: "unknown",
  AMBIGUOUS: "needs-review",
  CONFLICTING: "rejected",
};
