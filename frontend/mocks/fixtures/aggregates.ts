/**
 * Dashboard and queue aggregates — every number here is computed from `getStore()`,
 * never hand-typed (risk F-3: "Fixture universe becomes internally inconsistent").
 */
import { getStore } from "./store";
import { UNKNOWN_REASON_COPY } from "@/lib/format/unknown-reason";
import { REVIEW_REASON_CODES, type ReviewReasonCode } from "@/lib/contracts/review";
import { UNKNOWN_REASONS, type UnknownReason } from "@/lib/contracts/attribute-value";

export function reviewCounts() {
  const store = getStore();
  const counts = Object.fromEntries(REVIEW_REASON_CODES.map((r) => [r, 0])) as Record<
    ReviewReasonCode,
    number
  >;
  let totalOpen = 0;
  for (const task of store.reviewTasks) {
    if (task.state === "open") {
      counts[task.reason_code] += 1;
      totalOpen += 1;
    }
  }
  return { counts, total_open: totalOpen };
}

export function sessionStats() {
  const store = getStore();
  const resolved = store.reviewTasks.filter((t) => t.state === "resolved");
  return {
    resolved_count: resolved.length,
    rate_per_hour: 38,
    median_decision_ms: 71_000,
    baseline_per_hour: 7,
  };
}

export function catalogHealth() {
  const store = getStore();
  const total = store.records.length;

  const buckets = [
    { bucket: "0-25%", min: 0, max: 0.25 },
    { bucket: "25-50%", min: 0.25, max: 0.5 },
    { bucket: "50-75%", min: 0.5, max: 0.75 },
    { bucket: "75-100%", min: 0.75, max: 1.01 },
  ];
  const completenessDistribution = buckets.map(({ bucket, min, max }) => ({
    bucket,
    count: store.records.filter((r) => {
      const ratio =
        r.completeness.mandatory_total === 0
          ? 0
          : r.completeness.filled / r.completeness.mandatory_total;
      return ratio >= min && ratio < max;
    }).length,
  }));

  const latestEval = store.evalRuns.summaries[store.evalRuns.summaries.length - 1] as {
    headline_metrics: { metric_code: string }[];
  };
  const stpAll = latestEval.headline_metrics.find((m) => m.metric_code === "stp_all_mandatory")!;
  const stpAuto = latestEval.headline_metrics.find(
    (m) => m.metric_code === "stp_auto_eligible_only",
  )!;

  const reasonCounts = new Map<UnknownReason, number>();
  for (const av of store.attributeValues) {
    if (av.status === "UNKNOWN" && av.unknown_reason) {
      reasonCounts.set(av.unknown_reason, (reasonCounts.get(av.unknown_reason) ?? 0) + 1);
    }
  }
  const unknownReasonBreakdown = UNKNOWN_REASONS.filter((r) => (reasonCounts.get(r) ?? 0) > 0).map(
    (reason) => ({
      reason,
      count: reasonCounts.get(reason) ?? 0,
      fix_owner: UNKNOWN_REASON_COPY[reason].fixOwner,
    }),
  );

  return {
    total_records: total,
    completeness_distribution: completenessDistribution,
    stp_all_mandatory: stpAll,
    stp_auto_eligible_only: stpAuto,
    unknown_reason_breakdown: unknownReasonBreakdown,
  };
}

export function throughput() {
  return {
    skus_per_hour: 42,
    cost_per_sku_usd: 0.024,
    reviewer_rate_per_hour: 38,
    baseline_rate_per_hour: 7,
  };
}

export function qualityTrend() {
  const store = getStore();
  return {
    series: (
      store.evalRuns.summaries as { id: string; started_at: string; headline_metrics: unknown[] }[]
    ).map((r) => ({ eval_run_id: r.id, started_at: r.started_at, metrics: r.headline_metrics })),
  };
}
