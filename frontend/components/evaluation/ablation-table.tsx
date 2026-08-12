import { Layers, TrendingDown, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/state/empty-state";
import { formatPercent } from "@/lib/format/percent";
import { metricMeta } from "@/lib/evaluation/metric-meta";
import { cn } from "@/lib/utils";
import type { EvalRunDetail } from "@/lib/contracts/eval";

/** ECE is reported as a raw decimal everywhere else in this app (CLAUDE.md's own example,
 *  "ECE ~0.04") — every other metric this table sees is a `0..1` rate, shown as a percent. */
function formatMetricValue(metricCode: string, value: number): string {
  return metricCode === "ece" ? value.toFixed(3) : formatPercent(value);
}

/**
 * Defence-in-depth, quantified — "the most convincing single artifact" (docs/03-ai-
 * pipeline.md §8.4). Each row is one layer switched off; `delta` is `with − without`, so
 * whether that number is "good" depends on the metric's direction (a *negative* delta on
 * ECE is the good outcome — the layer reduced error) — never inferred from the raw sign.
 */
export function AblationTable({
  ablation,
  className,
}: {
  ablation: EvalRunDetail["ablation"];
  className?: string;
}) {
  if (ablation.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No ablation data for this run"
        description="Only the most recent eval run in this fixture set carries the full ablation breakdown — select the latest run to see it."
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Layer</TableHead>
            <TableHead>Metric</TableHead>
            <TableHead>With</TableHead>
            <TableHead>Without</TableHead>
            <TableHead>Effect of this layer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ablation.map((row) => {
            const meta = metricMeta(row.metricCode);
            const improved = meta.direction === "higher-better" ? row.delta > 0 : row.delta < 0;
            const magnitude = formatMetricValue(row.metricCode, Math.abs(row.delta));
            return (
              <TableRow key={`${row.component}-${row.metricCode}`}>
                <TableCell className="font-medium">{row.component}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{meta.label}</TableCell>
                <TableCell className="metric text-xs font-semibold">
                  {formatMetricValue(row.metricCode, row.withComponent)}
                </TableCell>
                <TableCell className="metric text-muted-foreground text-xs">
                  {formatMetricValue(row.metricCode, row.withoutComponent)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "metric inline-flex items-center gap-1 text-xs font-medium",
                      improved ? "text-status-accepted" : "text-status-rejected",
                    )}
                  >
                    {improved ? (
                      <TrendingUp className="size-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="size-3" aria-hidden="true" />
                    )}
                    {improved ? "improves" : "worsens"} {meta.label.toLowerCase()} by {magnitude}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground mt-2 text-xs leading-snug">
        Each row removes one defence-in-depth layer (docs/03-ai-pipeline.md §6) and re-runs the gold
        set. Precision layers trade against straight-through processing by design — this is the
        measured cost of each safety layer, not a bug.
      </p>
    </div>
  );
}
