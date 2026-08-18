"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FacetOption {
  value: string;
  label: string;
  /** How many items in the *currently loaded* result set carry this value. Counted from
   *  real data by the caller — never a placeholder. */
  count: number;
  /** Optional status dot colour, as a CSS colour value. Always accompanied by the label
   *  and the count, so the dot is redundant reinforcement, never the sole encoding
   *  (NFR-ACC-3). */
  dotClassName?: string;
}

/**
 * A counted checkbox facet group — the Stitch corpus browser's "PARSE HEALTH" and
 * "MANUFACTURER" rails (`documents/screen.png`), where each option shows its own live
 * count and a status dot, and long lists collapse behind a "Show N more" disclosure.
 *
 * Selection is multi-value and fully controlled: this component holds no filter state,
 * matching the URL-is-the-store discipline the catalog and corpus browser already use
 * (docs/06-frontend.md §6). Each option is a real `<label>`-associated checkbox, so the
 * whole group is keyboard-operable and screen-reader-nameable without extra ARIA.
 */
export function FacetList({
  legend,
  options,
  selected,
  onChange,
  initialVisible = 6,
  className,
}: {
  legend: string;
  options: FacetOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** Options beyond this count collapse behind "Show N more". */
  initialVisible?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, options.length - initialVisible);
  const visible = expanded ? options : options.slice(0, initialVisible);

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className="label-caps text-muted-foreground mb-1">{legend}</legend>
      {visible.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className="hover:bg-accent/50 -mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) => toggle(option.value, next === true)}
              className="shrink-0"
            />
            {option.dotClassName ? (
              <span
                aria-hidden="true"
                className={cn("size-1.5 shrink-0 rounded-full", option.dotClassName)}
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="metric text-muted-foreground shrink-0 text-xs">{option.count}</span>
          </label>
        );
      })}
      {hidden > 0 ? (
        <Button
          variant="link"
          size="xs"
          className="text-muted-foreground h-auto w-fit px-0 py-0.5 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </Button>
      ) : null}
    </fieldset>
  );
}
