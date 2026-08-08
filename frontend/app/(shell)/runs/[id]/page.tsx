import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader title={`Run ${id}`} description="Live run monitor with per-stage progress." />
      <PageContainer>
        <InProgressState
          phase="F4"
          note="Reuses the stage timeline and run-event source built in F4."
        />
      </PageContainer>
    </>
  );
}
