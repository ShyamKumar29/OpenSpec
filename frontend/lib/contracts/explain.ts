/**
 * `GET /attributes/{id}/explain` (docs/api.md §Attribute values) — the "Why?" panel
 * payload and, per that document, "the single most important endpoint in the API".
 * Every field rendered by `components/why-panel/` is traced to this contract, which is
 * traced in turn to a named column in docs/04-data-model.md §3.4 (`evidence`,
 * `verification`, `transform_step`) — risk F-6 ("Why panel invents fields").
 *
 * Reuses `evidenceWireSchema`/`adaptEvidence`, `verificationWireSchema`/
 * `adaptVerification`, and `attributeValueWireSchema`/`adaptAttributeValue` from
 * `lib/contracts/attribute-value.ts` rather than re-describing those shapes — wire
 * mapping happens exactly once per concept (docs §5).
 */
import { z } from "zod";
import {
  adaptAttributeValue,
  adaptEvidence,
  adaptVerification,
  attributeValueWireSchema,
  evidenceWireSchema,
  verificationWireSchema,
  ATTRIBUTE_VALUE_STATUSES,
  PROVENANCE_KINDS,
  type AttributeValue,
  type AttributeValueStatus,
  type Evidence,
  type ProvenanceKind,
  type RiskTier,
  type Verification,
} from "./attribute-value";

// ---- Evidence (explain variant — the core Evidence shape plus display context) -------

const explainEvidenceWireSchema = evidenceWireSchema.extend({
  document_title: z.string().nullable(),
  context_shown: z
    .object({ column_header: z.string().nullable(), table_caption: z.string().nullable() })
    .nullable(),
});
export type ExplainEvidenceWire = z.infer<typeof explainEvidenceWireSchema>;

export interface ExplainEvidence extends Evidence {
  documentTitle: string | null;
  contextShown: { columnHeader: string | null; tableCaption: string | null } | null;
}

function adaptExplainEvidence(wire: ExplainEvidenceWire): ExplainEvidence {
  return {
    ...adaptEvidence(wire),
    documentTitle: wire.document_title,
    contextShown: wire.context_shown
      ? {
          columnHeader: wire.context_shown.column_header,
          tableCaption: wire.context_shown.table_caption,
        }
      : null,
  };
}

// ---- Validation ------------------------------------------------------------------

const validationRuleWireSchema = z.object({
  rule_id: z.string(),
  description: z.string(),
  passed: z.boolean(),
});
export type ValidationRuleWire = z.infer<typeof validationRuleWireSchema>;

export interface ValidationRule {
  ruleId: string;
  description: string;
  passed: boolean;
}

function adaptValidationRule(wire: ValidationRuleWire): ValidationRule {
  return { ruleId: wire.rule_id, description: wire.description, passed: wire.passed };
}

// ---- Transform chain (normalisation) -----------------------------------------------

const transformStepWireSchema = z.object({
  seq: z.number().int(),
  rule_id: z.string(),
  input_value: z.string(),
  output_value: z.string().nullable(),
  note: z.string(),
});
export type TransformStepWire = z.infer<typeof transformStepWireSchema>;

export interface TransformStep {
  seq: number;
  ruleId: string;
  inputValue: string;
  outputValue: string | null;
  note: string;
}

function adaptTransformStep(wire: TransformStepWire): TransformStep {
  return {
    seq: wire.seq,
    ruleId: wire.rule_id,
    inputValue: wire.input_value,
    outputValue: wire.output_value,
    note: wire.note,
  };
}

// ---- Confidence signals -------------------------------------------------------------

const confidenceSignalsWireSchema = z
  .object({
    document_binding_confidence: z.number(),
    row_binding_confidence: z.number(),
    parse_quality: z.number(),
    span_containment: z.enum(["exact", "partial"]),
    verification_verdict: z.string(),
    validation_result: z.string(),
    provenance_kind: z.enum(PROVENANCE_KINDS).nullable(),
    class_confidence: z.number(),
    attribute_historical_precision: z.number(),
  })
  .nullable();
export type ConfidenceSignalsWire = z.infer<typeof confidenceSignalsWireSchema>;

export interface ConfidenceSignals {
  documentBindingConfidence: number;
  rowBindingConfidence: number;
  parseQuality: number;
  spanContainment: "exact" | "partial";
  verificationVerdict: string;
  validationResult: string;
  provenanceKind: ProvenanceKind | null;
  classConfidence: number;
  attributeHistoricalPrecision: number;
}

function adaptConfidenceSignals(wire: ConfidenceSignalsWire): ConfidenceSignals | null {
  if (!wire) return null;
  return {
    documentBindingConfidence: wire.document_binding_confidence,
    rowBindingConfidence: wire.row_binding_confidence,
    parseQuality: wire.parse_quality,
    spanContainment: wire.span_containment,
    verificationVerdict: wire.verification_verdict,
    validationResult: wire.validation_result,
    provenanceKind: wire.provenance_kind,
    classConfidence: wire.class_confidence,
    attributeHistoricalPrecision: wire.attribute_historical_precision,
  };
}

// ---- Policy -------------------------------------------------------------------------

const policyWireSchema = z.object({
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  note: z.string(),
});
export type PolicyWire = z.infer<typeof policyWireSchema>;

export interface Policy {
  tier: RiskTier;
  note: string;
}

// ---- AttributeExplain (wire + domain) ------------------------------------------------

export const attributeExplainWireSchema = z.object({
  attribute_value: attributeValueWireSchema,
  evidence: z.array(explainEvidenceWireSchema),
  verification: verificationWireSchema.nullable(),
  validation: z.array(validationRuleWireSchema),
  transform_chain: z.array(transformStepWireSchema),
  confidence_signals: confidenceSignalsWireSchema,
  policy: policyWireSchema,
  status: z.enum(ATTRIBUTE_VALUE_STATUSES),
});
export type AttributeExplainWire = z.infer<typeof attributeExplainWireSchema>;

export interface AttributeExplain {
  attributeValue: AttributeValue;
  evidence: ExplainEvidence[];
  verification: Verification | null;
  validation: ValidationRule[];
  transformChain: TransformStep[];
  confidenceSignals: ConfidenceSignals | null;
  policy: Policy;
  status: AttributeValueStatus;
}

export function adaptAttributeExplain(wireInput: unknown): AttributeExplain {
  const wire = attributeExplainWireSchema.parse(wireInput);
  return {
    attributeValue: adaptAttributeValue(wire.attribute_value),
    evidence: wire.evidence.map(adaptExplainEvidence),
    verification: wire.verification ? adaptVerification(wire.verification) : null,
    validation: wire.validation.map(adaptValidationRule),
    transformChain: wire.transform_chain.map(adaptTransformStep),
    confidenceSignals: adaptConfidenceSignals(wire.confidence_signals),
    policy: { tier: wire.policy.tier, note: wire.policy.note },
    status: wire.status,
  };
}
