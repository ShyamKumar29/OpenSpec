import {
  Activity,
  Cpu,
  Gauge,
  Lock,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { isMockApiMode } from "@/lib/api/mode";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * `/settings` — the Stitch "Configuration" screen's composition: a category rail with a
 * system-status card beneath it, and stacked configuration panels beside it.
 *
 * Everything is **read-only, and says so**. There is no admin API: docs/api.md defines no
 * endpoint that reads or writes a threshold, a tier policy, or a routing rule — that is
 * Track B. The Stitch screen draws live sliders and a "Save Configuration" button; wiring
 * those to nothing would produce a control that appears to change the auto-approval
 * threshold of a system that decides what reaches a customer's catalog. A settings screen
 * that lies about what it controls is worse than one that admits it controls nothing yet,
 * so the sliders are not reproduced and no Save button is drawn.
 *
 * What *is* shown is real: the client's own API mode and base URL, read from
 * `lib/api/mode.ts` — the same single source of truth behind the shell's demo-data badge.
 */

interface Category {
  id: string;
  label: string;
  icon: typeof Cpu;
}

const CATEGORIES: Category[] = [
  { id: "ai", label: "AI processing", icon: Cpu },
  { id: "review", label: "Review policies", icon: ShieldAlert },
  { id: "routing", label: "Operational routing", icon: Route },
  { id: "system", label: "API / system", icon: SlidersHorizontal },
];

export function SettingsView() {
  const mock = isMockApiMode();

  // The rail navigates *within* the page rather than switching one panel in and out. With
  // four short read-only panels, a filtering rail left three-quarters of the workspace
  // empty on every selection; anchoring instead gives the Stitch screen's density and lets
  // the whole configuration surface be read in one pass.
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-5">
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        <nav aria-label="Settings categories" className="flex flex-col gap-0.5">
          <p className="label-caps text-muted-foreground mb-1 px-2">Categories</p>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <a
                key={cat.id}
                href={`#settings-${cat.id}`}
                className="focus-visible:ring-ring text-muted-foreground hover:bg-accent/50 hover:text-foreground flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{cat.label}</span>
              </a>
            );
          })}
        </nav>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5" aria-hidden="true" />
                System status
              </span>
            }
            as="h2"
          />
          <PanelBody>
            <dl className="flex flex-col gap-2 text-xs">
              <StatusRow label="API mode" value={mock ? "Mock (demo data)" : "Live backend"} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="label-caps text-muted-foreground">Base URL</dt>
                <dd className="metric truncate" title={API_BASE_URL}>
                  {API_BASE_URL}
                </dd>
              </div>
              <StatusRow label="Admin API" value="Not available" />
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <ReadOnlyPanel
          id="settings-ai"
          icon={Gauge}
          title="Confidence thresholds"
          summary="Auto-accept and auto-abstain thresholds, and the per-attribute confidence floor."
          detail="Thresholds are configuration, never literals in code, and live as declarative YAML alongside the pipeline (backend/resources/). No endpoint reads or writes them, so this screen cannot show their current values without guessing — and a guessed threshold, displayed as fact, is exactly the kind of unsourced assertion this product refuses."
        />

        <ReadOnlyPanel
          id="settings-review"
          icon={ShieldAlert}
          title="Review policies"
          summary="Which attributes are Tier-0, and what a reviewer is allowed to do with them."
          detail="One policy here is not configurable at all and never will be: Tier-0 attributes — pressure, temperature, class, compliance — are never auto-accepted regardless of confidence (INV-9). That rule is enforced in the pipeline and again by the server, which refuses a Tier-0 accept with POLICY_BLOCKED. The remaining reviewer policies become editable when the admin API exists."
          invariant="INV-9 — Tier-0 never auto-accepts"
        />

        <ReadOnlyPanel
          id="settings-routing"
          icon={Route}
          title="Operational routing"
          summary="Which reviewer queue a flagged value is routed to, and at what priority."
          detail="Routing today is by reason code: every unresolved value lands in one of the six queues on the Review page, which is where its reason is already visible. Configurable per-class routing rules need both an admin API and a queue model that has owners in it; neither exists yet, so no rule table is drawn here."
        />

        <ReadOnlyPanel
          id="settings-system"
          icon={Table2}
          title="Schemas and model routing"
          summary="Attribute schemas per class, prompt versions, and which model runs which stage."
          detail="Every run already records the model ids, prompt versions, ruleset versions, and corpus hash it used (INV-10) — that provenance is visible per run in the Run Monitor. A browsable schema and routing view lands with the read-only admin surface in F7."
          invariant="INV-10 — every run records its versions"
        />
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="metric min-w-0 truncate text-right">{value}</dd>
    </div>
  );
}

function ReadOnlyPanel({
  id,
  icon: Icon,
  title,
  summary,
  detail,
  invariant,
}: {
  id: string;
  icon: typeof Cpu;
  title: string;
  summary: string;
  detail: string;
  invariant?: string;
}) {
  return (
    // `scroll-mt` clears the sticky chrome bar so an anchored panel's header is not parked
    // underneath it.
    <Panel id={id} className="scroll-mt-24">
      <PanelHeader
        title={
          <span className="flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden="true" />
            {title}
          </span>
        }
        as="h2"
        actions={
          <span className="label-caps border-border text-muted-foreground bg-muted flex items-center gap-1 rounded-sm border px-1.5 py-0.5">
            <Lock className="size-3" aria-hidden="true" />
            Read-only
          </span>
        }
      />
      <PanelBody className="flex flex-col gap-2">
        <p className="text-foreground text-sm">{summary}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{detail}</p>
        {invariant ? (
          // The Stitch "operational callout": a solid left rule over a tinted ground.
          <p className="border-l-status-needs-approval bg-status-needs-approval-bg/40 metric mt-1 border-l-2 px-3 py-2 text-xs">
            {invariant}
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
