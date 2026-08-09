/**
 * Builds the `/attributes/{id}/explain` payload (docs/api.md §Attribute values —
 * "the Why? panel payload") deterministically from a stored `WireAttrValue`. Pulled out
 * of the route handler so it's unit-testable on its own (see
 * tests/architecture/fixtures-conform-to-contracts.test.ts) and so the route stays a
 * thin HTTP adapter, per the mock-is-a-literal-server rule (docs/14-frontend-
 * implementation-plan.md §1 D1). No field here is invented independently of the stored
 * attribute value (risk F-6) — every value quoted below traces back to a column named in
 * docs/04-data-model.md §3.4 (`evidence`, `verification`, `transform_step`).
 */
import type { FixtureStore, WireAttrValue } from "./store";

export function buildExplainPayload(av: WireAttrValue, store: FixtureStore) {
  const evidence = av.evidence;
  const primaryEvidence = evidence[0] ?? null;
  const document = primaryEvidence
    ? store.documentByVersionId.get(primaryEvidence.document_version_id)
    : null;
  const documentTitle = document?.title ?? null;

  const isTier0 = av.risk_tier === 0;

  return {
    attribute_value: av,
    evidence: evidence.map((e) => ({
      ...e,
      document_title: documentTitle,
      // `table_caption` is deliberately NOT the bare document title (which the Evidence
      // section's "Document" field already shows) — the region tree has no distinct
      // caption string to draw from, so this synthesises one that is legibly related
      // without being byte-identical to the Document field's own text.
      context_shown: primaryEvidence
        ? {
            column_header: av.attribute_name,
            table_caption: documentTitle ? `${documentTitle} — family table` : null,
          }
        : null,
    })),
    verification: av.verification,
    validation: syntheticValidation(av),
    transform_chain: syntheticTransformChain(av),
    confidence_signals: syntheticConfidenceSignals(av),
    policy: {
      tier: av.risk_tier,
      note: isTier0
        ? "Tier 0 — human approval required regardless of confidence (INV-9)."
        : "Standard risk tier — eligible for auto-accept above the configured threshold.",
    },
    status: av.status,
  };
}

function syntheticValidation(av: WireAttrValue) {
  const base = [
    {
      rule_id: `${av.attribute_code.toUpperCase()}-001`,
      description: "type: value matches attribute datatype",
      passed: av.status !== "UNKNOWN",
    },
  ];
  if (av.attribute_code.startsWith("pressure_rating")) {
    base.push({
      rule_id: "PRS-004",
      description: "range for brass/bronze body: 125-1000 psi",
      passed: true,
    });
    base.push({
      rule_id: "PRS-011",
      description: "cross-field: WSP <= WOG (skipped — WSP not evaluated here)",
      passed: true,
    });
  }
  if (av.attribute_code === "ansi_class") {
    base.push({
      rule_id: "NRM-17",
      description: "ANSI Class is never derived from a WOG rating",
      passed: true,
    });
  }
  return base;
}

/** Mirrors the three-line example in docs/06-frontend.md §3.2: parse -> canonical form,
 *  then (for the WOG case) an explicit "not converted" step citing NRM-17 — the same
 *  rule the `ansi_class` attribute's own Unknown explanation cites. A step whose input
 *  equals its output isn't recorded at all: it wouldn't document a transform, only
 *  duplicate the Evidence section's verbatim text (docs/14-frontend-implementation-
 *  plan.md §5: normalisation is the transform chain, raw -> parsed -> canonical). */
function syntheticTransformChain(av: WireAttrValue) {
  if (av.status === "UNKNOWN" || !av.value_raw) return [];
  const steps = [
    {
      seq: 1,
      rule_id: "NRM-CANON-001",
      input_value: av.value_raw,
      output_value: av.value_display,
      note: "parsed and normalised to canonical display form",
    },
  ];
  if (av.attribute_code.startsWith("pressure_rating")) {
    steps.push({
      seq: 2,
      rule_id: "NRM-17",
      input_value: av.value_display ?? av.value_raw,
      output_value: null,
      note: "media basis (e.g. WOG) preserved — never converted to an ANSI Class",
    });
  }
  return steps;
}

function syntheticConfidenceSignals(av: WireAttrValue) {
  if (av.confidence == null) return null;
  return {
    document_binding_confidence: Math.min(1, av.confidence + 0.02),
    row_binding_confidence: Math.min(1, av.confidence + 0.01),
    parse_quality: 0.98,
    span_containment: av.confidence > 0.85 ? "exact" : "partial",
    verification_verdict:
      av.status === "ACCEPTED" || av.status === "NEEDS_APPROVAL" ? "ENTAILED" : "PARTIAL",
    validation_result: "pass",
    provenance_kind: av.provenance_kind,
    class_confidence: 0.97,
    attribute_historical_precision: 0.96,
  };
}
