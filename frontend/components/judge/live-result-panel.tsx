"use client";

/**
 * The completion / failure / timeout hand-off (docs/14-frontend-implementation-plan.md
 * §6 F4: "Completion hands off into the F1/F3 surfaces — the run result links straight
 * to the Why panel"). When the run resolves to the canonical demo record, this reuses
 * the real `AttributeRow`/`WhyPanelTrigger` against that record's actual attribute
 * values — no parallel result DTO is invented (F4 scope: "Reuse the existing OpenSpec
 * provenance/evidence model"). When there is no catalog record to hand off into (the
 * abstain scenario, or any unrecognised free-text input), that absence is itself the
 * point: Judge Mode is isolated from catalog data (FR-JDG-5).
 */
import Link from "next/link";
import { CheckCircle2, Circle, ClockAlert, FileQuestion, XCircle } from "lucide-react";
import { AttributeRow } from "@/components/attribute/attribute-row";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/state/loading";
import { EmptyState } from "@/components/state/empty-state";
import { useRecordDetailQuery } from "@/lib/queries/records";
import { UNKNOWN_REASON_COPY } from "@/lib/format/unknown-reason";
import { formatCostUsd, formatDurationMs } from "@/lib/format/run";
import type { RunPhase, RunTargetTotals } from "@/lib/run-events/reducer";
import type { Run } from "@/lib/contracts/run";

/** The three demo beats this MPN is authored to carry (docs/14-frontend-implementation-
 *  plan.md §4.2): the Tier-0 pressure gate, the ANSI-Class-from-WOG refusal, and the
 *  wrong-row seat-material rejection. Shown in this order when present. */
const HERO_ATTRIBUTE_CODES = ["pressure_rating_wog", "seat_material", "ansi_class"];

type TerminalPhase = Extract<RunPhase, "completed" | "failed" | "cancelled" | "timed_out">;

export interface LiveResultPanelProps {
  phase: TerminalPhase;
  run: Run | undefined;
  totals: RunTargetTotals;
  elapsedMs: number | null;
  costSoFar: number;
  onRunAgain: () => void;
  /** "Run again" (default) restarts a fresh submission; `/runs/:id` relabels it to
   *  "Replay narration" since there's no form to resubmit there — same underlying
   *  behaviour (a fresh pass over the same deterministic script), different framing. */
  runAgainLabel?: string;
  onUseCachedFallback?: () => void;
  /** "judge" (default) frames a no-record completion as Judge Mode's catalog isolation
   *  (FR-JDG-5); "monitor" is `/runs/:id` viewing a batch run, where that framing would
   *  be misleading — the aggregate counts are already shown by `LiveStatsBar` above this
   *  panel, so there's nothing extra to say. */
  context?: "judge" | "monitor";
  /** Suppresses the self-referential "View in Run Monitor" link when this panel is
   *  already rendered on `/runs/:id`. */
  hideRunMonitorLink?: boolean;
}

export function LiveResultPanel({
  phase,
  run,
  totals,
  elapsedMs,
  costSoFar,
  onRunAgain,
  runAgainLabel = "Run again",
  onUseCachedFallback,
  context = "judge",
  hideRunMonitorLink = false,
}: LiveResultPanelProps) {
  return (
    <div
      className="border-border flex flex-col gap-3 rounded-lg border p-4"
      data-testid="live-result-panel"
      role="status"
      aria-live="polite"
    >
      <Headline phase={phase} totals={totals} elapsedMs={elapsedMs} costSoFar={costSoFar} />

      {phase === "completed" ? <CompletedBody run={run} totals={totals} context={context} /> : null}

      {(phase === "failed" || phase === "timed_out") && onUseCachedFallback ? (
        <p className="text-muted-foreground text-xs">
          Judge Mode hit its time budget or a transport error — this is FR-JDG-4&rsquo;s
          graceful-partial path, not a crash. A pre-cached result is one click away for the demo.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={onRunAgain}>
          {runAgainLabel}
        </Button>
        {(phase === "failed" || phase === "timed_out") && onUseCachedFallback ? (
          <Button size="sm" variant="outline" onClick={onUseCachedFallback}>
            Load cached demo result
          </Button>
        ) : null}
        {run && !hideRunMonitorLink ? (
          <Button size="sm" variant="ghost" render={<Link href={`/runs/${run.id}`} />}>
            View in Run Monitor →
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Headline({
  phase,
  totals,
  elapsedMs,
  costSoFar,
}: {
  phase: TerminalPhase;
  totals: RunTargetTotals;
  elapsedMs: number | null;
  costSoFar: number;
}) {
  const timing = elapsedMs !== null ? ` in ${formatDurationMs(elapsedMs)}` : "";
  const cost = ` for ${formatCostUsd(costSoFar)}`;

  if (phase === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <Circle className="text-muted-foreground size-5" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">Run cancelled</p>
      </div>
    );
  }
  if (phase === "timed_out") {
    return (
      <div className="flex items-center gap-2">
        <ClockAlert className="text-status-needs-approval size-5" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">
          Partial results — the run exceeded its time budget
        </p>
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="text-status-rejected size-5" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">Run failed</p>
      </div>
    );
  }

  // completed
  if (totals.liveExtracted === 0 && totals.liveRejected === 0 && totals.liveUnknown > 0) {
    return (
      <div className="flex items-center gap-2">
        <FileQuestion className="text-status-unknown size-5" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">
          Run complete — abstained on every attribute{timing}
        </p>
      </div>
    );
  }
  if (totals.liveRejected > 0) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="text-status-needs-review size-5" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">
          Run complete — {totals.liveRejected} value{totals.liveRejected === 1 ? "" : "s"} rejected
          by verification, held for review{timing}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="text-status-accepted size-5" aria-hidden="true" />
      <p className="text-foreground text-sm font-medium">
        Run complete — {totals.liveExtracted} extracted, {totals.liveUnknown} unknown{timing}
        {cost}
      </p>
    </div>
  );
}

function CompletedBody({
  run,
  totals,
  context,
}: {
  run: Run | undefined;
  totals: RunTargetTotals;
  context: "judge" | "monitor";
}) {
  if (run?.recordId) {
    return <RecordHandoff recordId={run.recordId} />;
  }

  if (context === "judge" && totals.liveUnknown > 0) {
    const copy = UNKNOWN_REASON_COPY.NO_DOCUMENT_FOUND;
    return (
      <EmptyState
        icon={FileQuestion}
        title={copy.label}
        description={`${copy.remediation} No catalog record exists for this input — Judge Mode runs are isolated from catalog data (FR-JDG-5), so there is nothing to open here.`}
      />
    );
  }

  return null;
}

function RecordHandoff({ recordId }: { recordId: string }) {
  const record = useRecordDetailQuery(recordId);

  if (record.status === "pending") return <LoadingBlock rows={3} />;
  if (record.status === "error") return null; // the run itself still reports success — a display-only miss

  const heroAttributes = HERO_ATTRIBUTE_CODES.map((code) =>
    record.data.attributes.find((a) => a.attribute.code === code),
  ).filter((a): a is NonNullable<typeof a> => a !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border rounded-lg border px-3">
        {heroAttributes.map((value) => (
          <AttributeRow key={value.id} value={value} />
        ))}
      </div>
      <Link href={`/catalog/${recordId}`} className="text-primary w-fit text-sm hover:underline">
        Open full record ({record.data.mpnRaw}) →
      </Link>
    </div>
  );
}
