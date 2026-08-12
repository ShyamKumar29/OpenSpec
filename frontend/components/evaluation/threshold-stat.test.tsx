import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThresholdStat } from "./threshold-stat";
import { metricMeta } from "@/lib/evaluation/metric-meta";
import type { EvalMetric } from "@/lib/contracts/eval";

function metric(value: number): EvalMetric {
  return {
    metricCode: "over_abstention_rate",
    slice: "overall",
    value,
    ciLow: value - 0.01,
    ciHigh: value + 0.01,
    n: 412,
    isReal: true,
  };
}

describe("ThresholdStat", () => {
  it("shows 'Within target' when the value clears the target but not the stretch (lower-is-better)", () => {
    render(<ThresholdStat metric={metric(0.148)} meta={metricMeta("over_abstention_rate")} />);
    expect(screen.getByText("Within target")).toBeInTheDocument();
  });

  it("shows 'Above target' when a lower-is-better value exceeds its target", () => {
    render(<ThresholdStat metric={metric(0.25)} meta={metricMeta("over_abstention_rate")} />);
    expect(screen.getByText("Above target")).toBeInTheDocument();
  });

  it("shows 'At stretch' when the value clears the stretch bound", () => {
    render(<ThresholdStat metric={metric(0.1)} meta={metricMeta("over_abstention_rate")} />);
    expect(screen.getByText("At stretch")).toBeInTheDocument();
  });

  it("never renders a bare point estimate — the Wilson CI is always alongside it (ASM-7)", () => {
    render(<ThresholdStat metric={metric(0.148)} meta={metricMeta("over_abstention_rate")} />);
    expect(screen.getByText(/CI \[/)).toBeInTheDocument();
  });

  it("supports a custom value formatter (ECE as a raw decimal, not a percent)", () => {
    const eceMetric: EvalMetric = {
      metricCode: "ece",
      slice: "overall",
      value: 0.038,
      ciLow: 0.03,
      ciHigh: 0.046,
      n: 412,
      isReal: true,
    };
    render(
      <ThresholdStat
        metric={eceMetric}
        meta={metricMeta("ece")}
        formatValue={(v) => v.toFixed(3)}
      />,
    );
    expect(screen.getByText("0.038")).toBeInTheDocument();
    expect(screen.getByText(/target ≤0.050/)).toBeInTheDocument();
  });
});
