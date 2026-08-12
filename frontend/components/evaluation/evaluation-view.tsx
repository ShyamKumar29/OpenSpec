"use client";

/**
 * `/evaluation` — the quality gate (docs/14-frontend-implementation-plan.md §6 F7):
 * "frontier chart... reliability diagram... per-slice table... ablation table...
 * classification metrics... Wilson confidence intervals on every rate... real slice
 * first, synthetic second, always labelled... run history with deltas... plain-language
 * 'what this metric means' for each chart." Every section below maps to one of those.
 *
 * Which run is selected lives in the URL (`?run=<id>`), same discipline as the catalog's
 * filters (docs/06-frontend.md §6) — shareable, back-button-correct, and it's what makes
 * `RunHistoryTable`'s row links a real drill-down rather than component-local state.
 */
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GitCompareArrows, LineChart, Layers, ListTree, Radar } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { RunHistoryTable } from "./run-history-table";
import { HeadlineMetricsGrid } from "./headline-metrics-grid";
import { FrontierChart } from "./frontier-chart";
import { ReliabilityDiagram } from "./reliability-diagram";
import { SliceTable } from "./slice-table";
import { AblationTable } from "./ablation-table";
import { RunEvalButton } from "./run-eval-button";
import { useEvalRunDetailQuery, useEvalRunsQuery } from "@/lib/queries/evaluation";

export function EvaluationView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runsQuery = useEvalRunsQuery();

  const requestedRunId = searchParams.get("run");
  const latestRunId = runsQuery.data?.at(-1)?.id ?? null;
  const knownIds = useMemo(
    () => new Set((runsQuery.data ?? []).map((r) => r.id)),
    [runsQuery.data],
  );
  const selectedRunId =
    requestedRunId && knownIds.has(requestedRunId) ? requestedRunId : latestRunId;

  const detailQuery = useEvalRunDetailQuery(selectedRunId);

  return (
    <>
      <PageHeader
        title="Evaluation"
        description="Gold-set quality gate — frontier, calibration, per-slice results, and the ablation that quantifies each safety layer."
        eyebrow="Quality & precision analytics"
        actions={<RunEvalButton />}
      />
      <PageContainer className="flex flex-col gap-4">
        {runsQuery.status === "pending" ? (
          <LoadingBlock rows={3} className="h-40" />
        ) : runsQuery.status === "error" ? (
          <ErrorState error={runsQuery.error} onRetry={() => runsQuery.refetch()} />
        ) : runsQuery.data.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="No evaluation runs yet"
            description="Run the gold-set harness ('make eval', docs/09-testing.md §6) to produce the first evaluation run."
          />
        ) : (
          <>
            <DashboardCard
              icon={GitCompareArrows}
              title="Run history"
              description="Every eval run, most recent first, with the delta against the previous run."
              requirement="FR-EVL — historical comparison"
            >
              <RunHistoryTable
                runs={runsQuery.data}
                selectedRunId={selectedRunId ?? ""}
                pathname={pathname}
              />
            </DashboardCard>

            {detailQuery.status === "pending" ? (
              <LoadingCard />
            ) : detailQuery.status === "error" ? (
              <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />
            ) : (
              <>
                <div className="border-border bg-card rounded-sm border p-4">
                  <HeadlineMetricsGrid
                    headlineMetrics={detailQuery.data.headlineMetrics}
                    runId={detailQuery.data.id}
                    goldSetVersion={detailQuery.data.goldSetVersion}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <DashboardCard
                    icon={LineChart}
                    title="Precision / cost frontier"
                    description="OpenSpec's operating modes against a generic, no-abstention baseline."
                    requirement="docs/03-ai-pipeline.md §8.3"
                  >
                    <FrontierChart frontier={detailQuery.data.frontier} />
                  </DashboardCard>

                  <DashboardCard
                    icon={Radar}
                    title="Calibration — reliability diagram"
                    description="Predicted confidence vs. observed accuracy, bucketed."
                    requirement="QR-13"
                  >
                    <ReliabilityDiagram
                      reliability={detailQuery.data.reliability}
                      ece={
                        detailQuery.data.headlineMetrics.find((m) => m.metricCode === "ece")?.value
                      }
                    />
                  </DashboardCard>
                </div>

                <DashboardCard
                  icon={ListTree}
                  title="Per-slice results"
                  description="Real slices first, synthetic second — always labelled (FR-EVL-4)."
                  requirement="FR-EVL-4"
                >
                  <SliceTable sliceMetrics={detailQuery.data.sliceMetrics} />
                </DashboardCard>

                <DashboardCard
                  icon={Layers}
                  title="Ablation — cost of each defence layer"
                  description="The gold set re-run with one layer disabled at a time."
                  requirement="docs/03-ai-pipeline.md §8.4"
                >
                  <AblationTable ablation={detailQuery.data.ablation} />
                </DashboardCard>
              </>
            )}
          </>
        )}
      </PageContainer>
    </>
  );
}
