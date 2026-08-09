/**
 * Runs & Judge Mode scenarios (docs/api.md §Runs & progress, §Judge Mode).
 * Six scripted runs: three Judge Mode scenarios (success/abstain/rejected, per
 * docs/14-frontend-implementation-plan.md §4.2's "three canonical demo objects") plus
 * three catalog runs (complete/in-flight/failed).
 */
import { isoDaysAgo } from "./rng";
import { STAGE_CODES, type StageCode } from "@/lib/contracts/run";

function stage(
  stage: StageCode,
  state: "pending" | "running" | "done" | "error" | "skipped",
  done: number,
  total: number,
  durationMs: number | null,
  costUsd: number | null,
  note: string | null = null,
) {
  return {
    stage,
    state,
    progress_done: done,
    progress_total: total,
    duration_ms: durationMs,
    cost_usd: costUsd,
    note,
  };
}

function allStagesDone(overrides: Partial<Record<StageCode, ReturnType<typeof stage>>> = {}) {
  return STAGE_CODES.map((s) => overrides[s] ?? stage(s, "done", 1, 1, 400, 0.003));
}

export function generateRuns(): unknown[] {
  const runs: unknown[] = [];

  // --- Judge Mode: success ---
  // `record_id` points at the canonical demo record (docs/14-frontend-implementation-
  // plan.md §4.2) so the completion panel can hand off into the real Why panel/document
  // viewer for this MPN, rather than inventing a parallel result shape (F4 scope: "Reuse
  // the existing OpenSpec provenance/evidence model").
  runs.push({
    id: "judge_run_success",
    kind: "judge",
    status: "completed",
    record_id: "rec_canonical_abc123",
    mpn: "ABC-123",
    stages: [
      stage("CLS", "done", 1, 1, 420, 0.002, "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm"),
      stage("SCH", "done", 1, 1, 40, 0, "Schema resolved: 22 mandatory attributes"),
      stage(
        "DOC",
        "done",
        1,
        1,
        1100,
        0.001,
        "Bound: apollo-70-100-series.pdf, table 1 row 14, 0.98",
      ),
      stage("PRS", "done", 1, 1, 90, 0, "Parsed (cache hit) · 4 pages · 3 tables · text layer OK"),
      stage("EXT", "done", 22, 22, 6200, 0.038),
      stage("VER", "done", 22, 22, 3100, 0.014),
      stage("VAL", "done", 22, 22, 200, 0),
      stage("NRM", "done", 22, 22, 60, 0),
      stage("CNF", "done", 22, 22, 30, 0),
    ],
    live_extracted: 16,
    live_unknown: 6,
    live_rejected: 0,
    cost_usd: 0.055,
    tokens_in: 18400,
    tokens_out: 3100,
    started_at: isoDaysAgo(0.02),
    finished_at: isoDaysAgo(0.015),
  });

  // --- Judge Mode: abstain (evidence missing -> Unknown) ---
  runs.push({
    id: "judge_run_abstain",
    kind: "judge",
    status: "completed",
    // Genuinely no catalog record for this MPN — the point of this scenario is that
    // Judge Mode is isolated from catalog data (FR-JDG-5) and abstains rather than
    // fabricating a binding, so there is nothing to hand off into.
    record_id: null,
    mpn: "XYZ-9001",
    stages: [
      stage(
        "CLS",
        "done",
        1,
        1,
        380,
        0.002,
        "Classified: Gate / Globe / Check Valve 0.91 rule+llm",
      ),
      stage("SCH", "done", 1, 1, 30, 0, "Schema resolved: 17 mandatory attributes"),
      stage("DOC", "done", 1, 1, 2400, 0.001, "No confident document match — 0.41 best candidate"),
      stage("PRS", "skipped", 0, 0, null, 0, "No document to parse"),
      stage("EXT", "skipped", 0, 0, null, 0, "No document to parse"),
      stage("VER", "skipped", 0, 0, null, 0),
      stage("VAL", "skipped", 0, 0, null, 0),
      stage("NRM", "skipped", 0, 0, null, 0),
      stage("CNF", "done", 0, 17, 20, 0, "All 17 attributes -> Unknown(NO_DOCUMENT_FOUND)"),
    ],
    live_extracted: 0,
    live_unknown: 17,
    live_rejected: 0,
    cost_usd: 0.006,
    tokens_in: 2100,
    tokens_out: 400,
    started_at: isoDaysAgo(0.01),
    finished_at: isoDaysAgo(0.008),
  });

  // --- Judge Mode: rejected (proposed value rejected -> review) ---
  runs.push({
    id: "judge_run_rejected",
    kind: "judge",
    status: "completed",
    record_id: "rec_canonical_abc123",
    mpn: "ABC-123",
    stages: [
      stage("CLS", "done", 1, 1, 400, 0.002, "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm"),
      stage("SCH", "done", 1, 1, 35, 0),
      stage(
        "DOC",
        "done",
        1,
        1,
        1050,
        0.001,
        "Bound: apollo-70-100-series.pdf, table 1 row 14, 0.98",
      ),
      stage("PRS", "done", 1, 1, 85, 0),
      stage("EXT", "done", 22, 22, 6100, 0.037, "Seat Material candidate span from row 15"),
      stage("VER", "done", 22, 22, 3300, 0.015, "1 candidate NOT_ENTAILED — held for review"),
      stage("VAL", "done", 21, 22, 190, 0),
      stage("NRM", "done", 21, 22, 55, 0),
      stage("CNF", "done", 21, 22, 30, 0),
    ],
    live_extracted: 15,
    live_unknown: 6,
    live_rejected: 1,
    cost_usd: 0.055,
    tokens_in: 18100,
    tokens_out: 3050,
    started_at: isoDaysAgo(0.03),
    finished_at: isoDaysAgo(0.025),
  });

  // --- Catalog run: complete ---
  runs.push({
    id: "run_batch_complete",
    kind: "batch",
    status: "completed",
    record_id: null,
    mpn: null,
    stages: allStagesDone(),
    live_extracted: 1840,
    live_unknown: 620,
    live_rejected: 40,
    cost_usd: 9.42,
    tokens_in: 2_100_000,
    tokens_out: 340_000,
    started_at: isoDaysAgo(2),
    finished_at: isoDaysAgo(1.9),
  });

  // --- Catalog run: in-flight ---
  runs.push({
    id: "run_batch_in_flight",
    kind: "batch",
    status: "running",
    record_id: null,
    mpn: null,
    stages: [
      stage("CLS", "done", 60, 60, 21000, 0.4),
      stage("SCH", "done", 60, 60, 500, 0),
      stage("DOC", "done", 60, 60, 34000, 0.2),
      stage("PRS", "done", 48, 60, 12000, 0.1),
      stage("EXT", "running", 22, 60, null, 0.6),
      stage("VER", "pending", 0, 60, null, 0),
      stage("VAL", "pending", 0, 60, null, 0),
      stage("NRM", "pending", 0, 60, null, 0),
      stage("CNF", "pending", 0, 60, null, 0),
    ],
    live_extracted: 22,
    live_unknown: 0,
    live_rejected: 0,
    cost_usd: 1.3,
    tokens_in: 410_000,
    tokens_out: 62_000,
    started_at: isoDaysAgo(0.05),
    finished_at: null,
  });

  // --- Catalog run: failed ---
  runs.push({
    id: "run_batch_failed",
    kind: "batch",
    status: "failed",
    record_id: null,
    mpn: null,
    stages: [
      stage("CLS", "done", 30, 30, 9000, 0.15),
      stage("SCH", "done", 30, 30, 200, 0),
      stage("DOC", "done", 30, 30, 16000, 0.08),
      stage("PRS", "error", 12, 30, 24000, 0.05, "SYSTEM_ERROR: parser worker crashed mid-batch"),
      stage("EXT", "pending", 0, 30, null, 0),
      stage("VER", "pending", 0, 30, null, 0),
      stage("VAL", "pending", 0, 30, null, 0),
      stage("NRM", "pending", 0, 30, null, 0),
      stage("CNF", "pending", 0, 30, null, 0),
    ],
    live_extracted: 0,
    live_unknown: 0,
    live_rejected: 0,
    cost_usd: 0.28,
    tokens_in: 88_000,
    tokens_out: 14_000,
    started_at: isoDaysAgo(4),
    finished_at: isoDaysAgo(3.98),
  });

  return runs;
}
