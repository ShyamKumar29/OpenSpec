import { ArrowUpRight, ListTree } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/state/empty-state";
import { SourceBadge } from "./source-badge";
import { formatPercent } from "@/lib/format/percent";
import { metricMeta } from "@/lib/evaluation/metric-meta";
import { catalogLinkForSlice, sliceLabel } from "@/lib/evaluation/slice-links";
import { cn } from "@/lib/utils";
import type { EvalRunDetail } from "@/lib/contracts/eval";

/**
 * Per-slice breakdown — **real slices first, synthetic second, always labelled** (FR-
 * EVL-4, the one non-negotiable ordering rule for this table). A real per-class slice
 * links straight into the live Catalog filtered to that class (`lib/evaluation/slice-
 * links.ts`) — the closest this table can get to "drill down into records" given the API
 * only exposes aggregate gold-set metrics, never individual gold-set examples.
 */
export function SliceTable({
  sliceMetrics,
  className,
}: {
  sliceMetrics: EvalRunDetail["sliceMetrics"];
  className?: string;
}) {
  if (sliceMetrics.length === 0) {
    return (
      <EmptyState
        icon={ListTree}
        title="No per-slice data for this run"
        description="Only the most recent eval run in this fixture set carries the full per-slice breakdown — select the latest run to see it."
        className={className}
      />
    );
  }

  const sorted = [...sliceMetrics].sort((a, b) => {
    if (a.isReal !== b.isReal) return a.isReal ? -1 : 1; // real first, always
    return a.slice.localeCompare(b.slice);
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slice</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Metric</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>95% CI</TableHead>
            <TableHead>n</TableHead>
            <TableHead className="sr-only">Drill down</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((m) => {
            const link = catalogLinkForSlice(m.slice);
            const meta = metricMeta(m.metricCode);
            return (
              <TableRow key={`${m.slice}-${m.metricCode}`}>
                <TableCell className="font-medium capitalize">{sliceLabel(m.slice)}</TableCell>
                <TableCell>
                  <SourceBadge isReal={m.isReal} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{meta.label}</TableCell>
                <TableCell className="metric text-xs font-semibold">
                  {formatPercent(m.value)}
                </TableCell>
                <TableCell className="metric text-muted-foreground text-xs">
                  [{formatPercent(m.ciLow)}, {formatPercent(m.ciHigh)}]
                </TableCell>
                <TableCell className="metric text-muted-foreground text-xs">n={m.n}</TableCell>
                <TableCell>
                  {link ? (
                    <Link
                      href={link}
                      className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                    >
                      View in catalog
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
