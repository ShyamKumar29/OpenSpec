import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingTable } from "@/components/state/loading";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    // The header lives inside `CatalogView` rather than here, because the Stitch catalog
    // screen states the live record count directly under the title and pins Sort/Export
    // beside it — all three of which are client-side state. The Suspense fallback below
    // renders the same header so the title does not appear, vanish, and reappear.
    <Suspense fallback={<CatalogFallback />}>
      <CatalogView />
    </Suspense>
  );
}

function CatalogFallback() {
  return (
    <>
      <PageHeader title="Catalog" description="Searchable, filterable record list." />
      <PageContainer>
        <LoadingTable rows={10} columns={7} />
      </PageContainer>
    </>
  );
}
