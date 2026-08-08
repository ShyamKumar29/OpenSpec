import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG_FILTERS,
  DEFAULT_SORT,
  catalogFiltersToSearchParams,
  catalogFiltersToWireQuery,
  hasActiveCatalogFilters,
  parseCatalogFilters,
  sortDirection,
  sortField,
  toggleSort,
  type CatalogFilters,
} from "./filters";

describe("parseCatalogFilters", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseCatalogFilters(new URLSearchParams())).toEqual(DEFAULT_CATALOG_FILTERS);
  });

  it("parses every documented filter (docs/api.md GET /records)", () => {
    const params = new URLSearchParams(
      "q=ball&class_id=cls_ball_valve&status=awaiting_tier0_approval&completeness_lt=0.5&supplier=Acme&has_unknown_reason=true&sort=-mpn_raw",
    );
    expect(parseCatalogFilters(params)).toEqual({
      q: "ball",
      classCode: "cls_ball_valve",
      status: "awaiting_tier0_approval",
      completenessLt: 0.5,
      supplier: "Acme",
      hasUnknownReason: true,
      sort: "-mpn_raw",
    });
  });

  it("rejects an invalid status rather than trusting the URL", () => {
    const params = new URLSearchParams("status=not_a_real_status");
    expect(parseCatalogFilters(params).status).toBeNull();
  });

  it("rejects an invalid sort key", () => {
    const params = new URLSearchParams("sort=not_a_field");
    expect(parseCatalogFilters(params).sort).toBe(DEFAULT_SORT);
  });

  it("ignores a non-positive completeness_lt", () => {
    expect(parseCatalogFilters(new URLSearchParams("completeness_lt=0")).completenessLt).toBeNull();
    expect(
      parseCatalogFilters(new URLSearchParams("completeness_lt=-1")).completenessLt,
    ).toBeNull();
  });
});

describe("catalogFiltersToSearchParams / parseCatalogFilters round trip", () => {
  it("round-trips a fully populated filter set", () => {
    const filters: CatalogFilters = {
      q: "brass",
      classCode: "cls_ball_valve",
      status: "unknown_heavy",
      completenessLt: 0.25,
      supplier: "Meridian Flow Control",
      hasUnknownReason: true,
      sort: "unknown_count",
    };
    const roundTripped = parseCatalogFilters(catalogFiltersToSearchParams(filters));
    expect(roundTripped).toEqual(filters);
  });

  it("produces an empty query string for the default filters", () => {
    expect(catalogFiltersToSearchParams(DEFAULT_CATALOG_FILTERS).toString()).toBe("");
  });
});

describe("catalogFiltersToWireQuery", () => {
  it("maps to snake_case api.md field names, omitting unset filters", () => {
    expect(catalogFiltersToWireQuery(DEFAULT_CATALOG_FILTERS)).toEqual({
      q: undefined,
      class_id: undefined,
      status: undefined,
      completeness_lt: undefined,
      supplier: undefined,
      has_unknown_reason: undefined,
      sort: undefined,
    });
  });
});

describe("hasActiveCatalogFilters", () => {
  it("is false for the defaults and true once any filter is set", () => {
    expect(hasActiveCatalogFilters(DEFAULT_CATALOG_FILTERS)).toBe(false);
    expect(hasActiveCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, q: "x" })).toBe(true);
  });
});

describe("sort helpers", () => {
  it("splits field and direction", () => {
    expect(sortField("-mpn_raw")).toBe("mpn_raw");
    expect(sortDirection("-mpn_raw")).toBe("desc");
    expect(sortField("mpn_raw")).toBe("mpn_raw");
    expect(sortDirection("mpn_raw")).toBe("asc");
  });

  it("toggleSort switches to the new field ascending, then flips to descending", () => {
    expect(toggleSort(DEFAULT_SORT, "mpn_raw")).toBe("mpn_raw");
    expect(toggleSort("mpn_raw", "mpn_raw")).toBe("-mpn_raw");
    expect(toggleSort("-mpn_raw", "mpn_raw")).toBe("mpn_raw");
  });
});
