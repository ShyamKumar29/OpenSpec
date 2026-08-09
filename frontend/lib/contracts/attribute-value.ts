/**
 * `AttributeValue` — the central DTO (docs/api.md §Attribute values).
 *
 * This is where INV-1 and INV-4 become structural (docs/14-frontend-implementation-plan.md §5):
 *   - The `UNKNOWN` variant carries `unknownReason` and NO value/evidence/confidence fields.
 *   - Every other variant carries a non-empty `evidence` tuple and no `unknownReason`.
 * `adaptAttributeValue` is the only place a wire row becomes one or the other. A row
 * that violates the invariant throws here — loudly, at the boundary — rather than
 * producing a component that silently renders a valueless value (CLAUDE.md: "contract
 * violation → crash loudly").
 */
import { z } from "zod";
import type { SemanticStatus } from "@/lib/status";

export const UNKNOWN_REASONS = [
  "NO_DOCUMENT_FOUND",
  "DOCUMENT_LOW_CONFIDENCE",
  "DOCUMENT_UNPARSEABLE",
  "ATTRIBUTE_NOT_IN_DOCUMENT",
  "AMBIGUOUS_CANDIDATES",
  "VERIFICATION_FAILED",
  "VALIDATION_FAILED",
  "NORMALIZATION_FAILED",
  "BELOW_CONFIDENCE_THRESHOLD",
  "CLASS_UNRESOLVED",
  "CONFLICTING_SOURCES",
  "POLICY_BLOCKED",
  "SYSTEM_ERROR",
] as const;
export type UnknownReason = (typeof UNKNOWN_REASONS)[number];

export const PROVENANCE_KINDS = ["EXTRACTED", "DERIVED", "INFERRED", "HUMAN"] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const ATTRIBUTE_VALUE_STATUSES = [
  "ACCEPTED",
  "NEEDS_REVIEW",
  "NEEDS_APPROVAL",
  "UNKNOWN",
  "SUPERSEDED",
] as const;
export type AttributeValueStatus = (typeof ATTRIBUTE_VALUE_STATUSES)[number];

export function attributeStatusToSemantic(status: AttributeValueStatus): SemanticStatus {
  switch (status) {
    case "ACCEPTED":
      return "accepted";
    case "NEEDS_REVIEW":
      return "needs-review";
    case "NEEDS_APPROVAL":
      return "needs-approval";
    case "UNKNOWN":
      return "unknown";
    case "SUPERSEDED":
      return "superseded";
  }
}

export const RISK_TIERS = [0, 1, 2, 3] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

// ---- Evidence -------------------------------------------------------------

