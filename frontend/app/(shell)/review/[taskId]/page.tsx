import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Review Task" };

export default async function ReviewTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return (
    <>
      <PageHeader title={`Task ${taskId}`} description="Proposed value, evidence, decision bar." />
      <PageContainer>
        <InProgressState
          phase="F5"
          note="The task view, decision bar, and shared DocumentViewer land in F5."
        />
      </PageContainer>
    </>
  );
}
