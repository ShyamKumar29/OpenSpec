import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Corpus browser, parse/binding status, unbound records."
      />
      <PageContainer>
        <InProgressState
          phase="F2"
          note="The corpus browser and document health views land in F2, alongside DocumentViewer."
        />
      </PageContainer>
    </>
  );
}
