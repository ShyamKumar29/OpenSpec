import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearReviewSession,
  computeLocalThroughput,
  loadReviewSession,
  newReviewSession,
  recordDecision,
  saveReviewSession,
} from "./session-storage";

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  window.sessionStorage.clear();
});

describe("loadReviewSession", () => {
  it("returns null when nothing is stored", () => {
    expect(loadReviewSession()).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    window.sessionStorage.setItem("openspec:review-session:v1", "{not json");
    expect(loadReviewSession()).toBeNull();
  });

  it("round-trips a saved session", () => {
    const session = newReviewSession("VERIFICATION_FAILED");
    session.currentTaskId = "task_1";
    session.skippedIds = ["task_2"];
    saveReviewSession(session);
    expect(loadReviewSession()).toEqual(session);
  });

  it("defaults missing fields on a partial/older payload instead of rejecting it", () => {
    window.sessionStorage.setItem(
      "openspec:review-session:v1",
      JSON.stringify({ sessionStartedAt: "2026-08-09T00:00:00.000Z" }),
    );
    expect(loadReviewSession()).toEqual({
      reasonCode: "ALL",
      currentTaskId: null,
      skippedIds: [],
      decisionTimestamps: [],
      decisionDurationsMs: [],
      sessionStartedAt: "2026-08-09T00:00:00.000Z",
    });
  });
});

describe("clearReviewSession", () => {
  it("removes a stored session", () => {
    saveReviewSession(newReviewSession("ALL"));
    clearReviewSession();
    expect(loadReviewSession()).toBeNull();
  });
});

describe("recordDecision", () => {
  it("appends a timestamp/duration pair", () => {
    const session = newReviewSession("ALL");
    const now = new Date("2026-08-09T10:00:00.000Z");
    const next = recordDecision(session, 5_000, now);
    expect(next.decisionTimestamps).toEqual(["2026-08-09T10:00:00.000Z"]);
    expect(next.decisionDurationsMs).toEqual([5_000]);
    // Pure — the input is untouched.
    expect(session.decisionTimestamps).toEqual([]);
  });

  it("caps the rolling window at 200 entries", () => {
    let session = newReviewSession("ALL");
    for (let i = 0; i < 205; i++) {
      session = recordDecision(session, i, new Date(2026, 0, 1, 0, 0, i));
    }
    expect(session.decisionDurationsMs).toHaveLength(200);
    // The oldest five (0..4) were evicted — the window keeps the most recent 200.
    expect(session.decisionDurationsMs[0]).toBe(5);
    expect(session.decisionDurationsMs.at(-1)).toBe(204);
  });
});

describe("computeLocalThroughput", () => {
  it("reports zero rate and null median for a fresh session", () => {
    const session = newReviewSession("ALL");
    const result = computeLocalThroughput(session, new Date(session.sessionStartedAt));
    expect(result).toEqual({ resolvedCount: 0, ratePerHour: 0, medianDecisionMs: null });
  });

  it("computes rate/hour and median duration from recorded decisions", () => {
    const start = new Date("2026-08-09T10:00:00.000Z");
    let session = newReviewSession("ALL");
    session = { ...session, sessionStartedAt: start.toISOString() };
    session = recordDecision(session, 10_000, start);
    session = recordDecision(session, 20_000, start);
    session = recordDecision(session, 30_000, start);

    // Half an hour later, 3 decisions -> 6/hr; median of [10s,20s,30s] is 20s.
    const now = new Date(start.getTime() + 30 * 60_000);
    const result = computeLocalThroughput(session, now);
    expect(result.resolvedCount).toBe(3);
    expect(result.ratePerHour).toBeCloseTo(6, 5);
    expect(result.medianDecisionMs).toBe(20_000);
  });

  it("floors elapsed time at one minute so an early burst can't produce an absurd rate", () => {
    const start = new Date("2026-08-09T10:00:00.000Z");
    let session = newReviewSession("ALL");
    session = { ...session, sessionStartedAt: start.toISOString() };
    session = recordDecision(session, 1_000, start);
    // Only 5 seconds elapsed — without the floor this would extrapolate to 720/hr.
    const now = new Date(start.getTime() + 5_000);
    const result = computeLocalThroughput(session, now);
    expect(result.ratePerHour).toBeCloseTo(60, 5); // 1 decision / 1 minute floor
  });
});
