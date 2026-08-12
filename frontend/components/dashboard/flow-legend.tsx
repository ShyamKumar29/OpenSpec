import { AlertTriangle, CheckCircle2, Circle, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChannelTone } from "@/lib/dashboard/command-center";

/**
 * The command center's data-flow key.
 *
 * The environment encodes operational severity as beam colour, and NFR-ACC-3 does not
 * allow colour to carry a meaning on its own — every beam already lands on a node that
 * names itself in text with a tone icon, and this strip is the other half of that
 * contract: it states, once and in the open, what each of the four flows *is*. The four
 * tones are exactly `ChannelTone`, so the key cannot drift from the thing it explains.
 *
 * It reports no numbers. Nothing here is data; it is the legend for the data.
 */
const ENTRIES: { tone: ChannelTone; label: string; icon: LucideIcon; colour: string }[] = [
  { tone: "healthy", label: "Healthy", icon: CheckCircle2, colour: "var(--env-healthy)" },
  { tone: "attention", label: "Attention", icon: AlertTriangle, colour: "var(--env-attention)" },
  { tone: "critical", label: "Critical", icon: OctagonAlert, colour: "var(--env-critical)" },
  { tone: "idle", label: "Idle", icon: Circle, colour: "var(--env-idle)" },
];

export function FlowLegend() {
  return (
    <div
      data-testid="flow-legend"
      className="shadow-elevation-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-sm border border-[var(--env-panel-border)] bg-[var(--env-panel)] px-2.5 py-1.5"
    >
      <span className="label-caps label-caps-xs text-[var(--env-ink-dim)]">Data flow</span>
      {ENTRIES.map(({ tone, label, icon: Icon, colour }) => (
        <span key={tone} className="flex items-center gap-1">
          <Icon className="size-2.5 shrink-0" aria-hidden="true" style={{ color: colour }} />
          <span className="label-caps label-caps-xs text-[var(--env-ink)]">{label}</span>
        </span>
      ))}
    </div>
  );
}
