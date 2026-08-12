import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SliceTable } from "./slice-table";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const SLICES: EvalRunDetail["sliceMetrics"] = [
  {
    metricCode: "precision",
    slice: "synthetic:injection",
    value: 0.994,
    ciLow: 0.98,
    ciHigh: 1,
    n: 60,
    isReal: false,
  },
  {
    metricCode: "precision",
    slice: "real:ball_valve",
    value: 0.986,
    ciLow: 0.97,
    ciHigh: 1,
    n: 180,
    isReal: true,
  },
  {
    metricCode: "precision",
    slice: "real:gate_globe_check",
    value: 0.979,
    ciLow: 0.96,
    ciHigh: 1,
    n: 96,
    isReal: true,
  },
];

describe("SliceTable", () => {
  it("orders real slices before synthetic slices regardless of input order (FR-EVL-4)", () => {
    render(<SliceTable sliceMetrics={SLICES} />);
    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows[0]).toHaveTextContent("ball valve");
    expect(rows[1]).toHaveTextContent("gate globe check");
    expect(rows[2]).toHaveTextContent("injection");
  });

  it("labels every row real or synthetic — never silently blended", () => {
    render(<SliceTable sliceMetrics={SLICES} />);
    expect(screen.getAllByText("Real slice")).toHaveLength(2);
    expect(screen.getAllByText("Synthetic slice")).toHaveLength(1);
  });

  it("links a known real per-class slice into the catalog filtered by that class", () => {
    render(<SliceTable sliceMetrics={SLICES} />);
    // The visible link text is "View in catalog", not the slice name — look it up by href.
    const links = screen.getAllByRole("link", { name: /view in catalog/i });
    expect(
      links.some((a) => a.getAttribute("href") === "/catalog?class_id=BALL_VALVE_BRONZE"),
    ).toBe(true);
    expect(screen.queryByRole("link", { name: /ball valve/i })).not.toBeInTheDocument();
  });

  it("never renders a bare point estimate — CI and n are always shown (ASM-7)", () => {
    render(<SliceTable sliceMetrics={SLICES} />);
    expect(screen.getByText("n=180")).toBeInTheDocument();
  });

  it("renders an honest empty state instead of a blank table when no slice data exists", () => {
    render(<SliceTable sliceMetrics={[]} />);
    expect(screen.getByText("No per-slice data for this run")).toBeInTheDocument();
  });
});
