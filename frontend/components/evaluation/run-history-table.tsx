import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import type { EvalRunSummary } from "@/lib/contracts/eval";

/**
 * Evaluation run history — `GET /eval/runs`, most recent first, each row showing the
 * delta against the *previous* run so a reader sees the trend without cross-referencing
 * the quality-trend chart on `/` (FR-DSH-4 already covers the two-metric mini-trend;
 * this table is the run-by-run ledger FR-EVL asks for — "historical comparison").
 * Selecting a row drives the rest of the page via `?run=<id>` in the URL (docs/06-
 * frontend.md §6: filters/selection live in the URL, never component state), so the
 * selected run's drill-down is a shareable, back-button-correct link.
 */
function metricValue(run: EvalRunSummary, code: string): number | undefined {
  return run.headlineMetrics.find((m) => m.metricCode === code)?.value;
}

interface RunRow {
  run: EvalRunSummary;
  stpDelta: number | null;
  precisionDelta: number | null;
}

function withDeltas(runsOldestFirst: EvalRunSummary[]): RunRow[] {
  return runsOldestFirst.map((run, i) => {
    const prev = i > 0 ? runsOldestFirst[i - 1] : null;
    const stp = metricValue(run, "stp_all_mandatory");
    const precision = metricValue(run, "precision");
    const prevStp = prev ? metricValue(prev, "stp_all_mandatory") : undefined;
    const prevPrecision = prev ? metricValue(prev, "precision") : undefined;
    return {
      run,
      stpDelta: stp !== undefined && prevStp !== undefined ? stp - prevStp : null,
      precisionDelta:
        precision !== undefined && prevPrecision !== undefined ? precision - prevPrecision : null,
    };
  });
}

function DeltaLabel({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-muted-foreground text-xs">first run</span>;
  }
  const good = delta >= 0;
  return (
    <span
      className={cn(
        "metric inline-flex items-center gap-0.5 text-xs font-medium",
        good ? "text-status-accepted" : "text-status-rejected",
      )}
    >
      {good ? (
        <TrendingUp className="size-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="size-3" aria-hidden="true" />
      )}
      {good ? "+" : ""}
      {Math.round(delta * 100)}pts
    </span>
  );
}

export function RunHistoryTable({
  runs,
  selectedRunId,
  pathname,
  className,
}: {
  /** Oldest-first, matching the wire order from `GET /eval/runs`. */
  runs: EvalRunSummary[];
  selectedRunId: string;
  /** The current route, e.g. `/evaluation` — passed in rather than read via
   *  `usePathname()` here so this component stays a plain, router-free presentational
   *  component (only `EvaluationView` touches navigation hooks), the same division of
   *  responsibility `CatalogView`/`FilterBar` use. */
  pathname: string;
  className?: string;
}) {
  const rows = withDeltas(runs).reverse(); // newest first for display
  const latestId = runs.at(-1)?.id;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Gold set</TableHead>
            <TableHead>STP (all mandatory)</TableHead>
            <TableHead>Precision</TableHead>
            <TableHead>vs previous run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ run, stpDelta, precisionDelta }) => {
            const isSelected = run.id === selectedRunId;
            const stp = metricValue(run, "stp_all_mandatory");
            const precision = metricValue(run, "precision");
            return (
              <TableRow
                key={run.id}
                data-testid="eval-run-row"
                data-selected={isSelected}
                aria-current={isSelected ? "true" : undefined}
                className={cn(isSelected && "bg-accent/50")}
              >
                <TableCell>
                  <Link
                    href={`${pathname}?run=${run.id}`}
                    scroll={false}
                    className={cn(
                      "metric font-medium underline-offset-4 hover:underline",
                      isSelected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {run.id}
                  </Link>
                  {run.id === latestId ? (
                    <span className="bg-status-accepted-bg text-status-accepted ml-2 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase">
                      Latest
                    </span>
                  ) : null}
                  <div className="text-muted-foreground metric text-[0.7rem]">{run.gitSha}</div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(run.startedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell className="metric text-xs">{run.goldSetVersion}</TableCell>
                <TableCell className="metric text-xs">
                  {stp !== undefined ? formatPercent(stp) : "—"}
                </TableCell>
                <TableCell className="metric text-xs">
                  {precision !== undefined ? formatPercent(precision) : "—"}
                </TableCell>
                <TableCell className="flex flex-col gap-0.5">
                  <DeltaLabel delta={stpDelta} />
                  <DeltaLabel delta={precisionDelta} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
