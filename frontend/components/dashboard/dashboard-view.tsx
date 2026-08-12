"use client";

/**
 * `/` — the operations command center (docs/14-frontend-implementation-plan.md §6 F6).
 *
 * The dashboard is a command center, not an analytics report: at a desktop viewport the
 * whole thing fits on one screen, in three bands and nothing else.
 *
 *   1. the **environment** — a full-bleed industrial scene with the enrichment tower at
 *      its centre, the catalog as the city around it, the run/system overview and the
 *      operational-state summary floating over it as instruments, and four to six hotspot
 *      callouts annotating the beams they report on;
 *   2. the **pipeline strip** — the nine persisted stages of the in-flight run, one row;
 *   3. the **metrics rail** — the "is the system healthy" summary, one divided bar.
 *
 * There is deliberately nothing below that. The completeness histogram, the STP Wilson
 * intervals, the Unknown-reason breakdown, the cost and throughput panels and the quality
 * trend are *detailed analytical views*; they belong to `/catalog`, `/review` and
 * `/evaluation`, and every tile, callout and node here is a link into the page that owns
 * its number. The components themselves are untouched — the dashboard summarises them
 * rather than embedding them.
 *
 * The data contract is unchanged and is the whole point: every number is fetched from the
 * live fixture store through the same `lib/queries/*` hooks every other page uses
 * (`lib/queries/metrics.ts`, `lib/queries/review.ts`, `lib/queries/runs.ts`). Nothing here
 * fetches directly, and nothing in the visualization is invented for visual effect — the
 * mapping from application state to districts, beams and landing zones lives in
 * `lib/dashboard/command-center.ts`, and a channel with no work in it emits no energy.
 */
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Coins,
  FileSearch,
  Gauge,
  Grid2x2,
  Inbox,
  PieChart,
  PlayCircle,
  Radio,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Panel } from "@/components/shell/panel";
import { ErrorState } from "@/components/state/error-state";
import { LoadingBlock } from "@/components/state/loading";
import { CommandCenter, type CommandCenterCallout } from "./command-center";
import { FlowLegend } from "./flow-legend";
import { KpiStrip, KpiTile } from "./kpi-strip";
import { InsightCallout } from "./insight-callout";
import { OperationsPulse } from "./operations-pulse";
import { StateSummary } from "./state-summary";
import { PipelineBand } from "./pipeline-band";
import { formatPercent } from "@/lib/format/percent";
import { bucketCompleteness, buildChannels } from "@/lib/dashboard/command-center";
import { runProgress } from "@/lib/dashboard/run-progress";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import {
  useCatalogHealthQuery,
  useQualityTrendQuery,
  useThroughputQuery,
} from "@/lib/queries/metrics";
import { useReviewCountsQuery } from "@/lib/queries/review";
import { useRunsQuery } from "@/lib/queries/runs";

const STP_ALL_TARGET = 0.55;
const STP_AUTO_TARGET = 0.75;

