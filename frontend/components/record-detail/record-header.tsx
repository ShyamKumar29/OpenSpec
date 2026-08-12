import Link from "next/link";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompletenessBar } from "@/components/attribute/completeness-bar";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { RecordStatusBadge } from "@/components/catalog/record-status-badge";
import { ExportDialog } from "@/components/catalog/export-dialog";
import { EnrichButton } from "./enrich-button";
import { ReclassifyDialog } from "./reclassify-dialog";
import type { RecordDetail } from "@/lib/contracts/record";

/**
 * The header from docs/06-frontend.md §3.1: MPN, supplier, class + confidence,
 * completeness, and the Export / Re-enrich / Reclassify actions.
 */
export function RecordHeader({ record }: { record: RecordDetail }) {
  return (
    <div className="border-border flex flex-col gap-3 border-b px-4 py-4 sm:px-6">
      <Link
        href="/catalog"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        Catalog
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="label-caps text-muted-foreground">
              {record.class?.name ?? "Unclassified"}
            </span>
            <RecordStatusBadge status={record.status} />
          </div>
          {/* The Stitch product-record screen leads with the part number as a display
              title, with the description and supplier as monospaced metadata beneath. */}
          <h1 className="text-foreground font-heading text-2xl leading-tight font-bold tracking-tight sm:text-[1.75rem]">
            {record.mpnRaw}
          </h1>
          <p className="text-muted-foreground metric mt-1 text-[0.8125rem]">
            {record.descriptionRaw}
            {record.supplierName ? ` · ${record.supplierName}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ExportDialog
            triggerElement={<Button variant="outline" size="sm" />}
            triggerChildren={
              <>
                <DownloadIcon aria-hidden="true" />
                Export
              </>
            }
            filter={{ record_id: record.id }}
            description={`Export ${record.mpnRaw} as a single record.`}
          />
          <EnrichButton recordId={record.id} />
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="label-caps text-muted-foreground">Class</span>
          {record.class ? (
            <>
              <span className="text-sm font-medium">{record.class.name}</span>
              <ConfidenceIndicator
                value={record.class.confidence}
                provenance={record.class.provenanceKind}
              />
            </>
          ) : (
            <span className="text-status-rejected text-sm font-medium">Unclassified</span>
          )}
          <ReclassifyDialog recordId={record.id} currentClassCode={record.class?.code ?? null} />
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-muted-foreground">Completeness</span>
          <CompletenessBar completeness={record.completeness} />
        </div>
      </div>
    </div>
  );
}
