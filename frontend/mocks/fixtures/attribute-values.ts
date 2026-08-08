/**
 * AttributeValue generation — one row per record x mandatory schema attribute
 * (docs/14-frontend-implementation-plan.md §4.2: ~3,500 total, generated from records x
 * schema, never hand-typed). Every wire object produced here is later validated against
 * `attributeValueWireSchema` by tests/architecture/fixtures-conform-to-contracts.test.ts.
 */
import type { Rng } from "./rng";
import { isoDaysAgo } from "./rng";
import { TAXONOMY } from "./taxonomy";
import type { RecordSkeleton } from "./records";
import type { RecordBinding, WrongRowEvidence } from "./documents";
import { genericDisplayAndCanonical } from "./generic-values";
import { UNKNOWN_REASONS, type UnknownReason } from "@/lib/contracts/attribute-value";
import type { AttributeDefinition } from "@/lib/contracts/taxonomy";

interface Profile {
  unknownRate: number;
  reviewRate: number;
  tier0UnknownRate: number;
}

const PROFILES: Record<string, Profile> = {
  healthy: { unknownRate: 0.0, reviewRate: 0.04, tier0UnknownRate: 0.0 },
  incomplete: { unknownRate: 0.28, reviewRate: 0.1, tier0UnknownRate: 0.15 },
  partially_enriched: { unknownRate: 0.12, reviewRate: 0.38, tier0UnknownRate: 0.1 },
  awaiting_tier0_approval: { unknownRate: 0.03, reviewRate: 0.06, tier0UnknownRate: 0.0 },
  unknown_heavy: { unknownRate: 0.62, reviewRate: 0.1, tier0UnknownRate: 0.55 },
  conflicting_sources: { unknownRate: 0.1, reviewRate: 0.1, tier0UnknownRate: 0.0 },
};

const NON_TIER0_UNKNOWN_POOL: [UnknownReason, number][] = [
  ["ATTRIBUTE_NOT_IN_DOCUMENT", 0.4],
  ["AMBIGUOUS_CANDIDATES", 0.15],
  ["VALIDATION_FAILED", 0.12],
  ["NORMALIZATION_FAILED", 0.1],
  ["DOCUMENT_LOW_CONFIDENCE", 0.08],
  ["VERIFICATION_FAILED", 0.05],
  ["CONFLICTING_SOURCES", 0.05],
  ["POLICY_BLOCKED", 0.03],
  ["SYSTEM_ERROR", 0.02],
];

const TIER0_UNKNOWN_POOL: [UnknownReason, number][] = [
  ["ATTRIBUTE_NOT_IN_DOCUMENT", 0.55],
  ["BELOW_CONFIDENCE_THRESHOLD", 0.3],
  ["VALIDATION_FAILED", 0.15],
];

function pickReason(rng: Rng, pool: [UnknownReason, number][]): UnknownReason {
  return rng.weighted(
    pool.map(([r]) => r),
    pool.map(([, w]) => w),
  );
}

export interface AttributeValueContext {
  record: RecordSkeleton;
  effectiveClassIndex: number | null;
  classUnresolvedPlaceholder: boolean;
  bindings: RecordBinding[];
  documentUnparseable: boolean;
}

let counter = 0;
function nextId(recordId: string, attrCode: string): string {
  counter += 1;
  return `av_${recordId}_${attrCode}_${counter}`;
}

function buildEvidence(
  binding: RecordBinding,
  useSpecCell: boolean,
  useSizeCell: boolean,
  fallbackText: string,
) {
  const cellBbox = useSpecCell
    ? binding.specCellBbox
    : useSizeCell
      ? binding.sizeCellBbox
      : binding.rowBbox;
  const text = useSpecCell ? binding.wogDisplay : useSizeCell ? undefined : fallbackText;
  return {
    document_version_id: binding.documentVersionId,
    page: binding.page,
    region_id: binding.regionId,
    char_start: 0,
    char_end: (text ?? fallbackText).length,
    snippet_text: text ?? fallbackText,
    bbox: cellBbox,
  };
}

