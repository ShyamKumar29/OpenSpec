import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunMonitorView } from "./run-monitor-view";
import { initialRunStreamState, type RunStreamState } from "@/lib/run-events/reducer";
import type { Run } from "@/lib/contracts/run";

const runDetailQueryMock = vi.fn();
const cancelRunMutateMock = vi.fn();
const runStreamMock = vi.fn();
const recordDetailQueryMock = vi.fn();

vi.mock("@/lib/queries/runs", () => ({
  useRunDetailQuery: (...args: unknown[]) => runDetailQueryMock(...args),
  useRunCancelMutation: () => ({ mutate: cancelRunMutateMock }),
}));

vi.mock("@/lib/run-events/use-run-stream", () => ({
  useRunStream: (...args: unknown[]) => runStreamMock(...args),
}));

vi.mock("@/lib/queries/records", () => ({
  useRecordDetailQuery: (...args: unknown[]) => recordDetailQueryMock(...args),
}));

const BATCH_RUN: Run = {
  id: "run_batch_in_flight",
  kind: "batch",
  status: "running",
  recordId: null,
  mpn: null,
  stages: [],
  liveExtracted: 22,
  liveUnknown: 0,
  liveRejected: 0,
  costUsd: 1.3,
  tokensIn: 410_000,
  tokensOut: 62_000,
  startedAt: "2026-08-09T00:00:00Z",
  finishedAt: null,
};

function streamState(overrides: Partial<RunStreamState> = {}): RunStreamState {
  return { ...initialRunStreamState(), ...overrides };
}

function mockRunStreamHookResult(
  state: RunStreamState,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return { state, finalize: vi.fn(), setTarget: vi.fn(), cancel: vi.fn(), ...overrides };
}

beforeEach(() => {
  runDetailQueryMock.mockReset();
  cancelRunMutateMock.mockReset();
  runStreamMock.mockReset();
  recordDetailQueryMock.mockReset();
  recordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
});

describe("RunMonitorView", () => {
  it("shows a loading state before the run detail resolves", () => {
    runDetailQueryMock.mockReturnValue({ status: "pending", data: undefined, error: null });
    runStreamMock.mockReturnValue(mockRunStreamHookResult(streamState()));
    render(<RunMonitorView id="run_batch_in_flight" />);
    expect(screen.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
  });

  it("shows an error state with retry when the run detail fails to load", async () => {
    const refetch = vi.fn();
    runDetailQueryMock.mockReturnValue({ status: "error", error: new Error("gone"), refetch });
    runStreamMock.mockReturnValue(mockRunStreamHookResult(streamState()));
    render(<RunMonitorView id="run_batch_in_flight" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders the header, timeline, and a Cancel action for a running batch run", () => {
    runDetailQueryMock.mockReturnValue({ status: "success", data: BATCH_RUN });
    runStreamMock.mockReturnValue(mockRunStreamHookResult(streamState({ phase: "running" })));
    render(<RunMonitorView id="run_batch_in_flight" />);

    expect(screen.getByRole("heading", { name: /Run — batch/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("stage-row")).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancelling closes the stream and persists it server-side", async () => {
    runDetailQueryMock.mockReturnValue({ status: "success", data: BATCH_RUN });
    const cancel = vi.fn();
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(streamState({ phase: "running" }), { cancel }),
    );
    render(<RunMonitorView id="run_batch_in_flight" />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalled();
    expect(cancelRunMutateMock).toHaveBeenCalledWith("run_batch_in_flight");
  });

  it("a terminal batch run with no record shows aggregate results only, no Judge-specific framing", () => {
    runDetailQueryMock.mockReturnValue({
      status: "success",
      data: { ...BATCH_RUN, status: "completed" },
    });
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(
        streamState({ phase: "completed", liveExtracted: 22, liveUnknown: 0, liveRejected: 0 }),
      ),
    );
    render(<RunMonitorView id="run_batch_in_flight" />);

    expect(screen.getByTestId("live-result-panel")).toBeInTheDocument();
    expect(screen.queryByText(/isolated from catalog data/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View in Run Monitor/ })).not.toBeInTheDocument();
    expect(recordDetailQueryMock).not.toHaveBeenCalled();
  });

  it("'Replay narration' bumps the reset key without navigating away", async () => {
    runDetailQueryMock.mockReturnValue({
      status: "success",
      data: { ...BATCH_RUN, status: "completed" },
    });
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(streamState({ phase: "completed", liveExtracted: 22 })),
    );
    render(<RunMonitorView id="run_batch_in_flight" />);

    await userEvent.click(screen.getByRole("button", { name: "Replay narration" }));
    // useRunStream is called on every render; the second-to-last call's resetKey must
    // differ from the first, proving the click actually changed the hook's input.
    const resetKeys = runStreamMock.mock.calls.map(
      (call) => (call[1] as { resetKey: number }).resetKey,
    );
    expect(new Set(resetKeys).size).toBeGreaterThan(1);
  });
});
