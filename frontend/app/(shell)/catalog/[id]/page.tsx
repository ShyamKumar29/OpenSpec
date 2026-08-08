import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Record Detail" };

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title={id}
        description="Record Detail — attributes, confidence, provenance, evidence."
      />
      <PageContainer>
        <InProgressState
          phase="F1"
          note="The attribute panel, Tier-0 gate, and ANSI-Class refusal demo beat land in F1."
        />
      </PageContainer>
    </>
  );
}
