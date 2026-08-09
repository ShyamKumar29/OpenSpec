"use client";

/**
 * Judge Mode (docs/06-frontend.md §3.4, docs/14-frontend-implementation-plan.md §6 F4).
 * Orchestrates: `RunInput` → `POST /judge/run` → `useRunStream` (the live narration) →
 * `LiveResultPanel` (the hand-off into F1/F3). Isolated from catalog data (FR-JDG-5) at
 * the mock layer — this component just renders whatever the run resolves to.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/page-container";
import { StageTimeline } from "./stage-timeline";
import { LiveStatsBar } from "./live-stats-bar";
import { LiveResultPanel } from "./live-result-panel";
import { RunInput } from "./run-input";
import { useRunStream } from "@/lib/run-events/use-run-stream";
import { isTerminalPhase } from "@/lib/run-events/reducer";
import {
  useJudgeRunDetailQuery,
  useJudgeRunMutation,
  useRunCancelMutation,
  type JudgeRunInput,
} from "@/lib/queries/runs";
import type { RunStatus, StageExecution } from "@/lib/contracts/run";

function toTerminalPhase(status: RunStatus): "completed" | "failed" | "cancelled" {
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

function sumStageDurations(stages: StageExecution[]): number {
  return stages.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}

const CACHED_FALLBACK_INPUT: JudgeRunInput = {
  mpn: "ABC-123",
  description: "1/2 BRS BALL VLV 600WOG",
  scenario: "success",
};

export function JudgeView() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // What the user actually submitted — shown next to the run id and reused by "Run
  // again". Deliberately not `detailData?.mpn`: for free text that doesn't match the
  // canonical MPN, the mock falls back to a fixed scripted scenario whose own `mpn`
  // (e.g. "XYZ-9001") is not what was typed, and echoing the real input back is what
  // makes the abstain path legible rather than confusing.
  const [submittedInput, setSubmittedInput] = useState<JudgeRunInput | null>(null);

  const judgeRun = useJudgeRunMutation();
  const cancelRun = useRunCancelMutation();
  const detail = useJudgeRunDetailQuery(activeRunId);
  const runStream = useRunStream(activeRunId, { resetKey: attempt });

  const { setTarget, finalize } = runStream;
  const streamDone = runStream.state.streamDone;
  const detailData = detail.data;

  // Seed (and re-seed, on every "Run again") the live-counter derivation with the run's
  // known totals as soon as they're fetched.
  useEffect(() => {
    if (!activeRunId || !detailData) return;
    setTarget({
      liveExtracted: detailData.liveExtracted,
      liveUnknown: detailData.liveUnknown,
      liveRejected: detailData.liveRejected,
    });
    // `attempt` deliberately included — a re-run reuses the same run id and therefore the
    // same cached query data, which would not otherwise re-trigger this effect.
  }, [activeRunId, attempt, detailData, setTarget]);

  // Once the stream has narrated every stage, snap to the authoritative terminal phase
  // and totals from the fetched run detail.
  useEffect(() => {
    if (!streamDone || !detailData) return;
    finalize(toTerminalPhase(detailData.status), {
      liveExtracted: detailData.liveExtracted,
      liveUnknown: detailData.liveUnknown,
      liveRejected: detailData.liveRejected,
    });
  }, [streamDone, detailData, attempt, finalize]);

  const start = useCallback(
    (input: JudgeRunInput) => {
      setSubmittedInput(input);
      judgeRun.mutate(input, {
        onSuccess: (runId) => {
          setActiveRunId((prev) => {
            if (prev === runId) setAttempt((a) => a + 1);
            return runId;
          });
        },
        onError: (error) => {
          toast.error("Could not start the run", {
            description: error instanceof Error ? error.message : undefined,
          });
        },
      });
    },
    [judgeRun],
  );

  function handleCancel() {
    runStream.cancel();
    if (activeRunId) cancelRun.mutate(activeRunId);
  }

  function handleRunAgain() {
    if (submittedInput) start(submittedInput);
  }

  function handleUseCachedFallback() {
    start(CACHED_FALLBACK_INPUT);
  }

  const phase = runStream.state.phase;
  const isRunning = activeRunId !== null && !isTerminalPhase(phase);

  return (
    <PageContainer className="flex flex-col gap-4">
      <RunInput disabled={isRunning || judgeRun.isPending} onSubmit={start} />

      {activeRunId ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Run <span className="metric">{activeRunId}</span>
              {submittedInput?.mpn ? ` · ${submittedInput.mpn}` : ""}
            </p>
            {isRunning ? (
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            ) : null}
          </div>

          <StageTimeline stages={runStream.state.stages} notesSource={detailData?.stages} />

          <LiveStatsBar
            liveExtracted={runStream.state.liveExtracted}
            liveUnknown={runStream.state.liveUnknown}
            liveRejected={runStream.state.liveRejected}
            costSoFar={runStream.state.costSoFar}
          />

          {isTerminalPhase(phase) ? (
            <LiveResultPanel
              phase={phase as "completed" | "failed" | "cancelled" | "timed_out"}
              run={detailData}
              totals={{
                liveExtracted: runStream.state.liveExtracted,
                liveUnknown: runStream.state.liveUnknown,
                liveRejected: runStream.state.liveRejected,
              }}
              elapsedMs={detailData ? sumStageDurations(detailData.stages) : null}
              costSoFar={runStream.state.costSoFar}
              onRunAgain={handleRunAgain}
              onUseCachedFallback={
                phase === "failed" || phase === "timed_out" ? handleUseCachedFallback : undefined
              }
            />
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}
