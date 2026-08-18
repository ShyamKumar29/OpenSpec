import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmergingRecord } from "./emerging-record";
import { initialStages } from "@/lib/run-events/reducer";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

function stagesWith(overrides: Partial<Record<StageCode, Partial<StageExecution>>>) {
  const stages = initialStages();
  for (const [code, patch] of Object.entries(overrides) as [StageCode, Partial<StageExecution>][]) {
    stages[code] = { ...stages[code], ...patch };
  }
  return stages;
}

/** The scripted run's full narration, available from the first `GET /runs/{id}` — the
 *  point of these tests is that availability is not permission to display. */
const NOTES: StageExecution[] = [
  {
    stage: "CLS",
    state: "done",
    progressDone: 1,
    progressTotal: 1,
    durationMs: 420,
    costUsd: 0.002,
    note: "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm",
  },
  {
    stage: "DOC",
    state: "done",
    progressDone: 1,
    progressTotal: 1,
    durationMs: 1100,
    costUsd: 0.001,
    note: "Bound: apollo-70-100-series.pdf, table 1 row 14, 0.98",
  },
];

function row(label: string) {
  return screen.getByText(label, { selector: "dt" }).closest("[data-testid=emerging-record-row]");
}

describe("EmergingRecord", () => {
  it("states the submitted input immediately — it was never in doubt", () => {
    render(
      <EmergingRecord
        stages={initialStages()}
        mpn="ABC-123"
        description="1/2 BRS BALL VLV 600WOG"
      />,
    );
    expect(screen.getByText("ABC-123")).toBeInTheDocument();
    expect(screen.getByText("1/2 BRS BALL VLV 600WOG")).toBeInTheDocument();
  });

  it("withholds a field until the stage that answers it has actually run", () => {
    render(<EmergingRecord stages={stagesWith({ CLS: { state: "running" } })} notes={NOTES} />);

    // CLS is in flight: the note exists in `notes`, but the pipeline has not got there.
    expect(row("Class")).toHaveAttribute("data-state", "running");
    expect(
      screen.queryByText("Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm"),
    ).not.toBeInTheDocument();
    expect(row("Document")).toHaveAttribute("data-state", "pending");
    expect(
      screen.queryByText("Bound: apollo-70-100-series.pdf, table 1 row 14, 0.98"),
    ).not.toBeInTheDocument();
  });

  it("fills a field in the moment its own stage completes", () => {
    render(
      <EmergingRecord
        stages={stagesWith({ CLS: { state: "done" }, DOC: { state: "running" } })}
        notes={NOTES}
      />,
    );
    expect(row("Class")).toHaveAttribute("data-state", "known");
    expect(
      screen.getByText("Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm"),
    ).toBeInTheDocument();
    expect(row("Document")).toHaveAttribute("data-state", "running");
  });

  it("says a stage was skipped, and why, rather than leaving it looking busy forever", () => {
    render(
      <EmergingRecord
        stages={stagesWith({ PRS: { state: "skipped" } })}
        notes={[
          {
            stage: "PRS",
            state: "skipped",
            progressDone: 0,
            progressTotal: 0,
            durationMs: null,
            costUsd: 0,
            note: "No document to parse",
          },
        ]}
      />,
    );
    expect(row("Parse")).toHaveAttribute("data-state", "skipped");
    expect(screen.getByText("No document to parse")).toBeInTheDocument();
  });

  it("reports extraction as live counts against the real total, never a guessed value", () => {
    render(
      <EmergingRecord
        stages={stagesWith({ EXT: { state: "running", progressDone: 17, progressTotal: 22 } })}
      />,
    );
    expect(screen.getByText("17/22 extracted")).toBeInTheDocument();
  });

  it("carries each row's state as text for assistive tech, never colour alone", () => {
    render(<EmergingRecord stages={stagesWith({ CLS: { state: "done" } })} notes={NOTES} />);
    expect(row("Class")).toHaveTextContent("Resolved");
    expect(row("Schema")).toHaveTextContent("Queued");
  });
});
