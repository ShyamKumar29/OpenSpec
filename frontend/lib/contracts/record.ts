/**
 * Catalog records (docs/api.md §Records). The list-item shape (`RecordSummary`) isn't
 * shown verbatim in api.md — it's inferred from the documented filters and from the
 * catalog columns in docs/14-frontend-implementation-plan.md §F1 ("MPN · description ·
 * class + classification confidence · completeness bar · status mix · Tier-0 pending ·
 * Unknown count"). It is additive within the existing `GET /records` endpoint (D2 is
 * about routes, not every field of every response), not a new route.
 */
import { z } from "zod";
import { adaptDocumentBinding, documentBindingWireSchema } from "./document";
import { adaptAttributeValue, attributeValueWireSchema } from "./attribute-value";
import type { DocumentBinding } from "./document";
import type { AttributeValue } from "./attribute-value";

const classRefWireSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  provenance_kind: z.enum(["EXTRACTED", "DERIVED", "INFERRED", "HUMAN"]),
  signal: z.string(),
});
export type ClassRefWire = z.infer<typeof classRefWireSchema>;

export interface ClassRef {
  id: string;
  code: string;
  name: string;
  confidence: number;
  provenanceKind: "EXTRACTED" | "DERIVED" | "INFERRED" | "HUMAN";
  signal: string;
}

function adaptClassRef(wire: ClassRefWire | null): ClassRef | null {
  if (!wire) return null;
  return {
    id: wire.id,
    code: wire.code,
    name: wire.name,
    confidence: wire.confidence,
    provenanceKind: wire.provenance_kind,
    signal: wire.signal,
  };
}

const completenessWireSchema = z.object({
  mandatory_total: z.number().int().nonnegative(),
  filled: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  pending_review: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type CompletenessWire = z.infer<typeof completenessWireSchema>;

export interface Completeness {
  mandatoryTotal: number;
  filled: number;
  accepted: number;
  pendingReview: number;
  unknown: number;
}

function adaptCompleteness(wire: CompletenessWire): Completeness {
  return {
    mandatoryTotal: wire.mandatory_total,
    filled: wire.filled,
    accepted: wire.accepted,
    pendingReview: wire.pending_review,
    unknown: wire.unknown,
  };
}

export const RECORD_STATUSES = [
  "healthy",
  "incomplete",
  "partially_enriched",
  "awaiting_tier0_approval",
  "unknown_heavy",
  "class_unresolved",
  "unbound",
  "conflicting_sources",
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const recordSummaryWireSchema = z.object({
  id: z.string(),
  mpn_raw: z.string(),
  description_raw: z.string(),
  supplier_name: z.string().nullable(),
  status: z.enum(RECORD_STATUSES),
  class: classRefWireSchema.nullable(),
  completeness: completenessWireSchema,
  tier0_pending_count: z.number().int().nonnegative(),
  unknown_count: z.number().int().nonnegative(),
  has_document: z.boolean(),
  created_at: z.string(),
});
export type RecordSummaryWire = z.infer<typeof recordSummaryWireSchema>;

export interface RecordSummary {
  id: string;
  mpnRaw: string;
  descriptionRaw: string;
  supplierName: string | null;
  status: RecordStatus;
  class: ClassRef | null;
  completeness: Completeness;
  tier0PendingCount: number;
  unknownCount: number;
  hasDocument: boolean;
  createdAt: string;
}

export function adaptRecordSummary(wireInput: unknown): RecordSummary {
  const wire = recordSummaryWireSchema.parse(wireInput);
  return {
    id: wire.id,
    mpnRaw: wire.mpn_raw,
    descriptionRaw: wire.description_raw,
    supplierName: wire.supplier_name,
    status: wire.status,
    class: adaptClassRef(wire.class),
    completeness: adaptCompleteness(wire.completeness),
    tier0PendingCount: wire.tier0_pending_count,
    unknownCount: wire.unknown_count,
    hasDocument: wire.has_document,
    createdAt: wire.created_at,
  };
}

export const recordDetailWireSchema = recordSummaryWireSchema.extend({
  bindings: z.array(documentBindingWireSchema),
  attributes: z.array(attributeValueWireSchema),
});
export type RecordDetailWire = z.infer<typeof recordDetailWireSchema>;

export interface RecordDetail extends RecordSummary {
  bindings: DocumentBinding[];
  attributes: AttributeValue[];
}

export function adaptRecordDetail(wireInput: unknown): RecordDetail {
  const wire = recordDetailWireSchema.parse(wireInput);
  return {
    ...adaptRecordSummary(wire),
    bindings: wire.bindings.map(adaptDocumentBinding),
    attributes: wire.attributes.map(adaptAttributeValue),
  };
}
