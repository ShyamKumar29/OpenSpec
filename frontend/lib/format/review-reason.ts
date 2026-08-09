/**
 * Human-facing copy for the six review reason codes — the queue tabs
 * (docs/06-frontend.md §3.3: "VERIFICATION_FAILED 88 · BELOW_THRESHOLD 141 · …").
 */
import type { ReviewReasonCode } from "@/lib/contracts/review";

export const REVIEW_REASON_LABEL: Record<ReviewReasonCode, string> = {
  VERIFICATION_FAILED: "Verification failed",
  BELOW_THRESHOLD: "Below threshold",
  TIER0_APPROVAL: "Tier-0 approval",
  NO_DOCUMENT: "No document",
  AMBIGUOUS: "Ambiguous",
  CONFLICTING: "Conflicting",
};
