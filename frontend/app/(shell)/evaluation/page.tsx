import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingBlock } from "@/components/state/loading";
import { EvaluationView } from "@/components/evaluation/evaluation-view";

export const metadata: Metadata = { title: "Evaluation" };

export default function EvaluationPage() {
  return (
    // `EvaluationView` reads `useSearchParams` (the selected `?run=` id) — Next.js
    // requires a Suspense boundary around any Client Component hook that opts out of
    // static prerendering (node_modules/next/dist/docs/.../use-search-params.md),
    // same pattern as `/catalog` (app/(shell)/catalog/page.tsx).
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Evaluation"
            description="Frontier chart, calibration, per-slice metrics, ablation."
          />
          <PageContainer>
            <LoadingBlock rows={6} className="h-64" />
          </PageContainer>
        </>
      }
    >
      <EvaluationView />
    </Suspense>
  );
}