export function generateAttributeValues(
  rng: Rng,
  records: RecordSkeleton[],
  bindingsByRecord: Record<string, RecordBinding[]>,
  unparseableDocumentVersionId: string,
  wrongRowEvidence: WrongRowEvidence | null,
): unknown[] {
  const out: unknown[] = [];

  for (const record of records) {
    const bindings = bindingsByRecord[record.id] ?? [];
    const documentUnparseable = bindings[0]?.documentVersionId === unparseableDocumentVersionId;

    if (record.targetStatus === "class_unresolved") {
      // No resolved schema — every "attempted" attribute (borrowing the richest schema
      // as a placeholder, per FR-CLS behaviour) is Unknown(CLASS_UNRESOLVED). The
      // record's `class` stays null; this is not a guess committed to the record.
      const placeholder = TAXONOMY.find((c) => c.code === "BALL_VALVE_BRONZE")!;
      for (const attrDef of placeholder.attributes) {
        out.push(unknownValue(record, attrDef, "CLASS_UNRESOLVED"));
      }
      continue;
    }

    if (record.targetStatus === "unbound" || record.classIndex === null || bindings.length === 0) {
      const cls = TAXONOMY[record.classIndex ?? 0];
      for (const attrDef of cls.attributes) {
        out.push(unknownValue(record, attrDef, "NO_DOCUMENT_FOUND"));
      }
      continue;
    }

    if (documentUnparseable) {
      const cls = TAXONOMY[record.classIndex];
      for (const attrDef of cls.attributes) {
        out.push(unknownValue(record, attrDef, "DOCUMENT_UNPARSEABLE"));
      }
      continue;
    }

    const cls = TAXONOMY[record.classIndex];
    const profile = PROFILES[record.targetStatus] ?? PROFILES.healthy;
    const binding = bindings[0];

    for (const attrDef of cls.attributes) {
      // NRM-17: ANSI Class is never derived from WOG — our fixture documents never
      // state it, so it is always Unknown(ATTRIBUTE_NOT_IN_DOCUMENT).
      if (attrDef.code === "ansi_class") {
        out.push(unknownValue(record, attrDef, "ATTRIBUTE_NOT_IN_DOCUMENT"));
        continue;
      }

      // The F5 hero task (docs/06-frontend.md §3.3): ABC-123's proposed Seat Material
      // came from the decoy row, not the bound row — verification correctly rejects it.
      if (
        record.id === "rec_canonical_abc123" &&
        attrDef.code === "seat_material" &&
        wrongRowEvidence
      ) {
        out.push({
          id: nextId(record.id, attrDef.code),
          record_id: record.id,
          attribute_code: attrDef.code,
          attribute_name: attrDef.name,
          risk_tier: attrDef.riskTier,
          attribute: {
            code: attrDef.code,
            name: attrDef.name,
            datatype: attrDef.datatype,
            risk_tier: attrDef.riskTier,
            is_mandatory: attrDef.isMandatory,
          },
          status: "NEEDS_REVIEW",
          value_display: "PTFE",
          value_canonical: { enum: "PTFE" },
          value_raw: "PTFE",
          unknown_reason: null,
          provenance_kind: "EXTRACTED",
          confidence: 0.42,
          evidence: [
            {
              document_version_id: wrongRowEvidence.documentVersionId,
              page: wrongRowEvidence.page,
              region_id: wrongRowEvidence.regionId,
              char_start: 0,
              char_end: wrongRowEvidence.snippetText.length,
              snippet_text: wrongRowEvidence.snippetText,
              bbox: wrongRowEvidence.bbox,
            },
          ],
          verification: {
            verdict: "NOT_ENTAILED",
            deterministic_check: "fail",
            rationale:
              "Span belongs to catalog 70-106-01, not the requested 70-104-01. The proposed span came from row 15, not the bound row 14.",
            verifier_model: "verifier-v1-cached",
          },
          created_at: isoDaysAgo(2),
        });
        continue;
      }

      // The pressure attribute on a conflicting_sources record has two disagreeing
      // bindings and no evidence can be chosen automatically.
      if (
        record.targetStatus === "conflicting_sources" &&
        isSpecAttribute(attrDef.code) &&
        bindings.length > 1
      ) {
        out.push(unknownValue(record, attrDef, "CONFLICTING_SOURCES"));
        continue;
      }

      const isTier0 = attrDef.riskTier === 0;
      const unknownRoll = rng.float();
      const isUnknown = isTier0
        ? unknownRoll < profile.tier0UnknownRate
        : unknownRoll < profile.unknownRate;

      if (isUnknown) {
        const reason = pickReason(rng, isTier0 ? TIER0_UNKNOWN_POOL : NON_TIER0_UNKNOWN_POOL);
        out.push(unknownValue(record, attrDef, reason));
        continue;
      }

      const isSpecAttr = isSpecAttribute(attrDef.code);
      const isSizeAttr = attrDef.code === "nominal_size" || attrDef.code === "connection_size";
      const { display, canonical, raw } = valueFor(
        attrDef,
        record,
        binding,
        rng,
        isSpecAttr,
        isSizeAttr,
      );

      const needsReview = !isTier0 && rng.float() < profile.reviewRate;
      const status: "ACCEPTED" | "NEEDS_REVIEW" | "NEEDS_APPROVAL" = isTier0
        ? "NEEDS_APPROVAL"
        : needsReview
          ? "NEEDS_REVIEW"
          : "ACCEPTED";

      // ABC-123's WOG pressure is the canonical Tier-0 gate demo beat, cited at exactly
      // 0.97 throughout docs/06-frontend.md §3.1-3.2.
      const isCanonicalPressureBeat =
        record.id === "rec_canonical_abc123" && attrDef.code === "pressure_rating_wog";
      const confidence = isCanonicalPressureBeat
        ? 0.97
        : status === "ACCEPTED"
          ? rng.range(0.85, 0.99, 2)
          : status === "NEEDS_APPROVAL"
            ? rng.range(0.85, 0.98, 2)
            : rng.range(0.35, 0.83, 2);
      const provenanceKind =
        isSizeAttr || isSpecAttr
          ? "EXTRACTED"
          : rng.weighted(["EXTRACTED", "DERIVED", "INFERRED"], [0.75, 0.15, 0.1]);
      const verdict =
        status === "NEEDS_REVIEW" ? rng.pick(["PARTIAL", "NOT_ENTAILED"] as const) : "ENTAILED";

      const evidenceCell = buildEvidence(
        binding,
        isSpecAttr,
        isSizeAttr,
        `${attrDef.name}: ${display}`,
      );

      out.push({
        id: nextId(record.id, attrDef.code),
        record_id: record.id,
        attribute_code: attrDef.code,
        attribute_name: attrDef.name,
        risk_tier: attrDef.riskTier,
        attribute: {
          code: attrDef.code,
          name: attrDef.name,
          datatype: attrDef.datatype,
          risk_tier: attrDef.riskTier,
          is_mandatory: attrDef.isMandatory,
        },
        status,
        value_display: display,
        value_canonical: canonical,
        value_raw: raw,
        unknown_reason: null,
        provenance_kind: provenanceKind,
        confidence,
        evidence: [evidenceCell],
        verification: {
          verdict,
          deterministic_check: isSpecAttr || isSizeAttr ? "exact" : "normalised",
          rationale: verificationRationale(record, binding, attrDef, verdict),
          verifier_model: "verifier-v1-cached",
        },
        created_at: isoDaysAgo(rng.int(0, 10)),
      });
    }
  }

  ensureAllUnknownReasonsCovered(rng, out);
  injectSupersessionChains(rng, out);
  return out;
}

