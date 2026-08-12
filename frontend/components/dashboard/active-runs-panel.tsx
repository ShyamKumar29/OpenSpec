"use client";

/** Every run in the fixture universe — Judge Mode scenarios and catalog batches alike
 *  (FR-DSH-5: "run monitor"). Complements `OperationsPulse`, which only narrates the one
 *  currently-running run in detail: this is the roster, linking straight into
 *  `/runs/:id` (F4's monitor, reused rather than duplicated). */
import Link from "next/link";
import { CheckCircle2, CircleDashed, Hourglass, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingBlock } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { formatCostUsd } from "@/lib/format/run";
import { useRunsQuery } from "@/lib/queries/runs";
import type { RunStatus } from "@/lib/contracts/run";

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StatusIcon({ status }: { status: RunStatus }) {
  const cls = "size-3.5 shrink-0";
  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn(cls, "text-status-accepted")} aria-hidden="true" />;
    case "running":
      return (
        <Hourglass
          className={cn(cls, "text-status-needs-review animate-pulse motion-reduce:animate-none")}
          aria-hidden="true"
        />
      );
    case "failed":
      return <XCircle className={cn(cls, "text-status-rejected")} aria-hidden="true" />;
    case "cancelled":
      return <XCircle className={cn(cls, "text-muted-foreground")} aria-hidden="true" />;
    case "queued":
    default:
      return <CircleDashed className={cn(cls, "text-muted-foreground/60")} aria-hidden="true" />;
  }
}

export function ActiveRunsPanel({ className }: { className?: string }) {
  const runs = useRunsQuery();

  if (runs.status === "pending") return <LoadingBlock rows={4} className={className} />;
  if (runs.status === "error") {
    return <ErrorState error={runs.error} onRetry={() => runs.refetch()} className={className} />;
  }
  if (runs.data.items.length === 0) {
    return <EmptyState title="No runs yet" className={className} />;
  }

  return (
    <ul
      data-testid="active-runs-panel"
      className={cn("divide-border flex flex-col divide-y", className)}
    >
      {runs.data.items.map((run) => (
        <li key={run.id}>
          <Link
            href={`/runs/${run.id}`}
            className="hover:bg-accent/40 flex items-center gap-2.5 rounded-md px-1 py-2 text-xs transition-colors"
          >
            <span className="sr-only">{STATUS_LABEL[run.status]}</span>
            <StatusIcon status={run.status} />
            <span className="text-foreground min-w-0 flex-1 truncate font-medium">
              {run.mpn ?? `${run.kind} run`}
            </span>
            <span className="text-muted-foreground shrink-0">{STATUS_LABEL[run.status]}</span>
            <span className="metric text-muted-foreground w-16 shrink-0 text-right">
              {formatCostUsd(run.costUsd)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
