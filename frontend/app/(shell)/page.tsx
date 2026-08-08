import type { Metadata } from "next";
import { Activity, AlertOctagon, Coins, Gauge, Grid2x2, LineChart, Timer } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoDataBadge } from "@/components/shell/demo-data-badge";

export const metadata: Metadata = { title: "Dashboard" };

const TILES = [
  {
    icon: Grid2x2,
    title: "Catalog health",
    description: "Completeness distribution across the catalog.",
    requirement: "FR-DSH-1",
  },
  {
    icon: Gauge,
    title: "Straight-through processing",
    description: "All mandatory, and auto-eligible only.",
    requirement: "QR-3 / QR-4",
  },
  {
    icon: AlertOctagon,
    title: "Unknown reason breakdown",
    description: "Routed by fix owner — Ops, Reviewer, Rules owner, Approver, Engineering.",
    requirement: "01-requirements.md §1.2",
  },
  {
    icon: Coins,
    title: "Cost per SKU",
    description: "Against a configurable manual baseline.",
    requirement: "NFR-CST-1, FR-DSH-3",
  },
  {
    icon: Timer,
    title: "Review throughput",
    description: "Vs. baseline, and workload remaining.",
    requirement: "FR-RVW-9",
  },
  {
    icon: LineChart,
    title: "Quality trend",
    description: "Across evaluation runs, real and synthetic slices labelled.",
    requirement: "FR-DSH-4",
  },
  {
    icon: Activity,
    title: "Active runs",
    description: "Live enrichment progress across in-flight batches.",
    requirement: "FR-DSH-5",
  },
];

/**
 * Dashboard credible shell (docs/14-frontend-implementation-plan.md §A3: "ships a
 * credible shell in F0, not a blank page"). Full tile computation is F6 — see the
 * `requirement` tags below, each traceable to a named FR/QR so no tile here is a vanity
 * metric (risk E4). The mock backing every tile already exists
 * (`/api/mock/v1/metrics/*`); wiring the numbers in is F6's job, not F0's.
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Catalog health, cost, throughput, and quality — at a glance."
        actions={<DemoDataBadge className="sm:hidden" />}
      />
      <PageContainer>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.map((tile) => (
            <Card key={tile.title} className="gap-3 py-4">
              <CardHeader className="gap-1 px-4">
                <div className="flex items-center gap-2">
                  <tile.icon className="text-muted-foreground size-4" aria-hidden="true" />
                  <CardTitle className="text-sm">{tile.title}</CardTitle>
                </div>
                <CardDescription>{tile.description}</CardDescription>
              </CardHeader>
              <div className="px-4">
                <div className="border-border text-muted-foreground flex h-16 items-center justify-center rounded-md border border-dashed text-xs">
                  Computed in F6 · {tile.requirement}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
