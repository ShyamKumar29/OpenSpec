"use client";

import { Panel, PanelHeader } from "@/components/shell/panel";
import { TierBadge } from "@/components/attribute/tier-badge";
import { REVIEW_REASON_LABEL, REVIEW_REASON_SEMANTIC } from "@/lib/format/review-reason";
import { STATUS } from "@/lib/status";
import type { ReviewTask } from "@/lib/contracts/review";
import { cn } from "@/lib/utils";

/**
 * The Stitch review screen's "Active Tasks" rail: the queue itself, visible beside the
 * task under judgement, each row carrying its record, attribute, and reason chip.
 *
 * Before this existed the queue was navigable only by keyboard (J/K) or by decision — the
 * reviewer could not see what was coming or jump to a specific task. The rail renders the
 * same `visibleOrder` the keyboard walks, so the two are always the same queue; clicking a
 * row is exactly what pressing J to it would have done.
 *
 * Deliberately a `<ul>` of buttons, not a listbox: selection here navigates the workspace
 * rather than picking a form value, and the decision controls live outside it.
 */
export function TaskListRail({
  tasks,
  currentTaskId,
  onSelect,
  hasMore,
  isLoadingMore,
  onLoadMore,
  children,
}: {
  tasks: ReviewTask[];
  currentTaskId: string | null;
  onSelect: (taskId: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** The reason-code filter, rendered inside the panel above the list. */
  children?: React.ReactNode;
}) {
  return (
    <Panel as="aside" className="flex min-h-0 flex-col">
      <PanelHeader
        title="Active tasks"
        as="h2"
        actions={
          <span className="metric text-muted-foreground text-xs">{tasks.length} loaded</span>
        }
      />

      {children ? <div className="border-border border-b px-3 py-2.5">{children}</div> : null}

      {/* A bounded, independently scrolling list — the rail must not stretch the page to
          the length of the queue. `max-h` rather than a fixed height so a short queue
          takes only the room it needs. */}
      <ul className="divide-border/60 max-h-[26rem] min-h-0 divide-y overflow-y-auto">
        {tasks.map((task) => {
          const active = task.id === currentTaskId;
          const semantic = REVIEW_REASON_SEMANTIC[task.reasonCode];
          return (
            <li key={task.id}>
              <button
                type="button"
                data-testid="queue-task"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(task.id)}
                className={cn(
                  "focus-visible:ring-ring relative flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  active ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {/* Structural marker for the focused task, not colour alone. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-0.5",
                    active ? "bg-foreground" : "bg-transparent",
                  )}
                />
                <span className="flex w-full min-w-0 items-center gap-1.5">
                  <span className="metric min-w-0 flex-1 truncate text-xs font-semibold">
                    {task.recordMpn}
                  </span>
                  <TierBadge tier={task.riskTier} />
                </span>
                <span className="text-foreground w-full truncate text-sm">
                  {task.attributeName}
                </span>
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
                    STATUS[semantic].bg,
                    STATUS[semantic].fg,
                  )}
                >
                  {REVIEW_REASON_LABEL[task.reasonCode]}
                </span>
              </button>
            </li>
          );
        })}

        {hasMore ? (
          <li>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="text-muted-foreground hover:bg-accent/50 hover:text-foreground w-full px-3 py-2 text-xs"
            >
              {isLoadingMore ? "Loading…" : "Load more tasks"}
            </button>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}
