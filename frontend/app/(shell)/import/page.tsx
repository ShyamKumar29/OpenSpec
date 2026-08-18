import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { ImportView } from "@/components/import/import-view";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import"
        description="Ingest catalog records for enrichment — upload, column mapping, validation preview, progress."
      />
      <PageContainer>
        <ImportView />
      </PageContainer>
    </>
  );
}
