import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Catalog"
        description="Searchable, filterable record list with completeness."
      />
      <PageContainer>
        <InProgressState
          phase="F1"
          note="Virtualised table, URL-driven filters, and completeness bars land in F1."
        />
      </PageContainer>
    </>
  );
}
