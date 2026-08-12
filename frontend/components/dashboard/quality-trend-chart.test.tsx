import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QualityTrendChart } from "./quality-trend-chart";
import type { QualityTrend } from "@/lib/contracts/eval";

function metric(code: string, value: number) {
  return {
    metricCode: code,
    slice: "overall",
    value,
    ciLow: value,
    ciHigh: value,
    n: 412,
    isReal: true,
  };
}

const TREND: QualityTrend = {
  series: [
    {
      evalRunId: "eval_run_1",
      startedAt: "2026-07-13T00:00:00Z",
      metrics: [metric("stp_all_mandatory", 0.512), metric("precision", 0.968)],
    },
    {
      evalRunId: "eval_run_5",
      startedAt: "2026-08-09T00:00:00Z",
      metrics: [metric("stp_all_mandatory", 0.578), metric("precision", 0.982)],
    },
  ],
};

describe("QualityTrendChart", () => {
  it("renders both metrics as separate single-axis charts (never one chart, two y-scales)", () => {
    render(<QualityTrendChart trend={TREND} />);
    expect(screen.getByText("STP (all mandatory)")).toBeInTheDocument();
    expect(screen.getByText("Precision (auto-accepted)")).toBeInTheDocument();
  });

  it("shows the latest value and a signed delta against the oldest run", () => {
    render(<QualityTrendChart trend={TREND} />);
    expect(screen.getByText("58%")).toBeInTheDocument(); // latest STP
    expect(screen.getByText(/\+7pts vs 1 run ago/)).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument(); // latest precision
  });

  it("labels every series with its provenance — real or synthetic (C2, permanent source label)", () => {
    render(<QualityTrendChart trend={TREND} />);
    expect(screen.getAllByText("Real slice")).toHaveLength(2);
  });

  it("labels a mixed real/synthetic series as synthetic rather than silently blending them", () => {
    const mixed: QualityTrend = {
      series: [
        {
          evalRunId: "eval_run_1",
          startedAt: "2026-07-13T00:00:00Z",
          metrics: [{ ...metric("stp_all_mandatory", 0.5), isReal: false }],
        },
        {
          evalRunId: "eval_run_2",
          startedAt: "2026-08-09T00:00:00Z",
          metrics: [{ ...metric("stp_all_mandatory", 0.55), isReal: true }],
        },
      ],
    };
    render(<QualityTrendChart trend={mixed} />);
    expect(screen.getByText("Synthetic slice")).toBeInTheDocument();
  });

  it("renders a graceful empty state for a metric with no data rather than crashing", () => {
    render(<QualityTrendChart trend={{ series: [] }} />);
    expect(screen.getAllByText("No eval runs yet.")).toHaveLength(2);
  });
});
