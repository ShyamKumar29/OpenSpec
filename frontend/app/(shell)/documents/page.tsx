import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingTable } from "@/components/state/loading";
import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Corpus browser, parse/binding status, unbound records."
      />
      <PageContainer>
        {/* DocumentsView reads useSearchParams — same Suspense requirement as /catalog. */}
        <Suspense fallback={<LoadingTable rows={8} columns={6} />}>
          <DocumentsView />
        </Suspense>
      </PageContainer>
    </>
  );
}
