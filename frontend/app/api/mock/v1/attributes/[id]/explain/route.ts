import { NextRequest } from "next/server";
import { getStore, type WireAttrValue } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /attributes/{id}/explain` — the "Why?" panel payload (docs/api.md
 *  §Attribute values): evidence, verification, validation results, transform chain,
 *  confidence signal breakdown, policy note. Synthesised deterministically from the
 *  stored attribute value — no field here is invented independently of it (risk F-6).
 *  The full panel is built in F3; this establishes the payload shape now. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "explain");
  const { id } = await params;
  const store = getStore();
  const av = store.attributeValueById.get(id);
  if (!av) return notFound(request, "AttributeValue", id);

  const evidence = av.evidence;
  const primaryEvidence = evidence[0] ?? null;
  const document = primaryEvidence
    ? store.documentByVersionId.get(primaryEvidence.document_version_id)
    : null;
  const documentTitle = document?.title ?? null;

  const isTier0 = av.risk_tier === 0;
  const status = av.status;

  return jsonResponse(request, {
    attribute_value: av,
    evidence: evidence.map((e) => ({
      ...e,
      document_title: documentTitle,
      context_shown: primaryEvidence
        ? { column_header: av.attribute_name, table_caption: documentTitle }
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
    status,
  });
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

function syntheticTransformChain(av: WireAttrValue) {
  if (av.status === "UNKNOWN" || !av.value_raw) return [];
  return [
    {
      seq: 1,
      rule_id: "PARSE-001",
      input_value: av.value_raw,
      output_value: av.value_raw,
      note: "parsed from verbatim span",
    },
    {
      seq: 2,
      rule_id: "NRM-CANON-001",
      input_value: av.value_raw,
      output_value: av.value_display,
      note: "normalised to canonical display form",
    },
  ];
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
