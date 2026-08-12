import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A floating operational hotspot bolted onto the command center's environment — the
 * translation of the reference composition's alert-style overlay cards into an OpenSpec
 * hotspot: a real number from the live fixture universe, never a decorative one
 * (docs/14-frontend-implementation-plan.md's F6 session brief: "driven by the existing
 * canonical fixture universe and application state"), and always a link into the page
 * that owns it, so the dashboard summarises and the detail lives where it belongs.
 *
 * `size="sm"` is the one-viewport variant: the dashboard floats five or six of these over
 * the hero and cannot spend three lines on each. It keeps the title, the number and one
 * line of context, and drops nothing that is not also reachable one click away.
 */
export function InsightCallout({
  icon: Icon,
  tone = "neutral",
  surface = "card",
  size = "md",
  title,
  value,
  description,
  meta,
  href,
  tail,
  className,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "attention" | "critical" | "positive";
  /** `"env"` is the variant that floats over the command center's dark operational
   *  ground: an opaque instrument card in the environment's own palette rather than the
   *  page's, matching the node markers it sits among. Opaque, not glass — the card can
   *  land over any part of the city and its text still has to clear 4.5:1. */
  surface?: "card" | "env";
  size?: "sm" | "md";
  title: string;
  value: string;
  description: string;
  /** An optional second, shorter line — a delta or a rate. Rendered below the
   *  description in the dim ink, and omitted entirely when absent. */
  meta?: string;
  href?: string;
  /** Which edge the leader tail leaves from, wiring the card into the environment it is
   *  reporting on. Drawn in CSS rather than in the SVG because the card is positioned
   *  against the visible frame while the scene is positioned against the viewBox — a
   *  line between the two coordinate systems would drift the moment the hero's aspect
   *  ratio changed. */
  tail?: "left" | "right";
  className?: string;
}) {
  // "Operational Callout" hazard styling (Stitch DESIGN.md §Components): a solid accent
  // border on one edge plus a tinted surface, so a critical panel cannot be missed at a
  // glance.
  const TONE_CLASSES: Record<typeof tone, string> = {
    neutral: "border-border border-l-foreground/60 bg-card/90",
    attention:
      "border-status-needs-review/40 border-l-status-needs-review bg-status-needs-review-bg/90",
    critical: "border-status-rejected/40 border-l-status-rejected bg-status-rejected-bg/90",
    positive: "border-status-accepted/40 border-l-status-accepted bg-status-accepted-bg/90",
  };
  const ENV_TONE_CLASSES: Record<typeof tone, string> = {
    neutral: "border-[var(--env-panel-border)] border-l-[var(--env-idle)]",
    attention: "border-[var(--env-panel-border)] border-l-[var(--env-attention)]",
    critical: "border-[var(--env-panel-border)] border-l-[var(--env-critical)]",
    positive: "border-[var(--env-panel-border)] border-l-[var(--env-healthy)]",
  };
  const ICON_TONE: Record<typeof tone, string> = {
    neutral: "text-muted-foreground",
    attention: "text-status-needs-review",
    critical: "text-status-rejected",
    positive: "text-status-accepted",
  };
  const ENV_ICON_TONE: Record<typeof tone, string> = {
    neutral: "text-[var(--env-idle)]",
    attention: "text-[var(--env-attention)]",
    critical: "text-[var(--env-critical)]",
    positive: "text-[var(--env-healthy)]",
  };
  const TAIL_TONE: Record<typeof tone, string> = {
    neutral: "var(--env-idle)",
    attention: "var(--env-attention)",
    critical: "var(--env-critical)",
    positive: "var(--env-healthy)",
  };
  const env = surface === "env";
  const sm = size === "sm";

  const body = (
    <div
      // When the callout links somewhere, the test id lives on the anchor instead (see
      // below) — a hotspot *is* its link, and hanging the id off the inner box would
      // make "does this callout go where it says" an awkward parent lookup.
      data-testid={href ? undefined : "insight-callout"}
      className={cn(
        "shadow-elevation-3 relative flex flex-col rounded-sm border border-l-4",
        sm ? "gap-0.5 px-2 py-1.5" : "gap-1.5 px-3 py-2.5",
        env ? cn("bg-[var(--env-panel)]", ENV_TONE_CLASSES[tone]) : TONE_CLASSES[tone],
        href && "transition-transform duration-150 hover:-translate-y-0.5",
        className,
      )}
    >
      {/* The leader tail: a dashed run of hairline with a node dot on the end, pointing
          back at the part of the environment this card is about. Decoration only — the
          fact it is reporting is in the text. */}
      {tail && env ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 hidden h-px w-5 -translate-y-1/2 lg:block xl:w-8",
            tail === "left" ? "right-full" : "left-full",
          )}
          style={{
            backgroundImage: `repeating-linear-gradient(to right, ${TAIL_TONE[tone]} 0 4px, transparent 4px 9px)`,
            opacity: 0.6,
          }}
        >
          <span
            className={cn(
              "absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full",
              tail === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
            )}
            style={{ background: TAIL_TONE[tone] }}
          />
        </span>
      ) : null}

      <span
        className={cn(
          "label-caps flex items-center gap-1.5",
          sm && "label-caps-xs",
          env ? ENV_ICON_TONE[tone] : ICON_TONE[tone],
        )}
      >
        <Icon className={cn("shrink-0", sm ? "size-3" : "size-3.5")} aria-hidden="true" />
        <span className="min-w-0 truncate">{title}</span>
        {href ? (
          <ArrowUpRight
            className={cn("ml-auto shrink-0 opacity-60", sm ? "size-2.5" : "size-3")}
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span
        className={cn(
          "metric leading-none font-bold",
          sm ? "text-xl" : "text-2xl",
          env ? "text-[var(--env-ink)]" : "text-foreground",
        )}
      >
        {value}
      </span>
      <p
        className={cn(
          "leading-snug",
          sm ? "line-clamp-2 text-[10px]" : "text-xs",
          env ? "text-[var(--env-ink-dim)]" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
      {meta ? (
        <p
          className={cn(
            "metric leading-none",
            sm ? "text-[9.5px]" : "text-[0.6875rem]",
            env ? "text-[var(--env-ink-dim)]" : "text-muted-foreground",
          )}
        >
          {meta}
        </p>
      ) : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} data-testid="insight-callout" className="block no-underline">
      {body}
    </Link>
  );
}
