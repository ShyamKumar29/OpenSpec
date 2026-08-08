import { describe, expect, it } from "vitest";
import { adaptAttributeValue, isUnknownValue } from "./attribute-value";

const baseAttribute = {
  code: "pressure_rating_wog",
  name: "Pressure Rating (WOG)",
  datatype: "pressure",
  risk_tier: 0 as const,
  is_mandatory: true,
};

const validAsserted = {
  id: "av_1",
  attribute: baseAttribute,
  status: "NEEDS_APPROVAL",
  value_display: "600 psi",
  value_canonical: { magnitude: 600, unit: "psi", media: "WOG" },
  value_raw: "600 WOG",
  unknown_reason: null,
  provenance_kind: "EXTRACTED",
  confidence: 0.97,
  evidence: [
    {
      document_version_id: "doc_1",
      page: 2,
      region_id: "table:1/row:14",
      char_start: 0,
      char_end: 7,
      snippet_text: "600 WOG",
      bbox: [312, 480, 372, 494],
    },
  ],
  verification: {
    verdict: "ENTAILED",
    deterministic_check: "exact",
    rationale: "matches",
    verifier_model: "v1",
  },
  created_at: "2026-08-07T09:12:03Z",
};

const validUnknown = {
  id: "av_2",
  attribute: { ...baseAttribute, code: "ansi_class" },
  status: "UNKNOWN",
  value_display: null,
  value_canonical: null,
  value_raw: null,
  unknown_reason: "ATTRIBUTE_NOT_IN_DOCUMENT",
  provenance_kind: null,
  confidence: null,
  evidence: [],
  verification: null,
  created_at: "2026-08-07T09:12:03Z",
};

describe("adaptAttributeValue — INV-1 / INV-4 as a type-level guard", () => {
  it("adapts a valid asserted value into the AttributeValueAsserted shape", () => {
    const value = adaptAttributeValue(validAsserted);
    expect(isUnknownValue(value)).toBe(false);
    if (!isUnknownValue(value)) {
      expect(value.evidence.length).toBeGreaterThan(0);
      expect(value.confidence).toBe(0.97);
    }
  });

  it("adapts a valid Unknown value into the AttributeValueUnknown shape", () => {
    const value = adaptAttributeValue(validUnknown);
    expect(isUnknownValue(value)).toBe(true);
    if (isUnknownValue(value)) {
      expect(value.unknownReason).toBe("ATTRIBUTE_NOT_IN_DOCUMENT");
    }
  });

  it("INV-1: throws when a non-UNKNOWN status has no evidence", () => {
    const invalid = { ...validAsserted, evidence: [] };
    expect(() => adaptAttributeValue(invalid)).toThrow(/INV-1/);
  });

  it("INV-4: throws when status is UNKNOWN but unknown_reason is null", () => {
    const invalid = { ...validUnknown, unknown_reason: null };
    expect(() => adaptAttributeValue(invalid)).toThrow(/INV-4/);
  });

  it("throws on a wire shape that fails schema validation entirely", () => {
    expect(() => adaptAttributeValue({ not: "a valid attribute value" })).toThrow();
  });
});
