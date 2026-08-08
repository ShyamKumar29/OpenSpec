/**
 * Human-facing copy for the closed `unknown_reason` set (docs/api.md), with fix owner
 * from docs/01-requirements.md §1.2 and a remediation hint per FR-EXP-3 / §1.2's
 * "routed by fix owner" requirement. This is the single source of truth for that copy —
 * <UnknownValue /> is the only component allowed to render it.
 */
import type { UnknownReason } from "@/lib/contracts/attribute-value";

export interface UnknownReasonCopy {
  label: string;
  fixOwner: string;
  remediation: string;
}

export const UNKNOWN_REASON_COPY: Record<UnknownReason, UnknownReasonCopy> = {
  NO_DOCUMENT_FOUND: {
    label: "No document found",
    fixOwner: "Ops (sourcing)",
    remediation: "Source a spec sheet or datasheet for this MPN and attach it to the record.",
  },
  DOCUMENT_LOW_CONFIDENCE: {
    label: "Document match low-confidence",
    fixOwner: "Reviewer",
    remediation: "Confirm the bound document is the correct one, or reattach the correct document.",
  },
  DOCUMENT_UNPARSEABLE: {
    label: "Document could not be parsed",
    fixOwner: "Ops (OCR / manual)",
    remediation: "Supply a text-layer PDF, or route the page for manual OCR review.",
  },
  ATTRIBUTE_NOT_IN_DOCUMENT: {
    label: "Not stated in the document",
    fixOwner: "Ops (other document)",
    remediation:
      "Source an additional document (e.g. a submittal sheet) that states this attribute.",
  },
  AMBIGUOUS_CANDIDATES: {
    label: "Ambiguous — multiple candidates",
    fixOwner: "Reviewer",
    remediation: "Pick the correct candidate span; the others will be recorded as rejected.",
  },
  VERIFICATION_FAILED: {
    label: "Verification failed",
    fixOwner: "Reviewer",
    remediation: "Check the proposed span against the source; accept, correct, or reject it.",
  },
  VALIDATION_FAILED: {
    label: "Validation rule failed",
    fixOwner: "Reviewer + rules owner",
    remediation: "Review the failed rule; correct the value or flag the rule for revision.",
  },
  NORMALIZATION_FAILED: {
    label: "Could not be normalised",
    fixOwner: "Rules owner",
    remediation: "The raw value doesn't match a known pattern — extend the normalisation rules.",
  },
  BELOW_CONFIDENCE_THRESHOLD: {
    label: "Below the confidence threshold",
    fixOwner: "Reviewer",
    remediation: "Confirm the proposed value against the evidence and accept or correct it.",
  },
  CLASS_UNRESOLVED: {
    label: "Class could not be resolved",
    fixOwner: "Reviewer",
    remediation: "Assign the correct taxonomy class; this unblocks the rest of the schema.",
  },
  CONFLICTING_SOURCES: {
    label: "Conflicting sources",
    fixOwner: "Reviewer",
    remediation: "Two sources disagree — pick the authoritative one or mark both as reviewed.",
  },
  POLICY_BLOCKED: {
    label: "Blocked by policy",
    fixOwner: "Approver",
    remediation: "This value requires an explicit policy approval before it can be published.",
  },
  SYSTEM_ERROR: {
    label: "System error",
    fixOwner: "Engineering",
    remediation: "The pipeline errored on this attribute — check the run log and retry.",
  },
};
