import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StpMeters } from "./stp-meters";
import type { EvalMetric } from "@/lib/contracts/eval";

function metric(value: number, ciLow: number, ciHigh: number): EvalMetric {
  return {
    metricCode: "stp_all_mandatory",
    slice: "overall",
    value,
    ciLow,
    ciHigh,
    n: 412,
    isReal: true,
  };
}

describe("StpMeters", () => {
  it("renders both QR-3 (all mandatory) and QR-4 (auto-eligible) with their point estimates", () => {
    render(
      <StpMeters
        allMandatory={metric(0.578, 0.557, 0.599)}
        autoEligible={metric(0.714, 0.694, 0.734)}
      />,
    );
    expect(screen.getByText("All mandatory attributes")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText("Auto-eligible attributes only")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("never renders a bare point estimate — the Wilson CI is always shown alongside it (ASM-7)", () => {
    render(
      <StpMeters
        allMandatory={metric(0.578, 0.557, 0.599)}
        autoEligible={metric(0.714, 0.694, 0.734)}
      />,
    );
    expect(screen.getByText(/CI \[56%, 60%\]/)).toBeInTheDocument();
    expect(screen.getByText(/CI \[69%, 73%\]/)).toBeInTheDocument();
  });

  it("labels the governing requirement and its target/stretch thresholds", () => {
    render(
      <StpMeters
        allMandatory={metric(0.578, 0.557, 0.599)}
        autoEligible={metric(0.714, 0.694, 0.734)}
      />,
    );
    expect(screen.getByText(/QR-3 · target 55% · stretch 70%/)).toBeInTheDocument();
    expect(screen.getByText(/QR-4 · target 75% · stretch 90%/)).toBeInTheDocument();
  });
});
