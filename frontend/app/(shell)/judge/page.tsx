import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { JudgeView } from "@/components/judge/judge-view";

export const metadata: Metadata = { title: "Judge Mode" };

export default function JudgePage() {
  return (
    <>
      <PageHeader
        title="Judge Mode"
        description="Run any product through the full pipeline, live."
      />
      <JudgeView />
    </>
  );
}
