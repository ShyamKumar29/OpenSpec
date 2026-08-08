/**
 * Evaluation & dashboard metrics (docs/api.md §Evaluation & dashboard).
 * Confidence intervals are stored, never bare point estimates (ASM-7).
 * `isReal` mirrors `gold_label.is_real` (docs/04-data-model.md §3.7) — FR-EVL-4 requires
 * real and synthetic slices reported separately and labelled, never blended silently.
 */
import { z } from "zod";

const metricWireSchema = z.object({
  metric_code: z.string(),
  slice: z.string(),
  value: z.number(),
  ci_low: z.number(),
  ci_high: z.number(),
  n: z.number().int().nonnegative(),
  is_real: z.boolean(),
});
export type EvalMetricWire = z.infer<typeof metricWireSchema>;

export interface EvalMetric {
  metricCode: string;
  slice: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  n: number;
  isReal: boolean;
}

function adaptMetric(wire: EvalMetricWire): EvalMetric {
  return {
    metricCode: wire.metric_code,
    slice: wire.slice,
    value: wire.value,
    ciLow: wire.ci_low,
    ciHigh: wire.ci_high,
    n: wire.n,
    isReal: wire.is_real,
  };
}

export const evalRunSummaryWireSchema = z.object({
  id: z.string(),
  git_sha: z.string(),
  gold_set_version: z.string(),
  started_at: z.string(),
  headline_metrics: z.array(metricWireSchema),
});
export type EvalRunSummaryWire = z.infer<typeof evalRunSummaryWireSchema>;

export interface EvalRunSummary {
  id: string;
  gitSha: string;
  goldSetVersion: string;
  startedAt: string;
  headlineMetrics: EvalMetric[];
}

export function adaptEvalRunSummary(wireInput: unknown): EvalRunSummary {
  const wire = evalRunSummaryWireSchema.parse(wireInput);
  return {
    id: wire.id,
    gitSha: wire.git_sha,
    goldSetVersion: wire.gold_set_version,
    startedAt: wire.started_at,
    headlineMetrics: wire.headline_metrics.map(adaptMetric),
  };
}

const frontierPointWireSchema = z.object({
  label: z.string(),
  cost_usd_per_sku: z.number().nonnegative(),
  precision: z.number().min(0).max(1),
  is_baseline: z.boolean(),
});

const reliabilityBucketWireSchema = z.object({
  bucket_low: z.number().min(0).max(1),
  bucket_high: z.number().min(0).max(1),
  predicted_mean: z.number().min(0).max(1),
  observed_accuracy: z.number().min(0).max(1),
  count: z.number().int().nonnegative(),
});

const ablationRowWireSchema = z.object({
  component: z.string(),
  metric_code: z.string(),
  with_component: z.number(),
  without_component: z.number(),
  delta: z.number(),
});

export const evalRunDetailWireSchema = evalRunSummaryWireSchema.extend({
  slice_metrics: z.array(metricWireSchema),
  frontier: z.array(frontierPointWireSchema),
  reliability: z.array(reliabilityBucketWireSchema),
  ablation: z.array(ablationRowWireSchema),
});
export type EvalRunDetailWire = z.infer<typeof evalRunDetailWireSchema>;

export interface EvalRunDetail extends EvalRunSummary {
  sliceMetrics: EvalMetric[];
  frontier: { label: string; costUsdPerSku: number; precision: number; isBaseline: boolean }[];
  reliability: {
    bucketLow: number;
    bucketHigh: number;
    predictedMean: number;
    observedAccuracy: number;
    count: number;
  }[];
  ablation: {
    component: string;
    metricCode: string;
    withComponent: number;
    withoutComponent: number;
    delta: number;
  }[];
}