/** Extracted-then-human-corrected chains: at least three `SUPERSEDED` -> `HUMAN`
 *  pairs (docs/14-frontend-implementation-plan.md §4.2: "SUPERSEDED (with a visible
 *  supersession chain on at least three values)"). Previously documented but never
 *  generated — this closes that gap.
 *
 *  The "new" (current) value keeps its existing id and its position in `values`, so
 *  every other generator that already indexed it by id or by record (review-tasks,
 *  store.ts's `attrsByRecord`) sees no change beyond its own fields. The "old"
 *  (superseded) value is appended as an independently addressable entry with a new id,
 *  so `/attributes/{id}/explain` and `/attributes/{id}/history` can resolve it —
 *  exactly like every other attribute value, just with `status: "SUPERSEDED"`. It is
 *  deliberately NOT added under any record's `record_id` grouping key twist — it
 *  carries the same `record_id` as its current successor (a superseded value is still
 *  part of that record's history), and store.ts's `attrsByRecord` construction filters
 *  on `status !== "SUPERSEDED"` so completeness/counts never double-count it.
 *
 *  Never touches the canonical demo record — its fixture values are asserted verbatim
 *  in tests/architecture/fixtures-conform-to-contracts.test.ts. */
const SUPERSESSION_CHAIN_COUNT = 3;

interface SupersessionCandidate {
  id: string;
  record_id: string;
  status: string;
  value_display: string | null;
  provenance_kind: string | null;
  confidence: number | null;
  created_at: string;
  verification: { verdict: string; deterministic_check: string; rationale: string } | null;
}

function injectSupersessionChains(rng: Rng, values: unknown[]): void {
  const candidates = (values as SupersessionCandidate[]).filter(
    (v) =>
      v.status === "ACCEPTED" &&
      v.provenance_kind === "EXTRACTED" &&
      v.record_id !== "rec_canonical_abc123",
  );

  const chosen = rng
    .shuffle(candidates)
    .slice(0, Math.min(SUPERSESSION_CHAIN_COUNT, candidates.length));

  chosen.forEach((current, i) => {
    // The pre-correction (superseded) snapshot — captured before `current` is mutated
    // below, so it keeps the original extracted value, confidence, evidence, and
    // verification exactly as they were.
    const oldEntry = {
      ...current,
      id: `${current.id}_superseded_v${i + 1}`,
      status: "SUPERSEDED",
      created_at: isoDaysAgo(rng.int(15, 45)),
    };
    values.push(oldEntry);

    current.provenance_kind = "HUMAN";
    current.confidence = 1;
    current.created_at = isoDaysAgo(rng.int(0, 2));
    if (current.verification) {
      current.verification = {
        ...current.verification,
        verdict: "ENTAILED",
        deterministic_check: "exact",
        rationale: `Reviewer correction supersedes the previously extracted value ("${
          oldEntry.value_display ?? "unset"
        }") — confirmed against the same source evidence.`,
      };
    }
  });
}

