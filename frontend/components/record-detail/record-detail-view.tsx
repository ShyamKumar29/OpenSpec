"use client";

import { RecordHeader } from "./record-header";
import { AttributePanel } from "./attribute-panel";
import { DocumentPane } from "./document-pane";
import { EnrichmentStatePanel, TaxonomyPanel } from "./taxonomy-panel";
import { PageHeader } from "@/components/shell/page-header";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { PageContainer } from "@/components/shell/page-container";
import { usePageTitle } from "@/components/shell/page-title-context";
import { useRecordDetailQuery } from "@/lib/queries/records";

export function RecordDetailView({ id }: { id: string }) {
  const query = useRecordDetailQuery(id);
  usePageTitle(query.data ? query.data.mpnRaw : null);

  if (query.status === "pending") {
    return (
      <>
        {/* A static heading while the record loads — never a heading-less moment
         *  (docs/14-frontend-implementation-plan.md §7 DoD: "never a blank page"). */}
        <PageHeader title="Record Detail" description="Loading…" />
        <PageContainer>
          <LoadingCard />
          <div className="mt-4">
            <LoadingBlock rows={8} />
          </div>
        </PageContainer>
      </>
    );
  }

  if (query.status === "error") {
    return (
      <>
        <PageHeader title="Record Detail" />
        <PageContainer>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </PageContainer>
      </>
    );
  }

  const record = query.data;

  return (
    <>
      <RecordHeader record={record} />
      {/* Three-pane inspector, per the Stitch product-record screen: taxonomy and
          enrichment state on the left, the specification table in the middle, source
          evidence on the right.
            - below `lg` everything stacks in reading order (inspector, specs, document);
            - at `lg` the inspector takes its column and the document pane drops beneath
              the specs, which keeps the seven-field attribute rows readable at 1024px and
              preserves the documented stacking contract (docs/06-frontend.md §9);
            - at `xl` all three columns sit side by side as drawn. */}
      <div className="grid grid-cols-1 items-start gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <TaxonomyPanel record={record} />
          <EnrichmentStatePanel record={record} />
        </div>
        <AttributePanel attributes={record.attributes} />
        <div className="lg:col-start-2 xl:col-start-3 xl:row-start-1">
          <DocumentPane bindings={record.bindings} />
        </div>
      </div>
    </>
  );
}
