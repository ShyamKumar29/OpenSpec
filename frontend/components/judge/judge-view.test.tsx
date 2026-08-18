import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JudgeView } from "./judge-view";
import { initialRunStreamState, type RunStreamState } from "@/lib/run-events/reducer";
import type { Run } from "@/lib/contracts/run";

const judgeRunMutateMock = vi.fn();
const cancelRunMutateMock = vi.fn();
const judgeRunDetailQueryMock = vi.fn();
const runStreamMock = vi.fn();
const recordDetailQueryMock = vi.fn();

vi.mock("@/lib/queries/runs", () => ({
  useJudgeRunMutation: () => ({ mutate: judgeRunMutateMock, isPending: false }),
  useRunCancelMutation: () => ({ mutate: cancelRunMutateMock }),
  useJudgeRunDetailQuery: (id: string | null) => judgeRunDetailQueryMock(id),
}));

vi.mock("@/lib/run-events/use-run-stream", () => ({
  useRunStream: (...args: unknown[]) => runStreamMock(...args),
}));

vi.mock("@/lib/queries/records", () => ({
  useRecordDetailQuery: (...args: unknown[]) => recordDetailQueryMock(...args),
}));

const DETAIL: Run = {
  id: "judge_run_success",
  kind: "judge",
  status: "completed",
  recordId: "rec_canonical_abc123",
  mpn: "ABC-123",
  stages: [],
  liveExtracted: 16,
  liveUnknown: 6,
  liveRejected: 0,
  costUsd: 0.055,
  tokensIn: 18400,
  tokensOut: 3100,
  startedAt: "2026-08-09T00:00:00Z",
  finishedAt: "2026-08-09T00:00:06Z",
};

function streamState(overrides: Partial<RunStreamState> = {}): RunStreamState {
  return { ...initialRunStreamState(), ...overrides };
}

function mockRunStreamHookResult(
  state: RunStreamState,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    state,
    finalize: vi.fn(),
    setTarget: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  judgeRunMutateMock.mockReset();
  cancelRunMutateMock.mockReset();
  judgeRunDetailQueryMock.mockReset();
  runStreamMock.mockReset();
  recordDetailQueryMock.mockReset();

  judgeRunDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
  runStreamMock.mockReturnValue(mockRunStreamHookResult(streamState()));
  recordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
});

describe("JudgeView", () => {
  it("renders only the run form until a run is started", () => {
    render(<JudgeView />);
    expect(screen.getByRole("form", { name: "Run configuration" })).toBeInTheDocument();
    expect(screen.queryByTestId("stage-row")).not.toBeInTheDocument();
  });

  it("submitting the form starts a judge run with the typed input", async () => {
    render(<JudgeView />);
    await userEvent.type(screen.getByLabelText("MPN"), "ABC-123");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(judgeRunMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ mpn: "ABC-123" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("shows the stage timeline and a Cancel action once a run is active and running", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) => opts.onSuccess("judge_run_success"));
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(
        streamState({
          phase: "running",
          stages: {
            ...initialRunStreamState().stages,
            CLS: { ...initialRunStreamState().stages.CLS, state: "done" },
          },
        }),
      ),
    );

    render(<JudgeView />);
    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(screen.getAllByTestId("stage-row")).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("runs the engine console and the emerging record while in flight, and the result panel only once settled", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) => opts.onSuccess("judge_run_success"));
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(
        streamState({
          phase: "running",
          stages: {
            ...initialRunStreamState().stages,
            CLS: { ...initialRunStreamState().stages.CLS, state: "running" },
          },
        }),
      ),
    );

    render(<JudgeView />);
    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(screen.getByTestId("engine-console")).toBeInTheDocument();
    expect(screen.getByTestId("emerging-record")).toBeInTheDocument();
    expect(screen.queryByTestId("live-result-panel")).not.toBeInTheDocument();
  });

  it("freezes the pipeline's motion once the run has settled", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) => opts.onSuccess("judge_run_success"));
    judgeRunDetailQueryMock.mockReturnValue({ status: "success", data: DETAIL });
    recordDetailQueryMock.mockReturnValue({
      status: "success",
      data: { mpnRaw: "ABC-123", attributes: [] },
    });
    // A run cancelled mid-stage leaves CLS in `running` forever — nothing on the page may
    // go on animating as though work were still happening.
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(
        streamState({
          phase: "cancelled",
          stages: {
            ...initialRunStreamState().stages,
            CLS: { ...initialRunStreamState().stages.CLS, state: "running" },
          },
        }),
      ),
    );

    render(<JudgeView />);
    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    const spinners = document.querySelectorAll(".animate-spin");
    expect(spinners).toHaveLength(0);
    expect(screen.getByTestId("live-result-panel")).toBeInTheDocument();
  });

  it("Cancel closes the stream and persists the cancellation server-side", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) => opts.onSuccess("judge_run_success"));
    const cancel = vi.fn();
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(streamState({ phase: "running" }), { cancel }),
    );

    render(<JudgeView />);
    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(cancel).toHaveBeenCalled();
    expect(cancelRunMutateMock).toHaveBeenCalledWith("judge_run_success");
  });

  it("renders the completion panel once the run is terminal, and 'Run again' resubmits the same input", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) => opts.onSuccess("judge_run_success"));
    judgeRunDetailQueryMock.mockReturnValue({ status: "success", data: DETAIL });
    recordDetailQueryMock.mockReturnValue({
      status: "success",
      data: { mpnRaw: "ABC-123", attributes: [] },
    });
    runStreamMock.mockReturnValue(
      mockRunStreamHookResult(
        streamState({
          phase: "completed",
          liveExtracted: 16,
          liveUnknown: 6,
          liveRejected: 0,
        }),
      ),
    );

    render(<JudgeView />);
    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(screen.getByTestId("live-result-panel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    judgeRunMutateMock.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(judgeRunMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ mpn: "ABC-123", scenario: "success" }),
      expect.anything(),
    );
  });

  it("shows an error toast and does not start a run when the mutation fails", async () => {
    judgeRunMutateMock.mockImplementation((_input, opts) =>
      opts.onError(new Error("network down")),
    );
    render(<JudgeView />);
    await userEvent.type(screen.getByLabelText("MPN"), "ABC-123");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.queryByTestId("stage-row")).not.toBeInTheDocument();
  });
});
