import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunHistoryTable } from "./run-history-table";
import type { EvalRunSummary } from "@/lib/contracts/eval";

function metric(code: string, value: number): EvalRunSummary["headlineMetrics"][number] {
  return {
    metricCode: code,
    slice: "overall",
    value,
    ciLow: value - 0.01,
    ciHigh: value + 0.01,
    n: 412,
    isReal: true,
  };
}

function run(
  id: string,
  gitSha: string,
  startedAt: string,
  stp: number,
  precision: number,
): EvalRunSummary {
  return {
    id,
    gitSha,
    goldSetVersion: "v1.0",
    startedAt,
    headlineMetrics: [metric("stp_all_mandatory", stp), metric("precision", precision)],
  };
}

// Oldest-first, matching the wire order from GET /eval/runs.
const RUNS: EvalRunSummary[] = [
  run("eval_run_1", "a1c4e02", "2026-07-13T00:00:00Z", 0.512, 0.968),
  run("eval_run_2", "b7f19aa", "2026-08-09T00:00:00Z", 0.578, 0.982),
];

describe("RunHistoryTable", () => {
  it("renders most recent run first", () => {
    render(<RunHistoryTable runs={RUNS} selectedRunId="eval_run_2" pathname="/evaluation" />);
    const rows = screen.getAllByTestId("eval-run-row");
    expect(rows[0]).toHaveTextContent("eval_run_2");
    expect(rows[1]).toHaveTextContent("eval_run_1");
  });

  it("marks the most recent run as Latest", () => {
    render(<RunHistoryTable runs={RUNS} selectedRunId="eval_run_2" pathname="/evaluation" />);
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("shows a positive delta against the previous run, and 'first run' for the oldest", () => {
    render(<RunHistoryTable runs={RUNS} selectedRunId="eval_run_2" pathname="/evaluation" />);
    expect(screen.getAllByText("first run")).toHaveLength(2); // STP + precision, oldest row
    expect(screen.getByText("+7pts")).toBeInTheDocument(); // STP delta 0.578-0.512
    expect(screen.getByText("+1pts")).toBeInTheDocument(); // precision delta 0.982-0.968
  });

  it("links each run into the same page with ?run=<id>, preserving the given pathname", () => {
    render(<RunHistoryTable runs={RUNS} selectedRunId="eval_run_2" pathname="/evaluation" />);
    const link = screen.getByRole("link", { name: /eval_run_1/ });
    expect(link).toHaveAttribute("href", "/evaluation?run=eval_run_1");
  });

  it("marks the selected run row with aria-current", () => {
    render(<RunHistoryTable runs={RUNS} selectedRunId="eval_run_1" pathname="/evaluation" />);
    const rows = screen.getAllByTestId("eval-run-row");
    const selected = rows.find((r) => r.getAttribute("aria-current") === "true");
    expect(selected).toHaveTextContent("eval_run_1");
  });
});