export function DashboardView() {
  const catalogHealth = useCatalogHealthQuery();
  const throughput = useThroughputQuery();
  const qualityTrend = useQualityTrendQuery();
  const reviewCounts = useReviewCountsQuery();
  const runs = useRunsQuery();

  const runningCount = runs.data?.items.filter((r) => r.status === "running").length ?? 0;
  const activeRun = runs.data?.items.find((r) => r.status === "running") ?? null;
  const firstActiveRunId = activeRun?.id ?? null;
  // The same arithmetic the pipeline strip below the hero uses, from the same helper — two
  // readouts of one run's progress on one screen must not be able to disagree.
  const progress = runProgress(activeRun);

  const stpSeries =
    qualityTrend.data?.series
      .map((s) => s.metrics.find((m) => m.metricCode === "stp_all_mandatory")?.value)
      .filter((v): v is number => typeof v === "number") ?? [];
  const stpRunsAgo = stpSeries.length > 0 ? stpSeries.length - 1 : 0;
  const stpDelta = stpSeries.length >= 2 ? stpSeries[stpSeries.length - 1] - stpSeries[0] : null;

  const topUnknownReason = catalogHealth.data
    ? [...catalogHealth.data.unknownReasonBreakdown].sort((a, b) => b.count - a.count)[0]
    : null;

  // Catalog-wide completeness: the same weighted mean of the histogram `/catalog` shows,
  // so the headline number and the distribution it summarises can never disagree.
  const completeness = catalogHealth.data
    ? (() => {
        const dist = catalogHealth.data.completenessDistribution;
        const total = dist.reduce((sum, d) => sum + d.count, 0);
        if (total === 0) return null;
        return (
          dist.reduce(
            (sum, d, i) => sum + d.count * bucketCompleteness(d.bucket, i, dist.length),
            0,
          ) / total
        );
      })()
    : null;

  // The beams. Derived, not decorated — see `lib/dashboard/command-center.ts`.
  const channels = buildChannels({
    catalogHealth: catalogHealth.data,
    reviewCounts: reviewCounts.data,
  });
  const channelValue = (id: string) => channels.find((c) => c.id === id)?.value ?? null;

  const autoAccepted = channelValue("auto-accepted");
  const verificationFailed = channelValue("review-VERIFICATION_FAILED");
  const noDocument = channelValue("review-NO_DOCUMENT");

  /**
   * The hotspots, each in the footprint of the environment it reports on.
   *
   * Every one is real or absent: a card only appears once the query behind it has
   * resolved, because a hotspot showing a placeholder over an operational picture is
   * indistinguishable from a hotspot showing a fact. `channelId` wires the card to the
   * flow it is the label for, so that ray aims here and does not also grow a second,
   * duplicate marker chip.
   */
  const callouts: CommandCenterCallout[] = [
    ...(noDocument !== null
      ? [
          {
            id: "doc-binding",
            channelId: "review-NO_DOCUMENT",
            slot: "doc-binding" as const,
            content: (
              <InsightCallout
                icon={FileSearch}
                tone="attention"
                surface="env"
                size="sm"
                tail="right"
                title="Document binding"
                value={noDocument.toLocaleString()}
                description="Records with no source document bound — nothing to extract from."
                href="/review?reason_code=NO_DOCUMENT"
              />
            ),
          },
        ]
      : []),
    ...(activeRun
      ? [
          {
            id: "active-run",
            channelId: null,
            slot: "active-run" as const,
            content: (
              <InsightCallout
                icon={PlayCircle}
                tone="neutral"
                surface="env"
                size="sm"
                title="Active run"
                value={`${progress.overall}%`}
                description={
                  progress.currentStage
                    ? `${STAGE_COPY[progress.currentStage].label} stage — ${activeRun.mpn ?? `${activeRun.kind} run`}`
                    : `${activeRun.mpn ?? `${activeRun.kind} run`}`
                }
                meta={`${progress.doneCount}/${progress.totalStages} stages complete`}
                href={`/runs/${activeRun.id}`}
              />
            ),
          },
        ]
      : []),
    ...(topUnknownReason
      ? [
          {
            id: "unknown",
            channelId: "unknown-hotspot",
            slot: "unknown" as const,
            content: (
              <InsightCallout
                icon={Gauge}
                tone="neutral"
                surface="env"
                size="sm"
                tail="left"
                title="Unknown hotspot"
                value={topUnknownReason.count.toLocaleString()}
                description={`${topUnknownReason.reason.replaceAll("_", " ").toLowerCase()} → ${topUnknownReason.fixOwner}`}
                href="/catalog?has_unknown_reason=true"
              />
            ),
          },
        ]
      : []),
    ...(autoAccepted !== null
      ? [
          {
            id: "healthy",
            channelId: "auto-accepted",
            slot: "healthy" as const,
            content: (
              <InsightCallout
                icon={CheckCircle2}
                tone="positive"
                surface="env"
                size="sm"
                tail="right"
                title="Healthy enrichment"
                value={autoAccepted.toLocaleString()}
                description={`Commerce-ready records — ${formatPercent(
                  catalogHealth.data?.stpAutoEligibleOnly.value ?? 0,
                )} straight-through on every auto-eligible attribute.`}
                href="/catalog?status=ACCEPTED"
              />
            ),
          },
        ]
      : []),
    ...(reviewCounts.status === "success"
      ? [
          {
            id: "tier0",
            channelId: "review-TIER0_APPROVAL",
            slot: "tier0" as const,
            content: (
              <InsightCallout
                icon={ShieldAlert}
                tone="attention"
                surface="env"
                size="sm"
                tail="left"
                title="Tier-0 gate"
                value={reviewCounts.data.counts.TIER0_APPROVAL.toLocaleString()}
                description="Pressure, temperature, class & compliance — never auto-accepted (INV-9)."
                href="/review?reason_code=TIER0_APPROVAL"
              />
            ),
          },
          {
            id: "review-workload",
            channelId: null,
            slot: "review" as const,
            content: (
              <InsightCallout
                icon={Inbox}
                tone="attention"
                surface="env"
                size="sm"
                tail="left"
                title="Review workload"
                value={reviewCounts.data.totalOpen.toLocaleString()}
                description="Open tasks across all six reason codes, waiting on a human."
                href="/review"
              />
            ),
          },
        ]
      : []),
    ...(verificationFailed !== null
      ? [
          {
            id: "verification",
            channelId: "review-VERIFICATION_FAILED",
            slot: "validation" as const,
            content: (
              <InsightCallout
                icon={AlertOctagon}
                tone="critical"
                surface="env"
                size="sm"
                tail="right"
                title="Validation failures"
                value={verificationFailed.toLocaleString()}
                description="Independent verifier did not entail the proposed span (INV-2)."
                href="/review?reason_code=VERIFICATION_FAILED"
              />
            ),
          },
        ]
      : []),
  ];

  return (
    // One viewport at `xl` and up: the hero takes whatever is left after the two strips
    // below it, and nothing scrolls. Below `xl` the height goes back to auto, because a
    // 1024px-wide laptop cannot show a command center, a pipeline and nine metrics at
    // once and pretending otherwise would just make all three unreadable.
    // `5.75rem` is the app shell's chrome — the 3.5rem topbar plus the 2.25rem breadcrumb
    // strip (`components/shell/app-shell.tsx`).
    <div className="flex flex-col gap-2 px-3 py-3 sm:px-4 xl:h-[calc(100svh-5.75rem)] xl:gap-2.5">
      {/* — Identity strip. Deliberately one line: the reference composition goes straight
            from the chrome into the environment, and a page header tall enough to hold a
            display title is the single biggest thing standing between this dashboard and
            fitting on a screen. */}
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-foreground font-heading shrink-0 text-base leading-none font-bold tracking-tight">
            Dashboard
          </h1>
          <span className="label-caps text-muted-foreground truncate">
            Operations command center
          </span>
        </div>
        <span className="text-muted-foreground metric hidden items-center gap-1.5 text-[0.6875rem] sm:inline-flex">
          <Radio className="size-3" aria-hidden="true" />
          Live — refreshes automatically
        </span>
      </div>

      {/* 1 — The environment. The hero of the page, and the majority of its pixels: the
             enrichment tower, the catalog it is working through, and every operational
             hotspot in one frame. */}
      {catalogHealth.status === "error" ? (
        <ErrorState error={catalogHealth.error} onRetry={() => catalogHealth.refetch()} />
      ) : catalogHealth.status === "pending" ? (
        <LoadingBlock rows={8} className="min-h-[22rem] xl:min-h-0 xl:flex-1" />
      ) : (
        <CommandCenter
          className="xl:min-h-0 xl:flex-1"
          channels={channels}
          totalRecords={catalogHealth.data.totalRecords}
          live={runningCount > 0}
          overviewSlot={
            <Panel className="shadow-elevation-3">
              <OperationsPulse dense />
            </Panel>
          }
          statusSlot={
            <Panel className="shadow-elevation-3">
              <StateSummary
                channels={channels}
                runningCount={runningCount}
                totalRuns={runs.data?.items.length ?? 0}
              />
            </Panel>
          }
          legendSlot={<FlowLegend />}
          calloutSlots={callouts}
        />
      )}

      {/* 2 — The pipeline strip: the nine persisted stages of the in-flight run, in one
             row, linking through to the run itself. */}
      <PipelineBand className="shrink-0" />

      {/* 3 — The metrics rail: the "is the system healthy" summary, one divided bar. Every
             cell is a link into the page that owns its number. */}
      {catalogHealth.status === "error" ? (
        <ErrorState error={catalogHealth.error} onRetry={() => catalogHealth.refetch()} />
      ) : catalogHealth.status === "pending" || throughput.status === "pending" ? (
        <LoadingBlock rows={1} className="h-20 shrink-0" />
      ) : (
        <KpiStrip className="shrink-0">
          <KpiTile
            testId="kpi-catalog-records"
            icon={Grid2x2}
            label="Total records"
            value={catalogHealth.data.totalRecords.toLocaleString()}
            detail="5 PVF classes"
            href="/catalog"
          />
          {completeness !== null ? (
            <KpiTile
              testId="kpi-completeness"
              icon={PieChart}
              label="Completeness"
              value={formatPercent(completeness)}
              detail="mandatory attrs"
              meter={{ fraction: completeness, targetFraction: null, met: completeness >= 0.75 }}
              href="/catalog"
            />
          ) : null}
          <KpiTile
            testId="kpi-stp-all"
            icon={Gauge}
            label="STP rate"
            value={formatPercent(catalogHealth.data.stpAllMandatory.value)}
            detail="target 55%"
            series={stpSeries}
            meter={{
              fraction: catalogHealth.data.stpAllMandatory.value,
              targetFraction: STP_ALL_TARGET,
              met: catalogHealth.data.stpAllMandatory.value >= STP_ALL_TARGET,
            }}
            delta={
              stpDelta !== null
                ? {
                    direction: stpDelta >= 0 ? "up" : "down",
                    good: stpDelta >= 0,
                    label: `${stpDelta >= 0 ? "+" : ""}${Math.round(stpDelta * 100)}pts / ${stpRunsAgo} run${stpRunsAgo === 1 ? "" : "s"}`,
                  }
                : undefined
            }
            href="/evaluation"
          />
          <KpiTile
            testId="kpi-stp-auto"
            icon={Gauge}
            label="Auto-eligible"
            value={formatPercent(catalogHealth.data.stpAutoEligibleOnly.value)}
            detail="target 75%"
            meter={{
              fraction: catalogHealth.data.stpAutoEligibleOnly.value,
              targetFraction: STP_AUTO_TARGET,
              met: catalogHealth.data.stpAutoEligibleOnly.value >= STP_AUTO_TARGET,
            }}
            href="/evaluation"
          />
          <KpiTile
            testId="kpi-open-workload"
            icon={AlertOctagon}
            label="Review workload"
            value={reviewCounts.data?.totalOpen.toLocaleString() ?? "—"}
            detail="6 reason codes"
            href="/review"
          />
          <KpiTile
            testId="kpi-tier0-pending"
            icon={ShieldAlert}
            label="Tier-0 pending"
            value={reviewCounts.data?.counts.TIER0_APPROVAL.toLocaleString() ?? "—"}
            detail="never auto (INV-9)"
            href="/review?reason_code=TIER0_APPROVAL"
          />
          {throughput.status === "success" ? (
            <>
              <KpiTile
                testId="kpi-cost-per-sku"
                icon={Coins}
                label="Cost / SKU"
                value={`$${throughput.data.costPerSkuUsd.toFixed(3)}`}
                detail="≤$0.12 target"
              />
              <KpiTile
                testId="kpi-review-throughput"
                icon={Timer}
                label="Review rate"
                value={`${(throughput.data.reviewerRatePerHour / throughput.data.baselineRatePerHour).toFixed(1)}×`}
                detail="vs manual"
                href="/review"
              />
            </>
          ) : null}
          <KpiTile
            testId="kpi-active-runs"
            icon={Activity}
            label="Active runs"
            value={String(runningCount)}
            detail={`of ${runs.data?.items.length ?? 0} total`}
            href={firstActiveRunId ? `/runs/${firstActiveRunId}` : "/judge"}
          />
        </KpiStrip>
      )}
    </div>
  );
}
