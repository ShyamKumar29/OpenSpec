import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeadlineMetricsGrid } from "./headline-metrics-grid";
import type { EvalMetric } from "@/lib/contracts/eval";

function metric(code: string, value: number, isReal = true): EvalMetric {
  return {
    metricCode: code,
    slice: "overall",
    value,
    ciLow: value - 0.01,
    ciHigh: value + 0.01,
    n: 412,
    isReal,
  };
}

const HEADLINE: EvalMetric[] = [
  metric("stp_all_mandatory", 0.578),
  metric("stp_auto_eligible_only", 0.714),
  metric("precision", 0.982),
  metric("recall", 0.918),
  metric("ece", 0.038),
  metric("over_abstention_rate", 0.148),
];

describe("HeadlineMetricsGrid", () => {
  it("renders all six headline metrics with their target-bearing QR requirement tags", () => {
    render(
      <HeadlineMetricsGrid headlineMetrics={HEADLINE} runId="eval_run_5" goldSetVersion="v1.4" />,
    );
    expect(screen.getByText(/QR-3 · target 55% · stretch 70%/)).toBeInTheDocument();
    expect(screen.getByText(/QR-4 · target 75% · stretch 90%/)).toBeInTheDocument();
    expect(screen.getByText(/QR-1 \/ QR-2 · target 95% · stretch 99%/)).toBeInTheDocument();
    expect(screen.getByText("Recall")).toBeInTheDocument();
    expect(screen.getByText("Expected Calibration Error")).toBeInTheDocument();
    expect(screen.getByText("Over-abstention rate")).toBeInTheDocument();
  });

  it("formats ECE as a raw decimal, not a percent (matches CLAUDE.md's own 'ECE ~0.04' convention)", () => {
    render(
      <HeadlineMetricsGrid headlineMetrics={HEADLINE} runId="eval_run_5" goldSetVersion="v1.4" />,
    );
    expect(screen.getByText("0.038")).toBeInTheDocument();
  });

  it("shows the eval-run source line and the real-slice badge", () => {
    render(
      <HeadlineMetricsGrid headlineMetrics={HEADLINE} runId="eval_run_5" goldSetVersion="v1.4" />,
    );
    expect(screen.getByText(/Source: eval run eval_run_5 · gold set v1.4/)).toBeInTheDocument();
    expect(screen.getByText("Real slice")).toBeInTheDocument();
  });

  it("labels the block as synthetic when any headline metric is synthetic", () => {
    const mixed = [...HEADLINE.slice(0, -1), metric("over_abstention_rate", 0.148, false)];
    render(
      <HeadlineMetricsGrid headlineMetrics={mixed} runId="eval_run_5" goldSetVersion="v1.4" />,
    );
    expect(screen.getByText("Synthetic slice")).toBeInTheDocument();
  });

  it("degrades gracefully when a metric is missing rather than crashing", () => {
    render(
      <HeadlineMetricsGrid
        headlineMetrics={[metric("precision", 0.98)]}
        runId="eval_run_5"
        goldSetVersion="v1.4"
      />,
    );
    expect(screen.getByText(/QR-1 \/ QR-2/)).toBeInTheDocument();
    expect(screen.queryByText("Recall")).not.toBeInTheDocument();
  });
});
