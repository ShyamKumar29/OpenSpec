/**
 * The command center's operational-state summary — the instrument in the environment's
 * upper-right corner that answers "how much of the catalog is in trouble" before the
 * reader has looked at anything else.
 *
 * It owns no numbers. Every figure is a fold of the same `CommandChannel[]` the
 * visualization is drawn from (`lib/dashboard/command-center.ts`), which is itself derived
 * from `GET /metrics/catalog-health` and `GET /review/counts` — so the panel and the
 * picture can never disagree, and there is no second aggregation to keep in sync.
 *
 * Counts are *items*, not alerts: "413 records need attention" is actionable in a way that
 * "7 warnings" is not.
 */
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelTone, CommandChannel } from "@/lib/dashboard/command-center";

/** Labels are one short word each: the panel is 16rem wide floating over the environment
 *  and has three columns to fit into it. The full term each one stands for is carried in
 *  `sr-only` text, so nothing is lost to a screen reader (NFR-ACC-3). */
const ROWS: {
  tone: Exclude<ChannelTone, "idle">;
  label: string;
  full: string;
  icon: LucideIcon;
  colour: string;
  href: string;
}[] = [
  {
    tone: "critical",
    label: "Critical",
    full: "Critical — verification failed or sources conflict",
    icon: OctagonAlert,
    colour: "text-status-rejected",
    href: "/review?reason_code=VERIFICATION_FAILED",
  },
  {
    tone: "attention",
    label: "Attention",
    full: "Needs attention — waiting on a reviewer",
    icon: AlertTriangle,
    colour: "text-status-needs-review",
    href: "/review",
  },
  {
    tone: "healthy",
    label: "Ready",
    full: "Commerce-ready — straight through every gate",
    icon: CheckCircle2,
    colour: "text-status-accepted",
    href: "/catalog?status=ACCEPTED",
  },
];

export function StateSummary({
  channels,
  runningCount,
  totalRuns,
  className,
}: {
  channels: CommandChannel[];
  runningCount: number;
  totalRuns: number;
  className?: string;
}) {
  const totals = ROWS.map((row) => ({
    ...row,
    value: channels.filter((c) => c.tone === row.tone).reduce((sum, c) => sum + c.value, 0),
  }));

  return (
    // Two rows, and deliberately no more. This instrument occupies the environment's
    // top-right footprint, which is a *strip*: a third row pushes it down over the Unknown
    // hotspot beneath it at narrower widths. So the run state rides in the header and each
    // state is one line — icon, count, word — rather than a stacked cell.
    <div data-testid="state-summary" className={cn("flex flex-col", className)}>
      <div className="border-border flex flex-wrap items-center justify-between gap-x-2 border-b px-2.5 py-1">
        <h2 className="label-caps label-caps-sm text-foreground/80">Operational state</h2>
        <span className="metric text-muted-foreground min-w-0 truncate text-[10px]">
          <span className="text-foreground">{runningCount}</span> of {totalRuns} runs active ·{" "}
          {runningCount > 0 ? "engine processing" : "engine idle"}
        </span>
        <Link
          href="/review"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded-sm text-[0.625rem] font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          All alerts <ArrowRight className="size-2.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="divide-border grid grid-cols-3 divide-x">
        {totals.map((row) => (
          <Link
            key={row.tone}
            href={row.href}
            data-testid={`state-summary-${row.tone}`}
            className="hover:bg-accent/50 focus-visible:ring-ring flex min-w-0 items-baseline gap-1.5 px-2 py-1.5 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            <row.icon
              className={cn("size-3 shrink-0 self-center", row.colour)}
              aria-hidden="true"
            />
            <span className="metric text-foreground text-lg leading-none font-bold">
              {row.value.toLocaleString()}
            </span>
            <span className={cn("label-caps label-caps-xs min-w-0 truncate", row.colour)}>
              {row.label}
            </span>
            <span className="sr-only">{row.full} — items</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
