"use client";

/**
 * Judge Mode (docs/06-frontend.md §3.4, docs/14-frontend-implementation-plan.md §6 F4).
 * Orchestrates: `RunInput` → `POST /judge/run` → `useRunStream` (the live narration) →
 * `LiveResultPanel` (the hand-off into F1/F3). Isolated from catalog data (FR-JDG-5) at
 * the mock layer — this component just renders whatever the run resolves to.
 *
 * Composed as the Stitch Judge Mode screen: a pipeline stepper across the top, then a
 * three-pane operating console at 3/5/4 columns — the run's input on the left, the
 * enrichment engine's live activity console in the middle under a bolted-on dark header,
 * and the emerging record on the right — over an instrument rail of live counters. The
 * frame is present before a run starts and stays put while one is in flight, so
 * submitting does not reshuffle the page; every pane simply states what it has, which
 * before a first run is nothing.
 *
 * The motion is entirely state-driven. There is no animation timer at this level and no
 * second event system: the console, the stepper, the ledger, and the emerging record all
 * read the *same* `useRunStream` reducer state, and every one of them freezes the moment
 * `isTerminalPhase` is true. Nothing on this page can appear to be processing while the
 * run is idle or finished.
 *
 * No behaviour moved: the same mutation, the same SSE stream, the same reducer, the same
 * cancel/timeout/cached-fallback paths, the same F1/F3 hand-off.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  CircleHelp,
  Cpu,
  FileQuestion,
  ScanSearch,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/page-container";
import { Panel, PanelBody, PanelHeader, SectionLabel } from "@/components/shell/panel";
import { StatCard, StatCardRow } from "@/components/shell/stat-card";
import { EmptyState } from "@/components/state/empty-state";
import { StageTimeline } from "./stage-timeline";
import { StageStepper } from "./stage-stepper";
import { EngineConsole } from "./engine-console";
import { EmergingRecord } from "./emerging-record";
import { LiveResultPanel } from "./live-result-panel";
import { RunInput } from "./run-input";
import { useRunStream } from "@/lib/run-events/use-run-stream";
import { isTerminalPhase } from "@/lib/run-events/reducer";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import { formatCostUsd } from "@/lib/format/run";
import {
  STAGE_CODES,
  type RunStatus,
  type StageCode,
  type StageExecution,
} from "@/lib/contracts/run";
import {
  useJudgeRunDetailQuery,
  useJudgeRunMutation,
  useRunCancelMutation,
  type JudgeRunInput,
} from "@/lib/queries/runs";
import { cn } from "@/lib/utils";

function toTerminalPhase(status: RunStatus): "completed" | "failed" | "cancelled" {
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

function sumStageDurations(stages: StageExecution[]): number {
  return stages.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}

/** The stage the engine header names as "current": the one actually running, or — once
 *  the run has settled — the last one that got anywhere. Read from the same stage map
 *  everything else on the page reads. */
