/**
 * Review queue (docs/api.md §Review). The six review reason codes are the queue tabs
 * shown in docs/06-frontend.md §3.3: VERIFICATION_FAILED · BELOW_THRESHOLD ·
 * TIER0_APPROVAL · NO_DOCUMENT · AMBIGUOUS · CONFLICTING.
 */
import { z } from "zod";
import { adaptAttributeValue, attributeValueWireSchema } from "./attribute-value";
import type { AttributeValue } from "./attribute-value";

export const REVIEW_REASON_CODES = [
  "VERIFICATION_FAILED",
  "BELOW_THRESHOLD",
  "TIER0_APPROVAL",
  "NO_DOCUMENT",
  "AMBIGUOUS",
  "CONFLICTING",
] as const;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

export const REVIEW_TASK_STATES = ["open", "claimed", "resolved", "skipped"] as const;
export type ReviewTaskState = (typeof REVIEW_TASK_STATES)[number];

export const reviewTaskWireSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  record_mpn: z.string(),
  record_description: z.string(),
  attribute_value_id: z.string(),
  attribute_code: z.string(),
  attribute_name: z.string(),
  risk_tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  reason_code: z.enum(REVIEW_REASON_CODES),
  state: z.enum(REVIEW_TASK_STATES),
  priority: z.number().int(),
  assigned_to: z.string().nullable(),
  proposed_value: attributeValueWireSchema.nullable(),
  rejection_reason: z.string().nullable(),
  document_version_id: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  similar_task_count: z.number().int().nonnegative(),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
});
export type ReviewTaskWire = z.infer<typeof reviewTaskWireSchema>;

export interface ReviewTask {
  id: string;
  recordId: string;
  recordMpn: string;
  recordDescription: string;
  attributeValueId: string;
  attributeCode: string;
  attributeName: string;
  riskTier: 0 | 1 | 2 | 3;
  reasonCode: ReviewReasonCode;
  state: ReviewTaskState;
  priority: number;
  assignedTo: string | null;
  proposedValue: AttributeValue | null;
  rejectionReason: string | null;
  documentVersionId: string | null;
  page: number | null;
  similarTaskCount: number;
  openedAt: string;
  closedAt: string | null;
}

export function adaptReviewTask(wireInput: unknown): ReviewTask {
  const wire = reviewTaskWireSchema.parse(wireInput);
  return {
    id: wire.id,
    recordId: wire.record_id,
    recordMpn: wire.record_mpn,
    recordDescription: wire.record_description,
    attributeValueId: wire.attribute_value_id,
    attributeCode: wire.attribute_code,
    attributeName: wire.attribute_name,
    riskTier: wire.risk_tier,
    reasonCode: wire.reason_code,
    state: wire.state,
    priority: wire.priority,
    assignedTo: wire.assigned_to,
    proposedValue: wire.proposed_value ? adaptAttributeValue(wire.proposed_value) : null,
    rejectionReason: wire.rejection_reason,
    documentVersionId: wire.document_version_id,
    page: wire.page,
    similarTaskCount: wire.similar_task_count,
    openedAt: wire.opened_at,
    closedAt: wire.closed_at,
  };
}

export const reviewCountsWireSchema = z.object({
  counts: z.record(z.enum(REVIEW_REASON_CODES), z.number().int().nonnegative()),
  total_open: z.number().int().nonnegative(),
});
export type ReviewCountsWire = z.infer<typeof reviewCountsWireSchema>;

export interface ReviewCounts {
  counts: Record<ReviewReasonCode, number>;
  totalOpen: number;
}

export function adaptReviewCounts(wireInput: unknown): ReviewCounts {
  const wire = reviewCountsWireSchema.parse(wireInput);
  return { counts: wire.counts as Record<ReviewReasonCode, number>, totalOpen: wire.total_open };
}

export const sessionStatsWireSchema = z.object({
  resolved_count: z.number().int().nonnegative(),
  rate_per_hour: z.number().nonnegative(),
  median_decision_ms: z.number().nonnegative(),
  baseline_per_hour: z.number().positive(),
});
export type SessionStatsWire = z.infer<typeof sessionStatsWireSchema>;

export interface SessionStats {
  resolvedCount: number;
  ratePerHour: number;
  medianDecisionMs: number;
  baselinePerHour: number;
}

export function adaptSessionStats(wireInput: unknown): SessionStats {
  const wire = sessionStatsWireSchema.parse(wireInput);
  return {
    resolvedCount: wire.resolved_count,
    ratePerHour: wire.rate_per_hour,
    medianDecisionMs: wire.median_decision_ms,
    baselinePerHour: wire.baseline_per_hour,
  };
}
