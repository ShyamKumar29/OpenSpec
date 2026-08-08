/**
 * Review tasks (docs/api.md §Review), one per attribute value awaiting a human
 * decision. Target counts per reason code match the worked example in
 * docs/06-frontend.md §3.3 (412 open, six tabs) — a concrete, documented number rather
 * than an arbitrary one. `state: "open"` tasks are the ones the queue tabs count;
 * a modest resolved/skipped tail exists so the throughput meter has history to show.
 */
import type { Rng } from "./rng";
import { isoDaysAgo } from "./rng";
import type { ReviewReasonCode } from "@/lib/contracts/review";

interface AttrValueWire {
  id: string;
  status: string;
  unknown_reason: string | null;
  confidence: number | null;
  verification: { verdict: string; rationale: string } | null;
}

export interface RecordIndexEntry {
  id: string;
  mpnRaw: string;
  descriptionRaw: string;
}

const OPEN_TARGETS: Record<ReviewReasonCode, number> = {
  VERIFICATION_FAILED: 88,
  BELOW_THRESHOLD: 141,
  TIER0_APPROVAL: 96,
  NO_DOCUMENT: 51,
  AMBIGUOUS: 24,
  CONFLICTING: 12,
};

function bucketFor(av: AttrValueWire): ReviewReasonCode | null {
  if (av.status === "NEEDS_APPROVAL") return "TIER0_APPROVAL";
  if (av.status === "NEEDS_REVIEW") {
    return av.verification?.verdict === "NOT_ENTAILED" ? "VERIFICATION_FAILED" : "BELOW_THRESHOLD";
  }
  if (av.status === "UNKNOWN") {
    if (av.unknown_reason === "NO_DOCUMENT_FOUND") return "NO_DOCUMENT";
    if (av.unknown_reason === "AMBIGUOUS_CANDIDATES") return "AMBIGUOUS";
    if (av.unknown_reason === "CONFLICTING_SOURCES") return "CONFLICTING";
  }
  return null;
}

export function generateReviewTasks(
  rng: Rng,
  attributeValues: (AttrValueWire & {
    record_id: string;
    attribute_code: string;
    attribute_name: string;
    risk_tier: 0 | 1 | 2 | 3;
  })[],
  recordIndex: Map<string, RecordIndexEntry>,
  bindingByRecord: Map<string, { documentVersionId: string; page: number }>,
): unknown[] {
  const buckets: Record<ReviewReasonCode, typeof attributeValues> = {
    VERIFICATION_FAILED: [],
    BELOW_THRESHOLD: [],
    TIER0_APPROVAL: [],
    NO_DOCUMENT: [],
    AMBIGUOUS: [],
    CONFLICTING: [],
  };

  for (const av of attributeValues) {
    const bucket = bucketFor(av);
    if (bucket) buckets[bucket].push(av);
  }

  const tasks: unknown[] = [];
  let priorityCounter = 0;

  (Object.keys(OPEN_TARGETS) as ReviewReasonCode[]).forEach((reasonCode) => {
    const pool = rng.shuffle(buckets[reasonCode]);
    const openCount = Math.min(OPEN_TARGETS[reasonCode], pool.length);
    const resolvedCount = Math.min(Math.round(openCount * 0.12), pool.length - openCount);

    for (let i = 0; i < openCount; i++) {
      tasks.push(
        buildTask(
          rng,
          pool[i],
          reasonCode,
          recordIndex,
          bindingByRecord,
          "open",
          priorityCounter++,
        ),
      );
    }
    for (let i = openCount; i < openCount + resolvedCount; i++) {
      tasks.push(
        buildTask(
          rng,
          pool[i],
          reasonCode,
          recordIndex,
          bindingByRecord,
          "resolved",
          priorityCounter++,
        ),
      );
    }
  });

  return tasks;
}

function buildTask(
  rng: Rng,
  av: {
    id: string;
    status: string;
    unknown_reason: string | null;
    confidence: number | null;
    verification: { verdict: string; rationale: string } | null;
    record_id: string;
    attribute_code: string;
    attribute_name: string;
    risk_tier: 0 | 1 | 2 | 3;
  },
  reasonCode: ReviewReasonCode,
  recordIndex: Map<string, RecordIndexEntry>,
  bindingByRecord: Map<string, { documentVersionId: string; page: number }>,
  state: "open" | "resolved",
  priority: number,
) {
  const record = recordIndex.get(av.record_id);
  const binding = bindingByRecord.get(av.record_id);
  const openedDaysAgo = rng.int(0, 21);
  return {
    id: `task_${av.id}`,
    record_id: av.record_id,
    record_mpn: record?.mpnRaw ?? "UNKNOWN",
    record_description: record?.descriptionRaw ?? "",
    attribute_value_id: av.id,
    attribute_code: av.attribute_code,
    attribute_name: av.attribute_name,
    risk_tier: av.risk_tier,
    reason_code: reasonCode,
    state,
    priority,
    assigned_to: state === "resolved" ? "reviewer_demo" : null,
    proposed_value: av.status === "UNKNOWN" ? null : av,
    rejection_reason: av.verification?.rationale ?? null,
    document_version_id: binding?.documentVersionId ?? null,
    page: binding?.page ?? null,
    similar_task_count: rng.int(0, 14),
    opened_at: isoDaysAgo(openedDaysAgo),
    closed_at: state === "resolved" ? isoDaysAgo(rng.int(0, openedDaysAgo)) : null,
  };
}
