"use client";

import { RecordHeader } from "./record-header";
import { AttributePanel } from "./attribute-panel";
import { DocumentPane } from "./document-pane";
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
      <div className="grid grid-cols-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <AttributePanel attributes={record.attributes} />
        <DocumentPane bindings={record.bindings} />
      </div>
    </>
  );
}
