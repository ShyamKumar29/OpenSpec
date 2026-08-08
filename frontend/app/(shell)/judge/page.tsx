import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Judge Mode" };

export default function JudgePage() {
  return (
    <>
      <PageHeader
        title="Judge Mode"
        description="Run any product through the full pipeline, live."
      />
      <PageContainer>
        <InProgressState
          phase="F4"
          note="The stage timeline and the three scripted scenarios (success / abstain / rejected) land in F4."
        />
      </PageContainer>
    </>
  );
}
