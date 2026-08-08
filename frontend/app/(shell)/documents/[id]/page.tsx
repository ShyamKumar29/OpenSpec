import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader title={id} description="Pages, regions, bound records." />
      <PageContainer>
        <InProgressState
          phase="F2"
          note="The full DocumentViewer — the highest-risk shared component — lands in F2."
        />
      </PageContainer>
    </>
  );
}
