import { describe, expect, it } from "vitest";
import { adaptAttributeExplain } from "./explain";

const baseAttribute = {
  code: "pressure_rating_wog",
  name: "Pressure Rating (WOG)",
  datatype: "pressure",
  risk_tier: 0 as const,
  is_mandatory: true,
};

const assertedAttributeValue = {
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
      region_id: "docver_apollo_70_100_v2024/table1/row14",
      char_start: 0,
      char_end: 7,
      snippet_text: "600 WOG",
      bbox: [312, 480, 372, 494],
    },
  ],
  verification: {
    verdict: "ENTAILED",
    deterministic_check: "exact",
    rationale: "Row 14 corresponds to catalog no. 70-104-01, matching ABC-123.",
    verifier_model: "verifier-v1",
  },
  created_at: "2026-08-07T09:12:03Z",
};

const assertedExplainWire = {
  attribute_value: assertedAttributeValue,
  evidence: [
    {
      ...assertedAttributeValue.evidence[0],
      document_title: "Apollo 70-100 Series Bronze Ball Valves",
      context_shown: {
        column_header: "Pressure Rating (WOG)",
        table_caption: "Apollo 70-100 Series",
      },
    },
  ],
  verification: assertedAttributeValue.verification,
  validation: [
    { rule_id: "PRESSURE_RATING_WOG-001", description: "type check", passed: true },
    { rule_id: "PRS-004", description: "range for brass/bronze body", passed: true },
  ],
  transform_chain: [
    {
      seq: 1,
      rule_id: "PARSE-001",
      input_value: "600 WOG",
      output_value: "600 WOG",
      note: "parsed",
    },
    {
      seq: 2,
      rule_id: "NRM-CANON-001",
      input_value: "600 WOG",
      output_value: "600 psi",
      note: "canonical",
    },
  ],
  confidence_signals: {
    document_binding_confidence: 0.98,
    row_binding_confidence: 0.98,
    parse_quality: 0.98,
    span_containment: "exact",
    verification_verdict: "ENTAILED",
    validation_result: "pass",
    provenance_kind: "EXTRACTED",
    class_confidence: 0.97,
    attribute_historical_precision: 0.96,
  },
  policy: { tier: 0, note: "Tier 0 — human approval required regardless of confidence (INV-9)." },
  status: "NEEDS_APPROVAL",
};

const unknownExplainWire = {
  attribute_value: {
    id: "av_2",
    attribute: { ...baseAttribute, code: "ansi_class", risk_tier: 1 },
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
  },
  evidence: [],
  verification: null,
  validation: [
    { rule_id: "ANSI_CLASS-001", description: "type check", passed: false },
    {
      rule_id: "NRM-17",
      description: "ANSI Class is never derived from a WOG rating",
      passed: true,
    },
  ],
  transform_chain: [],
  confidence_signals: null,
  policy: {
    tier: 1,
    note: "Standard risk tier — eligible for auto-accept above the configured threshold.",
  },
  status: "UNKNOWN",
};

describe("adaptAttributeExplain — the Why panel payload", () => {
  it("adapts a full asserted-value explain payload (evidence, verification, validation, normalisation, confidence, policy)", () => {
    const explain = adaptAttributeExplain(assertedExplainWire);

    expect(explain.attributeValue.id).toBe("av_1");
    expect(explain.evidence).toHaveLength(1);
    expect(explain.evidence[0].documentTitle).toBe("Apollo 70-100 Series Bronze Ball Valves");
    expect(explain.evidence[0].contextShown).toEqual({
      columnHeader: "Pressure Rating (WOG)",
      tableCaption: "Apollo 70-100 Series",
    });
    expect(explain.verification?.verdict).toBe("ENTAILED");
    expect(explain.validation).toHaveLength(2);
    expect(explain.validation[1].ruleId).toBe("PRS-004");
    expect(explain.transformChain).toHaveLength(2);
    expect(explain.transformChain[1].outputValue).toBe("600 psi");
    expect(explain.confidenceSignals?.documentBindingConfidence).toBe(0.98);
    expect(explain.policy).toEqual({
      tier: 0,
      note: "Tier 0 — human approval required regardless of confidence (INV-9).",
    });
    expect(explain.status).toBe("NEEDS_APPROVAL");
  });

  it("adapts an Unknown-value explain payload — no evidence/verification/confidence, but validation and policy remain (FR-EXP-3)", () => {
    const explain = adaptAttributeExplain(unknownExplainWire);

    expect(explain.attributeValue.status).toBe("UNKNOWN");
    expect(explain.evidence).toHaveLength(0);
    expect(explain.verification).toBeNull();
    expect(explain.confidenceSignals).toBeNull();
    // The NRM-17 refusal rule is present and passing — the ANSI Class demo beat.
    const nrm17 = explain.validation.find((r) => r.ruleId === "NRM-17");
    expect(nrm17).toBeTruthy();
    expect(nrm17?.passed).toBe(true);
    expect(explain.policy.tier).toBe(1);
  });

  it("throws on a wire shape that fails schema validation entirely", () => {
    expect(() => adaptAttributeExplain({ not: "a valid explain payload" })).toThrow();
  });
});