export function adaptEvalRunDetail(wireInput: unknown): EvalRunDetail {
  const wire = evalRunDetailWireSchema.parse(wireInput);
  return {
    ...adaptEvalRunSummary(wire),
    sliceMetrics: wire.slice_metrics.map(adaptMetric),
    frontier: wire.frontier.map((p) => ({
      label: p.label,
      costUsdPerSku: p.cost_usd_per_sku,
      precision: p.precision,
      isBaseline: p.is_baseline,
    })),
    reliability: wire.reliability.map((b) => ({
      bucketLow: b.bucket_low,
      bucketHigh: b.bucket_high,
      predictedMean: b.predicted_mean,
      observedAccuracy: b.observed_accuracy,
      count: b.count,
    })),
    ablation: wire.ablation.map((a) => ({
      component: a.component,
      metricCode: a.metric_code,
      withComponent: a.with_component,
      withoutComponent: a.without_component,
      delta: a.delta,
    })),
  };
}

export const catalogHealthWireSchema = z.object({
  total_records: z.number().int().nonnegative(),
  completeness_distribution: z.array(
    z.object({ bucket: z.string(), count: z.number().int().nonnegative() }),
  ),
  stp_all_mandatory: metricWireSchema,
  stp_auto_eligible_only: metricWireSchema,
  unknown_reason_breakdown: z.array(
    z.object({ reason: z.string(), count: z.number().int().nonnegative(), fix_owner: z.string() }),
  ),
});
export type CatalogHealthWire = z.infer<typeof catalogHealthWireSchema>;

export interface CatalogHealth {
  totalRecords: number;
  completenessDistribution: { bucket: string; count: number }[];
  stpAllMandatory: EvalMetric;
  stpAutoEligibleOnly: EvalMetric;
  unknownReasonBreakdown: { reason: string; count: number; fixOwner: string }[];
}

export function adaptCatalogHealth(wireInput: unknown): CatalogHealth {
  const wire = catalogHealthWireSchema.parse(wireInput);
  return {
    totalRecords: wire.total_records,
    completenessDistribution: wire.completeness_distribution,
    stpAllMandatory: adaptMetric(wire.stp_all_mandatory),
    stpAutoEligibleOnly: adaptMetric(wire.stp_auto_eligible_only),
    unknownReasonBreakdown: wire.unknown_reason_breakdown.map((r) => ({
      reason: r.reason,
      count: r.count,
      fixOwner: r.fix_owner,
    })),
  };
}

export const throughputWireSchema = z.object({
  skus_per_hour: z.number().nonnegative(),
  cost_per_sku_usd: z.number().nonnegative(),
  reviewer_rate_per_hour: z.number().nonnegative(),
  baseline_rate_per_hour: z.number().positive(),
});
export type ThroughputWire = z.infer<typeof throughputWireSchema>;

export interface Throughput {
  skusPerHour: number;
  costPerSkuUsd: number;
  reviewerRatePerHour: number;
  baselineRatePerHour: number;
}

export function adaptThroughput(wireInput: unknown): Throughput {
  const wire = throughputWireSchema.parse(wireInput);
  return {
    skusPerHour: wire.skus_per_hour,
    costPerSkuUsd: wire.cost_per_sku_usd,
    reviewerRatePerHour: wire.reviewer_rate_per_hour,
    baselineRatePerHour: wire.baseline_rate_per_hour,
  };
}

export const qualityTrendWireSchema = z.object({
  series: z.array(
    z.object({
      eval_run_id: z.string(),
      started_at: z.string(),
      metrics: z.array(metricWireSchema),
    }),
  ),
});
export type QualityTrendWire = z.infer<typeof qualityTrendWireSchema>;

export interface QualityTrend {
  series: { evalRunId: string; startedAt: string; metrics: EvalMetric[] }[];
}

export function adaptQualityTrend(wireInput: unknown): QualityTrend {
  const wire = qualityTrendWireSchema.parse(wireInput);
  return {
    series: wire.series.map((s) => ({
      evalRunId: s.eval_run_id,
      startedAt: s.started_at,
      metrics: s.metrics.map(adaptMetric),
    })),
  };
}
