import { describe, expect, it } from "vitest";
import { catalogLinkForSlice, sliceLabel } from "./slice-links";

describe("catalogLinkForSlice", () => {
  it("links a real per-class slice to the catalog filtered by that class", () => {
    expect(catalogLinkForSlice("real:ball_valve")).toBe("/catalog?class_id=BALL_VALVE_BRONZE");
    expect(catalogLinkForSlice("real:gate_globe_check")).toBe(
      "/catalog?class_id=GATE_GLOBE_CHECK_VALVE",
    );
  });

  it("returns null for a synthetic slice — it has no corresponding catalog record", () => {
    expect(catalogLinkForSlice("synthetic:injection")).toBeNull();
    expect(catalogLinkForSlice("synthetic:domain_knowledge_bait")).toBeNull();
  });

  it("returns null for an unmapped or overall slice rather than guessing a class", () => {
    expect(catalogLinkForSlice("overall")).toBeNull();
    expect(catalogLinkForSlice("real:unknown_future_class")).toBeNull();
  });
});

describe("sliceLabel", () => {
  it("strips the real:/synthetic: prefix and humanises the rest", () => {
    expect(sliceLabel("real:ball_valve")).toBe("ball valve");
    expect(sliceLabel("synthetic:domain_knowledge_bait")).toBe("domain knowledge bait");
  });

  it("passes non-prefixed slice names through, humanised", () => {
    expect(sliceLabel("overall")).toBe("overall");
  });
});
