import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPollingRunEventSource } from "./polling-run-event-source";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function runWire(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "run_1",
    kind: "judge",
    status: "running",
    record_id: "rec_1",
    mpn: "ABC-123",
    stages: [
      {
        stage: "CLS",
        state: "done",
        progress_done: 1,
        progress_total: 1,
        duration_ms: 400,
        cost_usd: 0.002,
        note: null,
      },
    ],
    live_extracted: 0,
    live_unknown: 0,
    live_rejected: 0,
    cost_usd: 0.002,
    tokens_in: 100,
    tokens_out: 10,
    started_at: "2026-08-09T00:00:00Z",
    finished_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  apiFetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createPollingRunEventSource", () => {
  it("emits a stage event for each stage on the first poll", async () => {
    apiFetchMock.mockResolvedValueOnce(runWire());
    const onStage = vi.fn();
    const source = createPollingRunEventSource("run_1", {
      onStage,
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    source.connect();
    await vi.runOnlyPendingTimersAsync();

    expect(onStage).toHaveBeenCalledTimes(1);
    expect(onStage).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "CLS", state: "done", progress: { done: 1, total: 1 } }),
    );
  });

  it("does not re-emit a stage whose snapshot hasn't changed between polls", async () => {
    apiFetchMock.mockResolvedValue(runWire());
    const onStage = vi.fn();
    const source = createPollingRunEventSource("run_1", {
      onStage,
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    source.connect();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(400);
    source.close();

    expect(onStage).toHaveBeenCalledTimes(1);
  });

  it("emits done and stops polling once the run reaches a terminal status", async () => {
    apiFetchMock.mockResolvedValueOnce(runWire({ status: "running" }));
    apiFetchMock.mockResolvedValueOnce(
      runWire({
        status: "completed",
        stages: [
          {
            stage: "CLS",
            state: "done",
            progress_done: 1,
            progress_total: 1,
            duration_ms: 500,
            cost_usd: 0.003,
            note: null,
          },
        ],
      }),
    );
    const onDone = vi.fn();
    const onStage = vi.fn();
    const source = createPollingRunEventSource("run_1", { onStage, onDone, onError: vi.fn() });
    source.connect();
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(400);
    await vi.runOnlyPendingTimersAsync();

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a transport error and stops polling when the fetch rejects", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("network down"));
    const onError = vi.fn();
    const source = createPollingRunEventSource("run_1", {
      onStage: vi.fn(),
      onDone: vi.fn(),
      onError,
    });
    source.connect();
    await vi.runOnlyPendingTimersAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — a second connect() does not start a second poll loop", async () => {
    apiFetchMock.mockResolvedValue(runWire());
    const source = createPollingRunEventSource("run_1", {
      onStage: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    source.connect();
    source.connect();
    await vi.runOnlyPendingTimersAsync();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("close() before any poll fires prevents the fetch from ever happening", async () => {
    apiFetchMock.mockResolvedValue(runWire());
    const source = createPollingRunEventSource("run_1", {
      onStage: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });
    source.connect();
    source.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
