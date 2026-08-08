import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Evaluation" };

export default function EvaluationPage() {
  return (
    <>
      <PageHeader
        title="Evaluation"
        description="Frontier chart, calibration, per-slice metrics, ablation."
      />
      <PageContainer>
        <InProgressState
          phase="F7"
          note="Frontier chart, reliability diagram, per-slice table, and Wilson confidence intervals land in F7."
        />
      </PageContainer>
    </>
  );
}
