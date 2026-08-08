import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingTable } from "@/components/state/loading";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Catalog"
        description="Searchable, filterable record list with completeness."
      />
      <PageContainer>
        {/* CatalogView reads useSearchParams — Next.js requires a Suspense boundary
         *  around any Client Component hook that opts out of static prerendering
         *  (node_modules/next/dist/docs/.../use-search-params.md). */}
        <Suspense fallback={<LoadingTable rows={10} columns={7} />}>
          <CatalogView />
        </Suspense>
      </PageContainer>
    </>
  );
}