function currentStageCode(stages: Record<StageCode, StageExecution>): StageCode | null {
  const running = STAGE_CODES.find((code) => stages[code].state === "running");
  if (running) return running;
  const touched = [...STAGE_CODES].reverse().find((code) => stages[code].state !== "pending");
  return touched ?? null;
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
  const settled = isTerminalPhase(phase);
  const isRunning = activeRunId !== null && !settled;
  const state = runStream.state;
  const currentStage = currentStageCode(state.stages);

  return (
    <PageContainer className="flex flex-col gap-3">
      <StageStepper stages={state.stages} frozen={settled} />

      {/* The 3 / 5 / 4 bento of the Stitch screen, given a *definite* height on desktop
          rather than a minimum: that is what turns the centre pane into a console with an
          internally scrolling log and ledger, instead of a card that grows to fit its
          transcript and pushes the instrument rail off the bottom of the page. The
          subtracted 24rem is the chrome this workspace sits between — topbar, breadcrumb,
          page header, stepper, and the counter rail below — with a floor so a short
          viewport degrades to scrolling rather than to a squashed console. Below `lg` the
          three panes stack in reading order: input, engine, record. */}
      <div className="grid grid-cols-1 gap-3 lg:h-[calc(100dvh-24rem)] lg:min-h-[30rem] lg:grid-cols-12 lg:items-stretch">
        {/* Left: the run's input. Stays interactive between runs and disables itself while
            one is in flight, rather than being swapped out for a summary. */}
        {/* `min-h-0` on every pane, not just the engine: a grid item defaults to
            `min-height: auto`, so without it a pane taller than the row track grows past
            it and overlaps the counter rail below — which then silently intercepts clicks
            meant for the pane. With it, each pane is clamped to the track and scrolls
            inside itself. */}
        <Panel className="flex min-h-0 flex-col overflow-hidden lg:col-span-3">
          <PanelHeader
            title="Source input"
            as="h2"
            actions={
              submittedInput?.documentName ? (
                <span className="metric text-muted-foreground max-w-40 truncate text-xs">
                  {submittedInput.documentName}
                </span>
              ) : null
            }
          />
          <PanelBody className="min-h-0 flex-1 overflow-y-auto">
            <RunInput disabled={isRunning || judgeRun.isPending} onSubmit={start} />
          </PanelBody>
        </Panel>

        {/* Centre: the engine. The header is the Stitch screen's bolted-on dark slab, the
            activity console below it is the pane's centre of gravity, and the stage ledger
            sits underneath carrying the per-stage duration/cost/progress that the console
            narrates but does not tabulate. The frame itself pulses only while the run is
            genuinely in flight. */}
        <Panel
          className={cn(
            "flex min-h-0 flex-col overflow-hidden lg:col-span-5",
            isRunning && "os-engine-frame border-foreground/40",
          )}
        >
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                <Cpu className="size-3.5" aria-hidden="true" />
                {isRunning ? "Enrichment engine — active" : "Enrichment engine"}
              </span>
            }
            as="h2"
            className="bg-chrome text-chrome-foreground border-chrome-border"
            actions={
              <>
                {activeRunId ? (
                  <span className="metric text-chrome-foreground/70 max-w-52 truncate text-xs">
                    {currentStage ? `${currentStage} · ` : ""}
                    {submittedInput?.mpn || activeRunId}
                  </span>
                ) : null}
                {isRunning ? (
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-chrome-border bg-chrome-accent text-chrome-foreground hover:bg-chrome-accent"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                ) : null}
              </>
            }
          />

          {/* Everything below the header exists only once a run does. Before that the pane
              says so rather than drawing nine pending rows and an empty terminal — a stage
              list with no run behind it is a claim about work that has not happened. The
              stepper above keeps the shape of the pipeline visible in the meantime. */}
          {activeRunId ? (
            <>
              {/* Keyed on the run *and* the attempt: "Run again" reuses the same scripted
                  run id, and remounting is how the console gets a clean transcript and a
                  reset reveal cursor without any reset logic of its own. */}
              <EngineConsole
                key={`${activeRunId}#${attempt}`}
                className="min-h-[12rem] flex-1"
                active={isRunning}
                ctx={{
                  runId: activeRunId,
                  mpn: submittedInput?.mpn,
                  description: submittedInput?.description,
                  documentName: submittedInput?.documentName,
                }}
                phase={phase}
                stages={state.stages}
                notes={detailData?.stages}
                totals={{
                  liveExtracted: state.liveExtracted,
                  liveUnknown: state.liveUnknown,
                  liveRejected: state.liveRejected,
                }}
                costSoFar={state.costSoFar}
              />
              <div className="border-border flex items-center justify-between gap-2 border-t px-3 py-1.5">
                <SectionLabel>Stage ledger</SectionLabel>
                <SectionLabel className="metric normal-case">
                  duration · cost · progress
                </SectionLabel>
              </div>
              {/* A scrollable region with no focusable content of its own has to be
                  reachable by keyboard, or its lower rows are unreadable without a mouse
                  (axe `scrollable-region-focusable`, WCAG 2.1.1) — hence the tab stop and
                  the group name. */}
              <div
                role="group"
                aria-label="Stage ledger"
                tabIndex={0}
                className="focus-visible:ring-ring max-h-[13rem] shrink-0 overflow-y-auto p-1.5 focus-visible:ring-1 focus-visible:outline-none"
              >
                <StageTimeline
                  stages={state.stages}
                  notesSource={detailData?.stages}
                  frozen={settled}
                />
              </div>
            </>
          ) : (
            <PanelBody className="flex flex-1 items-center">
              <EmptyState
                icon={ScanSearch}
                title="Engine idle"
                description="Each of the nine pipeline stages narrates its own progress, duration, and cost here once a run starts."
              />
            </PanelBody>
          )}
        </Panel>

        {/* Right: the emerging record. While the run is in flight this fills in field by
            field as the stage that can answer each one completes; once it settles, the
            same column becomes the real F1/F3 hand-off. */}
        <Panel className="flex min-h-0 flex-col overflow-hidden lg:col-span-4">
          <PanelHeader
            title="Emerging record"
            as="h2"
            actions={
              activeRunId && !settled ? (
                <span className="label-caps label-caps-sm text-muted-foreground">
                  {currentStage ? STAGE_COPY[currentStage].label : "Starting"}…
                </span>
              ) : null
            }
          />
          {activeRunId && settled ? (
            // The result is taller than the pane on a short viewport (three attribute rows,
            // their Why triggers, and the run's own actions), so it scrolls *inside* the
            // column. Without this it spills past the pane and lands under the counter rail
            // below, which silently swallows clicks on "View in Run Monitor".
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LiveResultPanel
                phase={phase as "completed" | "failed" | "cancelled" | "timed_out"}
                run={detailData}
                totals={{
                  liveExtracted: state.liveExtracted,
                  liveUnknown: state.liveUnknown,
                  liveRejected: state.liveRejected,
                }}
                elapsedMs={detailData ? sumStageDurations(detailData.stages) : null}
                costSoFar={state.costSoFar}
                onRunAgain={handleRunAgain}
                onUseCachedFallback={
                  phase === "failed" || phase === "timed_out" ? handleUseCachedFallback : undefined
                }
                width="narrow"
              />
            </div>
          ) : activeRunId ? (
            <PanelBody className="min-h-0 flex-1 overflow-y-auto py-0">
              <EmergingRecord
                stages={state.stages}
                notes={detailData?.stages}
                mpn={submittedInput?.mpn}
                description={submittedInput?.description}
                documentName={submittedInput?.documentName}
              />
            </PanelBody>
          ) : (
            <PanelBody className="flex flex-1 items-center">
              <EmptyState
                icon={FileQuestion}
                title="No run yet"
                description="Submit an MPN or description on the left to run it through the full pipeline. Nothing is pre-loaded."
              />
            </PanelBody>
          )}
        </Panel>
      </div>

      {/* The instrument rail. Every number is derived by the reducer from the stream, never
          typed here (lib/run-events/reducer.ts) — the same values `LiveStatsBar` carried,
          given the Stitch screen's card treatment. */}
      <StatCardRow label="Live run counters" className="grid-cols-2 sm:grid-cols-4">
        <StatCard label="Extracted" value={state.liveExtracted} icon={ScanSearch} />
        <StatCard label="Unknown" value={state.liveUnknown} icon={CircleHelp} />
        <StatCard label="Rejected" value={state.liveRejected} icon={TriangleAlert} />
        <StatCard
          label="Cost so far"
          value={formatCostUsd(state.costSoFar)}
          icon={CircleDollarSign}
          accent
        />
      </StatCardRow>
    </PageContainer>
  );
}
