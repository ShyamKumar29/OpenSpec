"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AttributeRow } from "@/components/attribute/attribute-row";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { groupByAttributeSection, SECTION_DEFAULT_OPEN } from "@/lib/attribute/sections";
import type { AttributeValue } from "@/lib/contracts/attribute-value";
import { cn } from "@/lib/utils";

/**
 * The attribute panel — grouped by conceptual section by default
 * (docs/06-frontend.md §3.1: Identification · Dimensional · Pressure/Temperature ·
 * Materials · Compliance), with a flat ungrouped view available. Native
 * `<details>/<summary>` for disclosure: free keyboard support (Space/Enter toggles,
 * it's in the tab order by construction) and correct semantics for screen readers
 * without a bespoke accordion primitive.
 */
export function AttributePanel({ attributes }: { attributes: AttributeValue[] }) {
  const [grouped, setGrouped] = useState(true);
  const switchId = useId();
  const sections = groupByAttributeSection(attributes);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 pb-2">
        <Label htmlFor={switchId} className="text-muted-foreground text-xs font-normal">
          Group by section
        </Label>
        <Switch id={switchId} checked={grouped} onCheckedChange={setGrouped} size="sm" />
      </div>

      {grouped ? (
        <div className="flex flex-col gap-2">
          {Array.from(sections.entries()).map(([section, items]) => (
            <details
              key={section}
              open={SECTION_DEFAULT_OPEN[section]}
              className="group border-border rounded-lg border"
            >
              <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium select-none">
                <ChevronRight
                  className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
                {section}
                <span className="metric text-muted-foreground text-xs font-normal">
                  {items.length}
                </span>
              </summary>
              <div className="border-border border-t px-3">
                {items.map((value) => (
                  <AttributeRow key={value.id} value={value} />
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className={cn("border-border rounded-lg border px-3")}>
          {attributes.map((value) => (
            <AttributeRow key={value.id} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
