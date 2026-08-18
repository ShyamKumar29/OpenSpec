"use client";

import { useId, useState } from "react";
import { ChevronRight, Ruler } from "lucide-react";
import { AttributeRow } from "@/components/attribute/attribute-row";
import { Panel, PanelHeader } from "@/components/shell/panel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { groupByAttributeSection, SECTION_DEFAULT_OPEN } from "@/lib/attribute/sections";
import { isUnknownValue, type AttributeValue } from "@/lib/contracts/attribute-value";

/**
 * The attribute panel — grouped by conceptual section by default
 * (docs/06-frontend.md §3.1: Identification · Dimensional · Pressure/Temperature ·
 * Materials · Compliance), with a flat ungrouped view available. Native
 * `<details>/<summary>` for disclosure: free keyboard support (Space/Enter toggles,
 * it's in the tab order by construction) and correct semantics for screen readers
 * without a bespoke accordion primitive.
 *
 * Framed as the Stitch product-record screen's "Technical Specifications" card: one
 * bordered panel with a titled header carrying the asserted-value count on the right and
 * the grouping control beside it, then a small-caps column strip over the rows. The rows
 * themselves are unchanged `AttributeRow`s — value, status, confidence, provenance, tier,
 * and `[why?]` stay separate concepts, which is the point of the component.
 */
export function AttributePanel({ attributes }: { attributes: AttributeValue[] }) {
  const [grouped, setGrouped] = useState(true);
  const switchId = useId();
  const sections = groupByAttributeSection(attributes);
  const asserted = attributes.filter((a) => !isUnknownValue(a)).length;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-1.5">
            <Ruler className="size-3.5" aria-hidden="true" />
            Technical specifications
          </span>
        }
        as="h2"
        actions={
          <>
            <span className="metric text-muted-foreground text-xs">
              {asserted} of {attributes.length} asserted
            </span>
            <span aria-hidden="true" className="bg-border h-4 w-px" />
            <Label htmlFor={switchId} className="text-muted-foreground text-xs font-normal">
              Group by section
            </Label>
            <Switch id={switchId} checked={grouped} onCheckedChange={setGrouped} size="sm" />
          </>
        }
      />

      {/* Column strip. Widths mirror `AttributeRow`'s own two-column split (a fixed 15rem
          name column, the rest fluid) so the captions sit over what they describe; it is
          `aria-hidden` because the rows are not a `role="table"` and announcing stray
          column names would mislead a screen reader rather than help it. */}
      <div
        aria-hidden="true"
        className="border-border text-muted-foreground bg-muted/50 hidden border-b px-3 py-1.5 sm:flex"
      >
        <span className="label-caps w-60 shrink-0">Attribute</span>
        <span className="label-caps flex-1">Value · status · confidence · provenance</span>
      </div>

      <div className="px-3 pb-1">
        {grouped ? (
          <div className="flex flex-col">
            {Array.from(sections.entries()).map(([section, items]) => (
              <details
                key={section}
                open={SECTION_DEFAULT_OPEN[section]}
                className="group border-border/60 border-b last:border-0"
              >
                <summary className="hover:bg-muted/50 -mx-3 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium select-none">
                  <ChevronRight
                    className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  {section}
                  <span className="metric text-muted-foreground text-xs font-normal">
                    {items.length}
                  </span>
                </summary>
                <div className="border-border/50 border-t pb-1">
                  {items.map((value) => (
                    <AttributeRow key={value.id} value={value} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div>
            {attributes.map((value) => (
              <AttributeRow key={value.id} value={value} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
