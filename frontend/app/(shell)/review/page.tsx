import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Review Queue" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review Queue"
        description="The throughput engine — reason-code tabs, keyboard-first decisions."
      />
      <PageContainer>
        <InProgressState
          phase="F5"
          note="Queue sidebar, keyboard shortcuts, prefetch, and the throughput meter land in F5 (protected budget, per amendment A2)."
        />
      </PageContainer>
    </>
  );
}
