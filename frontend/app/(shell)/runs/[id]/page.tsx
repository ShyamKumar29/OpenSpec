import type { Metadata } from "next";
import { RunMonitorView } from "@/components/runs/run-monitor-view";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunMonitorView id={id} />;
}