export const evidenceWireSchema = z.object({
  document_version_id: z.string(),
  page: z.number().int().positive(),
  region_id: z.string(),
  char_start: z.number().int().nonnegative(),
  char_end: z.number().int().nonnegative(),
  snippet_text: z.string(),
  /** [x0, y0, x1, y1] — pixel space at the document's fixed rasterisation DPI. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type EvidenceWire = z.infer<typeof evidenceWireSchema>;

export interface Evidence {
  documentVersionId: string;
  page: number;
  regionId: string;
  charStart: number;
  charEnd: number;
  snippetText: string;
  bbox: [number, number, number, number];
}

/** Exported so `lib/contracts/explain.ts` can map the `/attributes/{id}/explain`
 *  payload's evidence entries (which extend this same wire shape) without duplicating
 *  the field list — one mapping per wire concept, per docs/14-frontend-implementation-
 *  plan.md §5 ("Wire mapping ... happens exactly once"). */
export function adaptEvidence(wire: EvidenceWire): Evidence {
  return {
    documentVersionId: wire.document_version_id,
    page: wire.page,
    regionId: wire.region_id,
    charStart: wire.char_start,
    charEnd: wire.char_end,
    snippetText: wire.snippet_text,
    bbox: wire.bbox,
  };
}

// ---- Verification -----------------------------------------------------------

export const verificationWireSchema = z.object({
  verdict: z.enum(["ENTAILED", "PARTIAL", "NOT_ENTAILED"]),
  deterministic_check: z.enum(["exact", "normalised", "partial", "fail"]),
  rationale: z.string(),
  verifier_model: z.string(),
});
export type VerificationWire = z.infer<typeof verificationWireSchema>;

export interface Verification {
  verdict: "ENTAILED" | "PARTIAL" | "NOT_ENTAILED";
  deterministicCheck: "exact" | "normalised" | "partial" | "fail";
  /** The verifier model's output — the only model-authored prose anywhere in the UI. */
  rationale: string;
  verifierModel: string;
}

export function adaptVerification(wire: VerificationWire): Verification {
  return {
    verdict: wire.verdict,
    deterministicCheck: wire.deterministic_check,
    rationale: wire.rationale,
    verifierModel: wire.verifier_model,
  };
}

// ---- Attribute definition reference -----------------------------------------

const attributeRefWireSchema = z.object({
  code: z.string(),
  name: z.string(),
  datatype: z.string(),
  risk_tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  is_mandatory: z.boolean(),
});
export type AttributeRefWire = z.infer<typeof attributeRefWireSchema>;

export interface AttributeRef {
  code: string;
  name: string;
  datatype: string;
  riskTier: RiskTier;
  isMandatory: boolean;
}

function adaptAttributeRef(wire: AttributeRefWire): AttributeRef {
  return {
    code: wire.code,
    name: wire.name,
    datatype: wire.datatype,
    riskTier: wire.risk_tier,
    isMandatory: wire.is_mandatory,
  };
}

// ---- AttributeValue (wire) ---------------------------------------------------

export const attributeValueWireSchema = z.object({
  id: z.string(),
  attribute: attributeRefWireSchema,
  status: z.enum(ATTRIBUTE_VALUE_STATUSES),
  value_display: z.string().nullable(),
  value_canonical: z.record(z.string(), z.unknown()).nullable(),
  value_raw: z.string().nullable(),
  unknown_reason: z.enum(UNKNOWN_REASONS).nullable(),
  provenance_kind: z.enum(PROVENANCE_KINDS).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  evidence: z.array(evidenceWireSchema),
  verification: verificationWireSchema.nullable(),
  created_at: z.string(),
});
export type AttributeValueWire = z.infer<typeof attributeValueWireSchema>;

// ---- AttributeValue (domain, discriminated union on status) ------------------

interface AttributeValueBase {
  id: string;
  attribute: AttributeRef;
  createdAt: string;
}

export interface AttributeValueUnknown extends AttributeValueBase {
  status: "UNKNOWN";
  unknownReason: UnknownReason;
}

export interface AttributeValueAsserted extends AttributeValueBase {
  status: "ACCEPTED" | "NEEDS_REVIEW" | "NEEDS_APPROVAL" | "SUPERSEDED";
  valueDisplay: string;
  valueCanonical: Record<string, unknown> | null;
  valueRaw: string;
  provenanceKind: ProvenanceKind;
  confidence: number;
  /** Non-empty by construction — INV-1 as a TypeScript type, not a runtime hope. */
  evidence: [Evidence, ...Evidence[]];
  verification: Verification;
}

export type AttributeValue = AttributeValueUnknown | AttributeValueAsserted;

export function isUnknownValue(value: AttributeValue): value is AttributeValueUnknown {
  return value.status === "UNKNOWN";
}

/**
 * The only function permitted to turn a wire row into an `AttributeValue`. Throws on
 * any INV-1/INV-4 violation instead of returning a value a component could render
 * without evidence or an Unknown without a reason.
 */
export function adaptAttributeValue(wireInput: unknown): AttributeValue {
  const wire = attributeValueWireSchema.parse(wireInput);
  const base: AttributeValueBase = {
    id: wire.id,
    attribute: adaptAttributeRef(wire.attribute),
    createdAt: wire.created_at,
  };

  if (wire.status === "UNKNOWN") {
    if (!wire.unknown_reason) {
      throw new Error(
        `INV-4 violation: AttributeValue ${wire.id} has status UNKNOWN with no unknown_reason`,
      );
    }
    return { ...base, status: "UNKNOWN", unknownReason: wire.unknown_reason };
  }

  if (wire.evidence.length === 0) {
    throw new Error(
      `INV-1 violation: AttributeValue ${wire.id} has status ${wire.status} with no evidence`,
    );
  }
  if (
    wire.value_display == null ||
    wire.value_raw == null ||
    wire.provenance_kind == null ||
    wire.confidence == null ||
    wire.verification == null
  ) {
    throw new Error(
      `Contract violation: AttributeValue ${wire.id} (status ${wire.status}) is missing a required value field`,
    );
  }

  const [first, ...rest] = wire.evidence;
  return {
    ...base,
    status: wire.status,
    valueDisplay: wire.value_display,
    valueCanonical: wire.value_canonical,
    valueRaw: wire.value_raw,
    provenanceKind: wire.provenance_kind,
    confidence: wire.confidence,
    evidence: [adaptEvidence(first), ...rest.map(adaptEvidence)],
    verification: adaptVerification(wire.verification),
  };
}
