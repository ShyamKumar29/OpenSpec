import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReliabilityDiagram } from "./reliability-diagram";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const RELIABILITY: EvalRunDetail["reliability"] = [
  { bucketLow: 0.0, bucketHigh: 0.2, predictedMean: 0.11, observedAccuracy: 0.09, count: 14 },
  { bucketLow: 0.8, bucketHigh: 1.0, predictedMean: 0.93, observedAccuracy: 0.94, count: 251 },
];

describe("ReliabilityDiagram", () => {
  it("renders an accessible chart description naming every bucket", () => {
    render(<ReliabilityDiagram reliability={RELIABILITY} ece={0.038} />);
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("n=14");
    expect(chart.getAttribute("aria-label")).toContain("n=251");
  });

  it("reports the ECE headline number alongside its QR-13 target in the caption", () => {
    render(<ReliabilityDiagram reliability={RELIABILITY} ece={0.038} />);
    expect(screen.getByText("0.038")).toBeInTheDocument();
    expect(screen.getByText(/QR-13, target ≤0.05/)).toBeInTheDocument();
  });

  it("renders an honest empty state instead of a blank chart when no reliability data exists", () => {
    render(<ReliabilityDiagram reliability={[]} />);
    expect(screen.getByText("No reliability data for this run")).toBeInTheDocument();
  });
});
