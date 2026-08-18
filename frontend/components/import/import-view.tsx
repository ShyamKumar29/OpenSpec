import Link from "next/link";
import { CircleDashed, ClipboardList, History, ShieldCheck, Upload } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";

/**
 * `/import` — laid out as the Stitch "Import Data" screen (a drop target over an ingestion
 * log on the left; schema validation over recent imports on the right), with one deliberate
 * and total difference: **nothing here claims to work.**
 *
 * The import endpoints exist in the mock but are explicitly stubbed —
 * `POST /records/import` acknowledges without parsing the upload, and
 * `GET /records/import/{batch_id}` returns a fixed, invented "240 rows, 3 errors" batch
 * (see app/api/mock/v1/records/import/). Wiring this screen to them would produce a
 * convincing successful import that imported nothing, and a validation report about a file
 * no one read. On a product whose entire thesis is that an unsourced value is worse than no
 * value, a fake import is not a harmless placeholder — it is the exact failure mode.
 *
 * So each pane states, in place, what it will do and what is missing: the structure and
 * density of the finished screen, with the substance honestly absent. The drop target is a
 * real `disabled` control, not a live-looking one that silently swallows files.
 */
export function ImportView() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <PanelHeader
            title="Source files"
            as="h2"
            actions={<UnavailableChip>Upload not connected</UnavailableChip>}
          />
          <PanelBody>
            <div className="border-border flex flex-col items-center gap-3 border border-dashed px-6 py-10 text-center">
              <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                <Upload className="text-muted-foreground size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-foreground font-heading text-base font-semibold">
                  Drag &amp; drop is not wired up yet
                </p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                  The catalog import pipeline — CSV/XLSX upload, column mapping, and row-level
                  validation — lands in F6. The backing endpoint currently acknowledges an upload
                  without parsing it, so this control is disabled rather than pretending to accept a
                  file.
                </p>
              </div>
              <Button size="sm" disabled>
                Browse local files
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Ingestion progress"
            as="h2"
            actions={<UnavailableChip>No batch</UnavailableChip>}
          />
          <PanelBody>
            <PendingNote
              icon={CircleDashed}
              title="No import batch to report on"
              body="Once upload is connected, this pane streams the batch's live row counts, the per-row validation outcome, and a downloadable error report for the rows that failed — the same run-narration treatment Judge Mode and the Run Monitor already use."
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Schema validation
              </span>
            }
            as="h2"
          />
          <PanelBody>
            <PendingNote
              icon={ClipboardList}
              title="Checks defined, not yet running"
              body="Import validation is specified against the same declarative rules the pipeline already uses (backend/resources/): required columns present, MPN parseable, and every row's class resolvable. Results appear here per batch — this pane stays empty until a real batch exists to judge."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                <History className="size-3.5" aria-hidden="true" />
                Recent imports
              </span>
            }
            as="h2"
          />
          <PanelBody>
            <PendingNote
              icon={History}
              title="No import history endpoint"
              body="docs/api.md defines a single batch lookup by id, not a list of past batches, so there is no history to show — an invented list of filenames and timestamps would be indistinguishable from a real one."
            />
            {/* Underlined at rest, not only on hover: a link inside a run of body text
                cannot be distinguished by colour alone (axe `link-in-text-block`, WCAG
                1.4.1). Standalone links elsewhere in the app are their own block and are
                not subject to this rule. */}
            <p className="text-muted-foreground mt-3 text-xs">
              Records that already exist are browsable in the{" "}
              <Link href="/catalog" className="text-primary underline underline-offset-2">
                catalog
              </Link>
              .
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

/** A small, unmistakable "this does not work yet" marker for a panel header. Text, not a
 *  colour or an icon alone — the whole point is that it cannot be skimmed past. */
function UnavailableChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-caps border-border text-muted-foreground bg-muted rounded-sm border px-1.5 py-0.5">
      {children}
    </span>
  );
}

function PendingNote({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden={true} />
      <div className="min-w-0">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
