import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * `/` — the operations-center dashboard (docs/14-frontend-implementation-plan.md §6 F6).
 * `DashboardView` owns its own `PageHeader`/`PageContainer` (same pattern as
 * `ReviewQueueView`) because the header carries dashboard-specific chrome (the live
 * refresh indicator) that a generic page shell shouldn't need to know about.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
