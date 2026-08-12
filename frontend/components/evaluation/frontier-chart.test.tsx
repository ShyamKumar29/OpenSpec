import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FrontierChart } from "./frontier-chart";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const FRONTIER: EvalRunDetail["frontier"] = [
  { label: "OpenSpec (verified)", costUsdPerSku: 0.024, precision: 0.982, isBaseline: false },
  { label: "Generic LLM, no abstention", costUsdPerSku: 0.018, precision: 0.834, isBaseline: true },
  { label: "OpenSpec, cached", costUsdPerSku: 0.006, precision: 0.981, isBaseline: false },
];

describe("FrontierChart", () => {
  it("plots every point's label and renders an accessible chart description", () => {
    render(<FrontierChart frontier={FRONTIER} />);
    expect(screen.getAllByText("OpenSpec (verified)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Generic LLM, no abstention").length).toBeGreaterThan(0);
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("98%");
  });

  it("names the baseline in its explanatory caption", () => {
    render(<FrontierChart frontier={FRONTIER} />);
    expect(screen.getAllByText(/Generic LLM, no abstention/).length).toBeGreaterThan(0);
    expect(screen.getByText(/always answers instead of returning/)).toBeInTheDocument();
  });

  it("renders an honest empty state instead of a blank chart when no frontier data exists", () => {
    render(<FrontierChart frontier={[]} />);
    expect(screen.getByText("No frontier data for this run")).toBeInTheDocument();
  });
});
