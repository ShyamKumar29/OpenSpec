"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CATALOG_CLASS_OPTIONS } from "@/lib/catalog/class-options";
import {
  COMPLETENESS_LT_OPTIONS,
  hasActiveCatalogFilters,
  type CatalogFilters,
} from "@/lib/catalog/filters";
import { RECORD_STATUSES, type RecordStatus } from "@/lib/contracts/record";
import { RECORD_STATUS_LABEL } from "@/lib/format/record-status";

const ALL = "__all__";

const CLASS_LABELS: Record<string, string> = Object.fromEntries(
  CATALOG_CLASS_OPTIONS.map((o) => [o.code, o.name]),
);
const COMPLETENESS_LABELS: Record<string, string> = Object.fromEntries(
  COMPLETENESS_LT_OPTIONS.map((o) => [String(o.value), o.label]),
);

/**
 * Search / class / status / completeness / supplier / has-unknown-reason — mirrors
 * `GET /records` exactly (docs/api.md §Records). This component only ever calls
 * `onChange`; the URL is the actual store (`lib/catalog/filters.ts`,
 * docs/06-frontend.md §6), so it holds no filter state of its own beyond the debounce
 * buffers for the two free-text fields.
 */
export function FilterBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
}) {
  const [q, setQ] = useState(filters.q);
  const [supplier, setSupplier] = useState(filters.supplier ?? "");

  // Keep local buffers in sync when filters change from outside this component (e.g.
  // "Clear filters", browser back/forward, a facet click elsewhere on the page). Adjusted
  // during render, not in an effect — React's sanctioned pattern for "reset state when a
  // prop changes" (react-hooks/set-state-in-effect flags the effect-based version).
  const [prevFiltersQ, setPrevFiltersQ] = useState(filters.q);
  if (filters.q !== prevFiltersQ) {
    setPrevFiltersQ(filters.q);
    setQ(filters.q);
  }
  const [prevFiltersSupplier, setPrevFiltersSupplier] = useState(filters.supplier);
  if (filters.supplier !== prevFiltersSupplier) {
    setPrevFiltersSupplier(filters.supplier);
    setSupplier(filters.supplier ?? "");
  }

  useEffect(() => {
    if (q === filters.q) return;
    const timeout = setTimeout(() => onChange({ ...filters, q }), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const next = supplier || null;
    if (next === filters.supplier) return;
    const timeout = setTimeout(() => onChange({ ...filters, supplier: next }), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier]);

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <InputGroup className="w-full max-w-64">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search MPN or description…"
          aria-label="Search MPN or description"
        />
        {q ? (
          <InputGroupAddon align="inline-end">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <XIcon />
            </Button>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <FilterField label="Class">
        <Select
          value={filters.classCode ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filters, classCode: value === ALL ? null : value })
          }
        >
          <SelectTrigger aria-label="Filter by class" className="w-44">
            <SelectValue>
              {(value: string) => (value === ALL ? "All classes" : CLASS_LABELS[value])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {CATALOG_CLASS_OPTIONS.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Status">
        <Select
          value={filters.status ?? ALL}
          onValueChange={(value) =>
            onChange({
              ...filters,
              status: value === ALL ? null : (value as CatalogFilters["status"]),
            })
          }
        >
          <SelectTrigger aria-label="Filter by record status" className="w-48">
            <SelectValue>
              {(value: string) =>
                value === ALL ? "All statuses" : RECORD_STATUS_LABEL[value as RecordStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {RECORD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {RECORD_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Completeness">
        <Select
          value={filters.completenessLt !== null ? String(filters.completenessLt) : ALL}
          onValueChange={(value) =>
            onChange({ ...filters, completenessLt: value === ALL ? null : Number(value) })
          }
        >
          <SelectTrigger aria-label="Filter by completeness" className="w-40">
            <SelectValue>
              {(value: string) => (value === ALL ? "Any completeness" : COMPLETENESS_LABELS[value])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any completeness</SelectItem>
            {COMPLETENESS_LT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <InputGroup className="w-44">
        <InputGroupInput
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Supplier"
          aria-label="Filter by supplier (exact name)"
        />
        {supplier ? (
          <InputGroupAddon align="inline-end">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear supplier filter"
              onClick={() => setSupplier("")}
            >
              <XIcon />
            </Button>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <label className="flex h-8 items-center gap-2 text-sm">
        {/* base-ui's Switch is a role="switch" span with a hidden native <input> beside
         *  it (not the input itself) — a wrapping <label> associates with that hidden
         *  input, but axe's aria-toggle-field-name rule checks the role="switch"
         *  element's own accessible name, which a wrapping label doesn't supply.
         *  Explicit aria-label matching the visible text fixes it without changing the
         *  visible design. */}
        <Switch
          aria-label="Has Unknown values"
          checked={filters.hasUnknownReason}
          onCheckedChange={(checked) => onChange({ ...filters, hasUnknownReason: checked })}
          size="sm"
        />
        <span className="text-muted-foreground">Has Unknown values</span>
      </label>

      {hasActiveCatalogFilters(filters) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            setSupplier("");
            onChange({
              ...filters,
              q: "",
              classCode: null,
              status: null,
              completenessLt: null,
              supplier: null,
              hasUnknownReason: false,
            });
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-[11px] font-normal">{label}</Label>
      {children}
    </div>
  );
}
