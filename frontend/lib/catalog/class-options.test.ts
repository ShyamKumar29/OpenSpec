import { describe, expect, it } from "vitest";
import { CATALOG_CLASS_OPTIONS } from "./class-options";
import { TAXONOMY } from "@/mocks/fixtures/taxonomy";

describe("CATALOG_CLASS_OPTIONS", () => {
  it("stays in sync with the fixture taxonomy's codes and names (hand-maintained closed set)", () => {
    const fixtureOptions = TAXONOMY.map((c) => ({ code: c.code, name: c.name }));
    expect(CATALOG_CLASS_OPTIONS).toEqual(fixtureOptions);
  });
});
