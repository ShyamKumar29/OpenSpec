"use client";

import { FolderTree, Network } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { CompletenessBar } from "@/components/attribute/completeness-bar";
import { RecordStatusBadge } from "@/components/catalog/record-status-badge";
import { ReclassifyDialog } from "./reclassify-dialog";
import { RECORD_STATUS_DESCRIPTION } from "@/lib/format/record-status";
import type { RecordDetail } from "@/lib/contracts/record";

/**
 * The left inspector column of the Stitch product-record screen: a "Taxonomy" card over
 * an enrichment-state card, both narrow, both label-over-value.
 *
 * Stitch shows UNSPSC / ECL@SS / an internal category path in the taxonomy card. OpenSpec
 * classifies against one internal taxonomy and `ClassRef` carries exactly `code`, `name`,
 * `confidence`, `provenanceKind`, and `signal` (lib/contracts/record.ts) — so this renders
 * those five and stops. Inventing external standard codes to fill the other two slots
 * would be a fabricated assertion about the record, which is the one thing this product
 * refuses to do; the card is simply shorter than the mock.
 */
export function TaxonomyPanel({ record }: { record: RecordDetail }) {
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-1.5">
            <Network className="size-3.5" aria-hidden="true" />
            Taxonomy
          </span>
        }
        as="h2"
      />
      <PanelBody className="flex flex-col gap-3">
        {record.class ? (
          <>
            <Field label="Class code">
              <span className="metric bg-muted/60 border-border block truncate rounded-sm border px-2 py-1 text-sm">
                {record.class.code}
              </span>
            </Field>
            <Field label="Class">
              <span className="flex items-start gap-1.5 text-sm">
                <FolderTree
                  className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0">{record.class.name}</span>
              </span>
            </Field>
            <Field label="Classification confidence">
              <ConfidenceIndicator
                value={record.class.confidence}
                provenance={record.class.provenanceKind}
              />
            </Field>
            <Field label="Signal">
              <span className="metric text-muted-foreground text-xs">{record.class.signal}</span>
            </Field>
          </>
        ) : (
          <p className="text-status-rejected text-sm font-medium">
            Unclassified — schema resolution is blocked until a class is assigned.
          </p>
        )}
        <ReclassifyDialog recordId={record.id} currentClassCode={record.class?.code ?? null} />
      </PanelBody>
    </Panel>
  );
}

/**
 * The counterpart to Stitch's "Enrichment Pipeline" card — a vertical, marker-led ladder
 * in the same visual form. What it lists is the record's real completeness decomposition
 * (`Completeness`: filled / accepted / pending review / unknown, plus the Tier-0 gate),
 * not a fabricated ingestion timeline: OpenSpec's `RecordDetail` carries no per-stage
 * timestamps, and a "Vision Extraction — 08:12:15" line invented to match a screenshot
 * would be a claim with no source behind it.
 */
export function EnrichmentStatePanel({ record }: { record: RecordDetail }) {
  const c = record.completeness;
  const steps: { label: string; value: string; state: "done" | "pending" | "idle" }[] = [
    {
      label: "Mandatory attributes",
      value: String(c.mandatoryTotal),
      state: c.mandatoryTotal > 0 ? "done" : "idle",
    },
    { label: "Filled", value: `${c.filled} of ${c.mandatoryTotal}`, state: "done" },
    { label: "Accepted", value: String(c.accepted), state: c.accepted > 0 ? "done" : "idle" },
    {
      label: "Pending review",
      value: String(c.pendingReview),
      state: c.pendingReview > 0 ? "pending" : "idle",
    },
    { label: "Unknown", value: String(c.unknown), state: c.unknown > 0 ? "pending" : "idle" },
    {
      label: "Tier-0 awaiting approval",
      value: String(record.tier0PendingCount),
      state: record.tier0PendingCount > 0 ? "pending" : "idle",
    },
  ];

  return (
    <Panel>
      <PanelHeader title="Enrichment state" as="h2" />
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-muted-foreground">Status</span>
          <RecordStatusBadge status={record.status} />
          <p className="text-muted-foreground text-xs leading-snug">
            {RECORD_STATUS_DESCRIPTION[record.status]}
          </p>
        </div>

        <Field label="Completeness">
          <CompletenessBar completeness={c} />
        </Field>

        {/* The marker rail: a hairline spine with a ring per step, exactly the Stitch
            pipeline card's form. The ring is filled, hollow, or muted — and every row
            still states its own number, so the rail never carries meaning alone. */}
        <ul className="border-border/70 ml-1 flex flex-col gap-2 border-l pl-3">
          {steps.map((step) => (
            <li key={step.label} className="relative flex items-center justify-between gap-2">
              <span
                aria-hidden="true"
                className={
                  step.state === "done"
                    ? "bg-status-accepted absolute -left-[17px] size-2 rounded-full"
                    : step.state === "pending"
                      ? "border-status-needs-review bg-card absolute -left-[17px] size-2 rounded-full border-2"
                      : "bg-border absolute -left-[17px] size-2 rounded-full"
                }
              />
              <span className="text-muted-foreground min-w-0 truncate text-xs">{step.label}</span>
              <span className="metric shrink-0 text-xs font-medium">{step.value}</span>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="label-caps text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
