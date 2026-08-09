/**
 * Review session state — position and stats — in `sessionStorage`, surviving a refresh
 * (FR-RVW-10, docs/06-frontend.md §6: "Review session (position, session stats) | React
 * state + sessionStorage | Survives refresh"). Deliberately `sessionStorage`, not
 * `localStorage`: a reviewer's in-progress position is per-tab, not a durable
 * cross-session preference.
 *
 * Also the source of the *locally measured* half of the throughput meter
 * (components/review/throughput-meter.tsx) — real timestamps from this browser tab's
 * own decisions, not the mock's fixed `rate_per_hour`/`median_decision_ms` constants
 * (mocks/fixtures/aggregates.ts), which this module deliberately does not read from.
 */
import type { ReviewReasonCode } from "@/lib/contracts/review";

const STORAGE_KEY = "openspec:review-session:v1";

/** Bounded so a very long session doesn't grow this without limit — a rolling window is
 *  enough to keep rate/median responsive to recent pace. */
const MAX_TRACKED_DECISIONS = 200;

export interface ReviewSessionState {
  reasonCode: ReviewReasonCode | "ALL";
  currentTaskId: string | null;
  /** Ids the reviewer explicitly skipped (`S`) in the active reason code, in the order
   *  skipped — rendered at the back of the queue rather than hidden (a skip leaves the
   *  task open server-side; it only reorders where it's *shown*). Survives a refresh. */
  skippedIds: string[];
  /** ISO timestamps of decisions made this tab-session, most recent last, capped. */
  decisionTimestamps: string[];
  /** Wall-clock duration of each decision (task shown -> decided), paired 1:1 by index
   *  with `decisionTimestamps`, capped. */
  decisionDurationsMs: number[];
  sessionStartedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function loadReviewSession(): ReviewSessionState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewSessionState>;
    if (typeof parsed.sessionStartedAt !== "string") return null;
    return {
      reasonCode: parsed.reasonCode ?? "ALL",
      currentTaskId: parsed.currentTaskId ?? null,
      skippedIds: Array.isArray(parsed.skippedIds) ? parsed.skippedIds : [],
      decisionTimestamps: Array.isArray(parsed.decisionTimestamps) ? parsed.decisionTimestamps : [],
      decisionDurationsMs: Array.isArray(parsed.decisionDurationsMs)
        ? parsed.decisionDurationsMs
        : [],
      sessionStartedAt: parsed.sessionStartedAt,
    };
  } catch {
    // Malformed or inaccessible storage is never fatal to the review workflow — start a
    // fresh in-memory session instead (CLAUDE.md: contract violations crash loudly, but
    // this is user browser storage, not a pipeline contract).
    return null;
  }
}

export function saveReviewSession(state: ReviewSessionState): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/disabled — the session simply won't survive a refresh this time.
  }
}

export function clearReviewSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function newReviewSession(reasonCode: ReviewReasonCode | "ALL"): ReviewSessionState {
  return {
    reasonCode,
    currentTaskId: null,
    skippedIds: [],
    decisionTimestamps: [],
    decisionDurationsMs: [],
    sessionStartedAt: new Date().toISOString(),
  };
}

/** Records one decision's duration, returning a new state with the rolling window
 *  applied. Pure — the caller owns persistence. */
export function recordDecision(
  state: ReviewSessionState,
  durationMs: number,
  now: Date = new Date(),
): ReviewSessionState {
  const timestamps = [...state.decisionTimestamps, now.toISOString()].slice(-MAX_TRACKED_DECISIONS);
  const durations = [...state.decisionDurationsMs, durationMs].slice(-MAX_TRACKED_DECISIONS);
  return { ...state, decisionTimestamps: timestamps, decisionDurationsMs: durations };
}

export interface LocalThroughput {
  resolvedCount: number;
  ratePerHour: number;
  medianDecisionMs: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Rate is computed over the session's real elapsed wall-clock time (never less than one
 *  minute, so an early rapid burst can't produce an absurd extrapolated rate). */
export function computeLocalThroughput(
  state: ReviewSessionState,
  now: Date = new Date(),
): LocalThroughput {
  const resolvedCount = state.decisionTimestamps.length;
  const elapsedMs = Math.max(now.getTime() - new Date(state.sessionStartedAt).getTime(), 60_000);
  const ratePerHour = resolvedCount === 0 ? 0 : (resolvedCount / elapsedMs) * 3_600_000;
  return {
    resolvedCount,
    ratePerHour,
    medianDecisionMs: median(state.decisionDurationsMs),
  };
}
