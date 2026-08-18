import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A standalone metric card — the tile that recurs across the Stitch screens wherever a
 * page states a headline number outside the dashboard: the review queue's "Queue
 * Remaining / Throughput (1h)" pair, the evaluation overview's four-up metric row, the
 * judge workspace's bottom instrument rail, and the settings rail's system readout.
 *
 * Deliberately *not* `KpiTile` (`components/dashboard/kpi-strip.tsx`). That component is
 * a cell in the dashboard's flush, hairline-divided command-center rail and carries
 * sparklines and target meters; this is a discrete bordered card with a small-caps
 * caption over a large mono value, which is what the other Stitch screens actually draw.
 * Keeping them separate is what stops the dashboard's composition — which is locked —
 * from being dragged around by an unrelated page's needs.
 *
 * `accent` renders the emphasised variant Stitch uses for the one card in a row that
 * carries a policy threshold (the evaluation screen's "Confidence Floor"): a solid 2px
 * left rule. Emphasis is structural, never colour alone (NFR-ACC-3).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  tone = "default",
  accent = false,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** One line under the value — a comparison, a target, or a unit. Plain text only. */
  detail?: React.ReactNode;
  tone?: "default" | "chrome";
  accent?: boolean;
  className?: string;
  /** Extra content below `detail` — e.g. a meter bar the caller owns. */
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-sm border px-3 py-2.5",
        tone === "default" && "border-border bg-card text-card-foreground",
        tone === "chrome" && "border-chrome-border bg-chrome text-chrome-foreground",
        accent && "border-l-foreground border-l-2",
        className,
      )}
    >
      <span
        className={cn(
          "label-caps flex items-center justify-between gap-2",
          tone === "chrome" ? "text-chrome-foreground/70" : "text-muted-foreground",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        {Icon ? <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" /> : null}
      </span>
      <span className="metric text-2xl leading-none font-bold tracking-tight">{value}</span>
      {detail ? (
        <span
          className={cn(
            "text-[11px] leading-tight",
            tone === "chrome" ? "text-chrome-foreground/70" : "text-muted-foreground",
          )}
        >
          {detail}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** The row `StatCard`s sit in. A plain grid — the cards keep their own borders, unlike
 *  the dashboard's flush divided rail. */
export function StatCardRow({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Accessible name for the group, e.g. "Evaluation headline metrics". */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("grid gap-3", className)}>
      {children}
    </div>
  );
}
