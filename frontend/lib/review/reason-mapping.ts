/**
 * Maps a review task's `reasonCode` (the queue tab it lives in) to the `UnknownReason`
 * the mock's `POST /review/tasks/{id}/reject` should record (docs/api.md §Review:
 * "reject to Unknown with an optional reason"). Centralised so the decision bar's `R`
 * (reject the proposed value) and `U` (assert Unknown directly) actions both fire
 * instantly — no reason picker, no dialog — the reason is already implied by which tab
 * the task is in (docs/06-frontend.md §1 Thesis 2: "Never leaving the keyboard").
 */
import type { ReviewReasonCode } from "@/lib/contracts/review";
import type { UnknownReason } from "@/lib/contracts/attribute-value";

export const REASON_CODE_TO_UNKNOWN_REASON: Record<ReviewReasonCode, UnknownReason> = {
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  BELOW_THRESHOLD: "BELOW_CONFIDENCE_THRESHOLD",
  TIER0_APPROVAL: "BELOW_CONFIDENCE_THRESHOLD",
  NO_DOCUMENT: "NO_DOCUMENT_FOUND",
  AMBIGUOUS: "AMBIGUOUS_CANDIDATES",
  CONFLICTING: "CONFLICTING_SOURCES",
};

export function unknownReasonForTask(reasonCode: ReviewReasonCode): UnknownReason {
  return REASON_CODE_TO_UNKNOWN_REASON[reasonCode];
}
