import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalRunSourceLine, SourceBadge } from "./source-badge";

describe("SourceBadge", () => {
  it("labels a real slice distinctly from a synthetic one", () => {
    const { rerender } = render(<SourceBadge isReal />);
    expect(screen.getByText("Real slice")).toBeInTheDocument();
    rerender(<SourceBadge isReal={false} />);
    expect(screen.getByText("Synthetic slice")).toBeInTheDocument();
  });
});

describe("EvalRunSourceLine", () => {
  it("names the specific eval run and gold-set version a metric block came from", () => {
    render(<EvalRunSourceLine runId="eval_run_5" goldSetVersion="v1.4" />);
    expect(screen.getByText(/Source: eval run eval_run_5 · gold set v1.4/)).toBeInTheDocument();
  });
});
