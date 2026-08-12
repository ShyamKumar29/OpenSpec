import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AblationTable } from "./ablation-table";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const ABLATION: EvalRunDetail["ablation"] = [
  {
    component: "verification pass",
    metricCode: "precision",
    withComponent: 0.982,
    withoutComponent: 0.913,
    delta: 0.069,
  },
  {
    component: "calibration (isotonic)",
    metricCode: "ece",
    withComponent: 0.038,
    withoutComponent: 0.121,
    delta: -0.083,
  },
];

describe("AblationTable", () => {
  it("reports a precision-raising layer as an improvement", () => {
    render(<AblationTable ablation={ABLATION} />);
    expect(screen.getByText(/improves precision.*by 7%/)).toBeInTheDocument();
  });

  it("reports an ECE-lowering layer as an improvement even though its raw delta is negative", () => {
    render(<AblationTable ablation={ABLATION} />);
    expect(screen.getByText(/improves expected calibration error.*by 0.083/i)).toBeInTheDocument();
  });

  it("formats ECE with/without as raw decimals, and precision as percents", () => {
    render(<AblationTable ablation={ABLATION} />);
    expect(screen.getByText("0.038")).toBeInTheDocument();
    expect(screen.getByText("0.121")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
  });

  it("renders an honest empty state instead of a blank table when no ablation data exists", () => {
    render(<AblationTable ablation={[]} />);
    expect(screen.getByText("No ablation data for this run")).toBeInTheDocument();
  });
});
