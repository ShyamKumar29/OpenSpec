/**
 * Evaluation runs (docs/api.md §Evaluation & dashboard). Five historical runs with
 * plausible, imperfect metrics that improve gradually — per
 * docs/14-frontend-implementation-plan.md §C2: "fabricated metrics are plausible and
 * imperfect... never round, never 100% except QR-8/QR-9." Real and synthetic slices
 * are reported separately (FR-EVL-4) — `is_real` distinguishes them.
 */
import { isoDaysAgo } from "./rng";

interface RunSeed {
  id: string;
  gitSha: string;
  daysAgo: number;
  stp: number;
  stpAuto: number;
  precision: number;
  recall: number;
  ece: number;
  overAbstention: number;
}

// Trending upward over four weeks — a real CI-generated quality trend, not a single
// night-before measurement (docs/07-devops.md §6.2).
const SEEDS: RunSeed[] = [
  {
    id: "eval_run_1",
    gitSha: "a1c4e02",
    daysAgo: 28,
    stp: 0.512,
    stpAuto: 0.641,
    precision: 0.968,
    recall: 0.887,
    ece: 0.061,
    overAbstention: 0.211,
  },
  {
    id: "eval_run_2",
    gitSha: "b7f19aa",
    daysAgo: 21,
    stp: 0.539,
    stpAuto: 0.668,
    precision: 0.974,
    recall: 0.901,
    ece: 0.052,
    overAbstention: 0.187,
  },
  {
    id: "eval_run_3",
    gitSha: "c92d0f1",
    daysAgo: 14,
    stp: 0.551,
    stpAuto: 0.682,
    precision: 0.977,
    recall: 0.909,
    ece: 0.047,
    overAbstention: 0.169,
  },
  {
    id: "eval_run_4",
    gitSha: "d4a7b3e",
    daysAgo: 7,
    stp: 0.566,
    stpAuto: 0.701,
    precision: 0.98,
    recall: 0.914,
    ece: 0.043,
    overAbstention: 0.156,
  },
  {
    id: "eval_run_5",
    gitSha: "e01f8c6",
    daysAgo: 1,
    stp: 0.578,
    stpAuto: 0.714,
    precision: 0.982,
    recall: 0.918,
    ece: 0.038,
    overAbstention: 0.148,
  },
];

function metric(
  code: string,
  slice: string,
  value: number,
  n: number,
  isReal: boolean,
  halfWidth: number,
) {
  return {
    metric_code: code,
    slice,
    value,
    ci_low: Math.max(0, Math.round((value - halfWidth) * 1000) / 1000),
    ci_high: Math.min(1, Math.round((value + halfWidth) * 1000) / 1000),
    n,
    is_real: isReal,
  };
}

function headlineMetrics(seed: RunSeed) {
  return [
    metric("stp_all_mandatory", "overall", seed.stp, 412, true, 0.021),
    metric("stp_auto_eligible_only", "overall", seed.stpAuto, 412, true, 0.02),
    metric("precision", "overall", seed.precision, 412, true, 0.009),
    metric("recall", "overall", seed.recall, 412, true, 0.014),
    metric("ece", "overall", seed.ece, 412, true, 0.008),
    metric("over_abstention_rate", "overall", seed.overAbstention, 412, true, 0.018),
  ];
}

export function generateEvalRuns(): { summaries: unknown[]; details: Record<string, unknown> } {
  const summaries: unknown[] = [];
  const details: Record<string, unknown> = {};

  SEEDS.forEach((seed, i) => {
    const summary = {
      id: seed.id,
      git_sha: seed.gitSha,
      gold_set_version: `v1.${i}`,
      started_at: isoDaysAgo(seed.daysAgo),
      headline_metrics: headlineMetrics(seed),
    };
    summaries.push(summary);

    if (i === SEEDS.length - 1) {
      // Only the most recent run carries the full per-slice/frontier/ablation payload —
      // matches the plan's emphasis on the latest run for /evaluation.
      details[seed.id] = {
        ...summary,
        slice_metrics: [
          metric("precision", "real:ball_valve", 0.986, 180, true, 0.011),
          metric("precision", "real:gate_globe_check", 0.979, 96, true, 0.017),
          metric("precision", "real:pipe_fitting", 0.981, 70, true, 0.02),
          metric("precision", "synthetic:injection", 0.994, 60, false, 0.012),
          metric("precision", "synthetic:domain_knowledge_bait", 0.912, 40, false, 0.031),
        ],
        frontier: [
          {
            label: "OpenSpec (verified)",
            cost_usd_per_sku: 0.024,
            precision: seed.precision,
            is_baseline: false,
          },
          {
            label: "Generic LLM, no abstention",
            cost_usd_per_sku: 0.018,
            precision: 0.834,
            is_baseline: true,
          },
          {
            label: "OpenSpec, cached",
            cost_usd_per_sku: 0.006,
            precision: seed.precision - 0.001,
            is_baseline: false,
          },
        ],
        reliability: [
          {
            bucket_low: 0.0,
            bucket_high: 0.2,
            predicted_mean: 0.11,
            observed_accuracy: 0.09,
            count: 14,
          },
          {
            bucket_low: 0.2,
            bucket_high: 0.4,
            predicted_mean: 0.31,
            observed_accuracy: 0.28,
            count: 22,
          },
          {
            bucket_low: 0.4,
            bucket_high: 0.6,
            predicted_mean: 0.52,
            observed_accuracy: 0.49,
            count: 41,
          },
          {
            bucket_low: 0.6,
            bucket_high: 0.8,
            predicted_mean: 0.71,
            observed_accuracy: 0.69,
            count: 88,
          },
          {
            bucket_low: 0.8,
            bucket_high: 1.0,
            predicted_mean: 0.93,
            observed_accuracy: 0.94,
            count: 251,
          },
        ],
        ablation: [
          {
            component: "verification pass",
            metric_code: "precision",
            with_component: 0.982,
            without_component: 0.913,
            delta: 0.069,
          },
          {
            component: "deterministic pre-pass (CLS)",
            metric_code: "precision",
            with_component: 0.982,
            without_component: 0.958,
            delta: 0.024,
          },
          {
            component: "calibration (isotonic)",
            metric_code: "ece",
            with_component: 0.038,
            without_component: 0.121,
            delta: -0.083,
          },
        ],
      };
    }
  });

  return { summaries, details };
}