function isSpecAttribute(code: string): boolean {
  return (
    code === "pressure_rating_wog" ||
    code === "pressure_rating_psi_at_73f" ||
    code === "pressure_range_max"
  );
}

function unknownValue(record: RecordSkeleton, attrDef: AttributeDefinition, reason: UnknownReason) {
  return {
    id: nextId(record.id, attrDef.code),
    // Extra, non-wire-schema fields used only for in-process grouping (store.ts,
    // review-tasks.ts) — stripped automatically when validated against
    // attributeValueWireSchema, which is `unknown`-typed here on purpose.
    record_id: record.id,
    attribute_code: attrDef.code,
    attribute_name: attrDef.name,
    risk_tier: attrDef.riskTier,
    attribute: {
      code: attrDef.code,
      name: attrDef.name,
      datatype: attrDef.datatype,
      risk_tier: attrDef.riskTier,
      is_mandatory: attrDef.isMandatory,
    },
    status: "UNKNOWN",
    value_display: null,
    value_canonical: null,
    value_raw: null,
    unknown_reason: reason,
    provenance_kind: null,
    confidence: null,
    evidence: [],
    verification: null,
    created_at: isoDaysAgo(1),
  };
}

function valueFor(
  attrDef: AttributeDefinition,
  record: RecordSkeleton,
  binding: RecordBinding,
  rng: Rng,
  isSpecAttr: boolean,
  isSizeAttr: boolean,
): { display: string; canonical: Record<string, unknown>; raw: string } {
  if (isSizeAttr) {
    return {
      display: `${record.size} in`,
      canonical: { standard: "NPS", display_form: record.size },
      raw: `${record.size}"`,
    };
  }
  if (isSpecAttr) {
    const media = attrDef.code === "pressure_rating_wog" ? "WOG" : null;
    return {
      display:
        attrDef.code === "pressure_rating_psi_at_73f"
          ? `${binding.wogValue} psi @ 73°F`
          : `${binding.wogValue} psi`,
      canonical: { magnitude: binding.wogValue, unit: "psi", media },
      raw: binding.wogDisplay,
    };
  }
  if (attrDef.code === "temperature_range") {
    const min = rng.int(-20, 40);
    const max = min + rng.int(80, 200);
    return {
      display: `${min}°F to ${max}°F`,
      canonical: { min, max, unit: "F" },
      raw: `${min}F-${max}F`,
    };
  }
  const generic = genericDisplayAndCanonical(attrDef, rng);
  return { display: generic.display, canonical: generic.canonical, raw: generic.display };
}

function verificationRationale(
  record: RecordSkeleton,
  binding: RecordBinding,
  attrDef: AttributeDefinition,
  verdict: string,
): string {
  if (verdict === "ENTAILED") {
    return `Row bound to catalog no. ${binding.catalogNo}, matching ${record.mpnRaw}. Cell states the ${attrDef.name.toLowerCase()} value directly.`;
  }
  if (verdict === "PARTIAL") {
    return `The cited span partially supports ${attrDef.name.toLowerCase()} but does not state units explicitly — held for review.`;
  }
  return `Span does not entail the proposed ${attrDef.name.toLowerCase()} for ${record.mpnRaw} — held for review.`;
}

/** Deterministic guarantee that all thirteen unknown_reason codes appear at least once
 *  in the fixture set, per docs/14-frontend-implementation-plan.md §4.2. */
function ensureAllUnknownReasonsCovered(rng: Rng, values: unknown[]): void {
  const seen = new Set<string>();
  for (const v of values as { status: string; unknown_reason: string | null }[]) {
    if (v.status === "UNKNOWN" && v.unknown_reason) seen.add(v.unknown_reason);
  }
  const missing = UNKNOWN_REASONS.filter((r) => !seen.has(r));
  if (missing.length === 0) return;

  const eligible = (values as { status: string; unknown_reason: string | null }[]).filter(
    (v) => v.status === "UNKNOWN" && v.unknown_reason === "ATTRIBUTE_NOT_IN_DOCUMENT",
  );
  const shuffled = rng.shuffle(eligible);
  missing.forEach((reason, i) => {
    const target = shuffled[i % shuffled.length] as { unknown_reason: string };
    target.unknown_reason = reason;
  });
}
