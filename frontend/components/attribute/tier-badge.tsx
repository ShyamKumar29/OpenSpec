import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/contracts/attribute-value";

/**
 * Tier 0 is visually distinct everywhere it appears — it is the attribute class that
 * can never auto-accept (INV-9). This component only ever displays a tier; the accept
 * vs. approve affordance decision lives with the review-decision UI (F5), which reads
 * `riskTier` to decide which control to render — approve is never hidden-when-tier-0,
 * it is a structurally different control.
 */
export function TierBadge({ tier, className }: { tier: RiskTier; className?: string }) {
  if (tier === 0) {
    return (
      <span
        className={cn(
          "bg-status-needs-approval-bg text-status-needs-approval inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold tracking-wide uppercase",
          className,
        )}
        title="Tier 0 — human approval required regardless of confidence (INV-9)"
      >
        <span aria-hidden="true">⚠</span> Tier 0
      </span>
    );
  }
  return <span className={cn("text-muted-foreground text-[11px]", className)}>Tier {tier}</span>;
}
