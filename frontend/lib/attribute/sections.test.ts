import { describe, expect, it } from "vitest";
import { sectionForAttribute, groupByAttributeSection, ATTRIBUTE_SECTIONS } from "./sections";
import { TAXONOMY } from "@/mocks/fixtures/taxonomy";

describe("sectionForAttribute", () => {
  it("maps every attribute code in the real taxonomy to a real section, never the Other fallback", () => {
    const allCodes = new Set(TAXONOMY.flatMap((cls) => cls.attributes.map((a) => a.code)));
    expect(allCodes.size).toBeGreaterThan(0);
    for (const code of allCodes) {
      expect(sectionForAttribute(code)).not.toBe("Other");
    }
  });

  it("falls back to Other for an unrecognised code rather than a wrong bucket", () => {
    expect(sectionForAttribute("totally_unmapped_code")).toBe("Other");
  });
});

describe("groupByAttributeSection", () => {
  it("groups items by section in canonical order and omits empty sections", () => {
    const items = [
      { attribute: { code: "body_material" } }, // Materials
      { attribute: { code: "ansi_class" } }, // Pressure / Temperature
      { attribute: { code: "port_type" } }, // Identification
    ];
    const grouped = groupByAttributeSection(items);
    expect(Array.from(grouped.keys())).toEqual([
      "Identification",
      "Pressure / Temperature",
      "Materials",
    ]);
    expect(grouped.get("Materials")).toHaveLength(1);
  });

  it("never produces a section outside the declared set", () => {
    const items = [{ attribute: { code: "x" } }];
    const grouped = groupByAttributeSection(items);
    for (const section of grouped.keys()) {
      expect(ATTRIBUTE_SECTIONS).toContain(section);
    }
  });
});
