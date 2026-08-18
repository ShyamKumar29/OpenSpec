import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingTable } from "@/components/state/loading";
import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    // As on /catalog, the header lives inside the view so it can state the live document
    // count; the fallback renders the same header so the title never flickers.
    <Suspense fallback={<DocumentsFallback />}>
      <DocumentsView />
    </Suspense>
  );
}

function DocumentsFallback() {
  return (
    <>
      <PageHeader
        title="Document corpus"
        description="Manage, filter, and review ingested specification documents."
      />
      <PageContainer>
        <LoadingTable rows={8} columns={6} />
      </PageContainer>
    </>
  );
}
