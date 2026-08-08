"use client";

/**
 * The `[why?]` affordance on every asserted `AttributeRow` (docs/06-frontend.md §3.1,
 * §4: "AttributeRow composes … · [why?] as separate concepts"). This is deliberately
 * NOT the full Why panel (docs/06-frontend.md §3.2) — that is built in F2/F3 against
 * `GET /attributes/{id}/explain` (Validation, Normalisation, and the full confidence
 * signal vector all come from that payload). F1 renders only what the record's own
 * `AttributeValue` already carries on the wire (evidence + verification, per api.md's
 * core DTO) — a citation, not the spatial highlight. The document pane placeholder says
 * so explicitly so nobody mistakes this popover for the finished panel.
 */
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SnippetText } from "./snippet-text";
import { ConfidenceIndicator } from "./confidence-indicator";
import { useDocumentQuery } from "@/lib/queries/documents";
import type { AttributeValueAsserted, Verification } from "@/lib/contracts/attribute-value";
import { cn } from "@/lib/utils";

const VERDICT_GLYPH: Record<Verification["verdict"], { glyph: string; tone: string }> = {
  ENTAILED: { glyph: "✓", tone: "text-status-accepted" },
  PARTIAL: { glyph: "◐", tone: "text-status-needs-review" },
  NOT_ENTAILED: { glyph: "✕", tone: "text-status-rejected" },
};

export function EvidencePopover({ value }: { value: AttributeValueAsserted }) {
  const [open, setOpen] = useState(false);
  const primary = value.evidence[0];
  const document = useDocumentQuery(open ? primary.documentVersionId : null);
  const extraCitations = value.evidence.length - 1;
  const verdict = VERDICT_GLYPH[value.verification.verdict];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="link"
            size="xs"
            className="text-muted-foreground hover:text-foreground h-auto px-0 text-xs font-normal"
          />
        }
      >
        [why?]
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle>{value.attribute.name}</PopoverTitle>
        </PopoverHeader>

        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Evidence
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Document</dt>
            <dd className="truncate">
              {document.isLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : document.data ? (
                <SnippetText text={document.data.title} />
              ) : (
                <span className="text-muted-foreground">Unavailable</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Page</dt>
            <dd className="metric">{primary.page}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="metric">{primary.regionId}</dd>
            <dt className="text-muted-foreground">Verbatim</dt>
            <dd>
              <SnippetText text={primary.snippetText} className="font-mono" />
            </dd>
          </dl>
          {extraCitations > 0 ? (
            <p className="text-muted-foreground text-[11px]">
              +{extraCitations} more citation{extraCitations === 1 ? "" : "s"}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Verification
          </h3>
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", verdict.tone)}>
            <span aria-hidden="true">{verdict.glyph}</span>
            {value.verification.verdict}
            <span className="text-muted-foreground font-normal">
              · {value.verification.deterministicCheck} match
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            <SnippetText text={value.verification.rationale} />
          </p>
        </section>

        <section className="flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground text-xs">Confidence</span>
          <ConfidenceIndicator value={value.confidence} provenance={value.provenanceKind} />
        </section>

        <p className="text-muted-foreground border-t pt-2 text-[11px]">
          The full Why panel — validation rules, the normalisation chain, and the spatial evidence
          highlight — arrives with the document viewer.
        </p>
      </PopoverContent>
    </Popover>
  );
}
