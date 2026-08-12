import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostPanel } from "./cost-panel";
import type { Throughput } from "@/lib/contracts/eval";

const THROUGHPUT: Throughput = {
  skusPerHour: 42,
  costPerSkuUsd: 0.024,
  reviewerRatePerHour: 38,
  baselineRatePerHour: 7,
};

describe("CostPanel", () => {
  it("renders the cost per SKU and throughput together", () => {
    render(<CostPanel throughput={THROUGHPUT} />);
    expect(screen.getByText("$0.024")).toBeInTheDocument();
    expect(screen.getByText("42/hr throughput")).toBeInTheDocument();
  });

  it("labels NFR-CST-1's target and stretch ceilings", () => {
    render(<CostPanel throughput={THROUGHPUT} />);
    expect(screen.getByText(/NFR-CST-1 · target ≤\$0\.12 · stretch ≤\$0\.05/)).toBeInTheDocument();
  });
});
