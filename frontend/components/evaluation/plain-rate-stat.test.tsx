import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlainRateStat } from "./plain-rate-stat";
import { metricMeta } from "@/lib/evaluation/metric-meta";
import type { EvalMetric } from "@/lib/contracts/eval";

describe("PlainRateStat", () => {
  it("renders the numeral and Wilson CI without implying a pass/fail threshold", () => {
    const recall: EvalMetric = {
      metricCode: "recall",
      slice: "overall",
      value: 0.918,
      ciLow: 0.9,
      ciHigh: 0.93,
      n: 412,
      isReal: true,
    };
    render(<PlainRateStat metric={recall} meta={metricMeta("recall")} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/CI \[90%, 93%\]/)).toBeInTheDocument();
    expect(screen.getByText(/no codified QR target/)).toBeInTheDocument();
  });
});
