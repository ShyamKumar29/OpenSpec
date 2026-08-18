"use client";

/**
 * `/runs/:id` (docs/06-frontend.md §2, docs/14-frontend-implementation-plan.md §6 F4:
 * "Full — reuses the stage timeline and run-event source"). No run-start form here — the
 * run already exists; this view fetches it and re-narrates its stage stream, which for a
 * scripted mock run means every visit (or a "Replay narration" click) replays the same
 * deterministic script, live.
 */
import { useEffect, useState } from "react";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { StageTimeline } from "@/components/judge/stage-timeline";
import { StageStepper } from "@/components/judge/stage-stepper";
import { LiveStatsBar } from "@/components/judge/live-stats-bar";
import { LiveResultPanel } from "@/components/judge/live-result-panel";
import { useRunDetailQuery, useRunCancelMutation } from "@/lib/queries/runs";
import { useRunStream } from "@/lib/run-events/use-run-stream";
import { isTerminalPhase } from "@/lib/run-events/reducer";
import type { RunStatus, StageExecution } from "@/lib/contracts/run";

function toTerminalPhase(status: RunStatus): "completed" | "failed" | "cancelled" {
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

function sumStageDurations(stages: StageExecution[]): number {
  return stages.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}

export function RunMonitorView({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  const detail = useRunDetailQuery(id);
  const cancelRun = useRunCancelMutation();
  const runStream = useRunStream(id, { resetKey: attempt });
  const { setTarget, finalize } = runStream;
  const streamDone = runStream.state.streamDone;
  const detailData = detail.data;

  useEffect(() => {
    if (!detailData) return;
    setTarget({
      liveExtracted: detailData.liveExtracted,
      liveUnknown: detailData.liveUnknown,
      liveRejected: detailData.liveRejected,
    });
  }, [attempt, detailData, setTarget]);

  useEffect(() => {
    if (!streamDone || !detailData) return;
    finalize(toTerminalPhase(detailData.status), {
      liveExtracted: detailData.liveExtracted,
      liveUnknown: detailData.liveUnknown,
      liveRejected: detailData.liveRejected,
    });
  }, [streamDone, detailData, attempt, finalize]);

  if (detail.status === "pending") {
    return (
      <>
        <PageHeader title="Run" description="Loading…" />
        <PageContainer>
          <LoadingCard />
          <div className="mt-4">
            <LoadingBlock rows={9} />
          </div>
        </PageContainer>
      </>
    );
  }

  if (detail.status === "error") {
    return (
      <>
        <PageHeader title="Run" />
        <PageContainer>
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        </PageContainer>
      </>
    );
  }

  const run = detail.data;
  const phase = runStream.state.phase;
  const isRunning = !isTerminalPhase(phase);

  return (
    <>
      <PageHeader
        title={run.mpn ? `Run — ${run.mpn}` : `Run — ${run.kind}`}
        description={`${run.id} · started ${new Date(run.startedAt).toLocaleString()}`}
        actions={
          isRunning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                runStream.cancel();
                cancelRun.mutate(id);
              }}
            >
              Cancel
            </Button>
          ) : undefined
        }
      />
      <PageContainer>
        {/* There is no Stitch screen for `/runs/:id`, so nothing here is invented for it:
            the composition is Judge Mode's, minus the panes a already-finished run has no
            use for (there is no input to submit and no third column to fill). Same stepper,
            same timeline, same stage vocabulary, same result panel — a reviewer arriving
            from "View in Run Monitor" lands on a screen that reads the same way. */}
        <div className="flex flex-col gap-4">
          <StageStepper stages={runStream.state.stages} frozen={!isRunning} />

          <Panel>
            <PanelHeader
              title={
                <span className="flex items-center gap-1.5">
                  <ScanSearch className="size-3.5" aria-hidden="true" />
                  {isRunning ? "Enrichment engine — active" : "Enrichment engine"}
                </span>
              }
              as="h2"
              className="bg-chrome text-chrome-foreground border-chrome-border"
              actions={
                <span className="metric text-chrome-foreground/70 max-w-52 truncate text-xs">
                  {run.id}
                </span>
              }
            />
            <PanelBody className="p-2">
              <StageTimeline
                stages={runStream.state.stages}
                notesSource={run.stages}
                frozen={!isRunning}
              />
            </PanelBody>
          </Panel>

          <LiveStatsBar
            liveExtracted={runStream.state.liveExtracted}
            liveUnknown={runStream.state.liveUnknown}
            liveRejected={runStream.state.liveRejected}
            costSoFar={runStream.state.costSoFar}
          />

          {isTerminalPhase(phase) ? (
            <Panel>
              <PanelHeader title="Result" as="h2" />
              <LiveResultPanel
                phase={phase as "completed" | "failed" | "cancelled" | "timed_out"}
                run={run}
                totals={{
                  liveExtracted: runStream.state.liveExtracted,
                  liveUnknown: runStream.state.liveUnknown,
                  liveRejected: runStream.state.liveRejected,
                }}
                elapsedMs={sumStageDurations(run.stages)}
                costSoFar={runStream.state.costSoFar}
                onRunAgain={() => setAttempt((a) => a + 1)}
                runAgainLabel="Replay narration"
                context={run.kind === "judge" ? "judge" : "monitor"}
                hideRunMonitorLink
              />
            </Panel>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
