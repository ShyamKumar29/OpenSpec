/**
 * Guard: every generated fixture object must validate against the same zod wire
 * schemas the mock HTTP layer serves and the frontend parses (docs/14-frontend-
 * implementation-plan.md risk F-2/F-3). If a generator drifts from api.md's shape,
 * this fails here — not as a runtime surprise inside a component.
 */
import { describe, expect, it } from "vitest";
import { getStore, stripInternalFields } from "@/mocks/fixtures/store";
import { reviewCounts } from "@/mocks/fixtures/aggregates";
import { buildExplainPayload } from "@/mocks/fixtures/explain";
import {
  attributeValueWireSchema,
  adaptAttributeValue,
  UNKNOWN_REASONS,
} from "@/lib/contracts/attribute-value";
import { recordDetailWireSchema } from "@/lib/contracts/record";
import { documentDetailWireSchema, documentRegionWireSchema } from "@/lib/contracts/document";
import { reviewTaskWireSchema, REVIEW_REASON_CODES } from "@/lib/contracts/review";
import { attributeExplainWireSchema, adaptAttributeExplain } from "@/lib/contracts/explain";

describe("fixture universe conforms to lib/contracts", () => {
  const store = getStore();

  /** `recordDetails` deliberately omits `attributes` (mocks/fixtures/store.ts) — it's
   *  composed live from `attrsByRecordId` on every `GET /records/{id}` request so a
   *  review decision is reflected immediately. Tests that need the full `RecordDetail`
   *  shape compose it the same way the route does. */
  function fullDetail(id: string) {
    const detail = store.recordDetails.get(id);
    if (!detail) return undefined;
    return {
      ...detail,
      attributes: (store.attrsByRecordId.get(id) ?? []).map(stripInternalFields),
    };
  }

  it("every attribute value parses as attributeValueWireSchema and adapts without throwing", () => {
    for (const av of store.attributeValues) {
      const parsed = attributeValueWireSchema.parse(av);
      expect(() => adaptAttributeValue(parsed)).not.toThrow();
    }
  });

  it("every attribute value's /attributes/{id}/explain payload parses as attributeExplainWireSchema and adapts without throwing (F3, risk F-6)", () => {
    for (const av of store.attributeValues) {
      const payload = buildExplainPayload(av, store);
      const parsed = attributeExplainWireSchema.parse(payload);
      expect(() => adaptAttributeExplain(parsed)).not.toThrow();
    }
  });

  it("the canonical WOG pressure rating's explain payload carries the ANSI-Class-adjacent NRM-17 refusal on the ansi_class attribute (demo beat 4)", () => {
    const canonicalAttrs = fullDetail("rec_canonical_abc123")!.attributes as {
      id: string;
      attribute: { code: string };
    }[];
    const ansiClassId = canonicalAttrs.find((a) => a.attribute.code === "ansi_class")?.id;
    expect(ansiClassId).toBeTruthy();
    const av = store.attributeValueById.get(ansiClassId!)!;
    const payload = buildExplainPayload(av, store);
    const explain = adaptAttributeExplain(attributeExplainWireSchema.parse(payload));
    expect(explain.status).toBe("UNKNOWN");
    expect(explain.evidence).toHaveLength(0);
    expect(explain.verification).toBeNull();
    const nrm17 = explain.validation.find((r) => r.ruleId === "NRM-17");
    expect(nrm17?.passed).toBe(true);
  });

  it("every record detail parses as recordDetailWireSchema", () => {
    for (const id of store.recordDetails.keys()) {
      expect(() => recordDetailWireSchema.parse(fullDetail(id))).not.toThrow();
    }
  });

  it("every document parses as documentDetailWireSchema", () => {
    for (const doc of store.documents) {
      expect(() => documentDetailWireSchema.parse(doc)).not.toThrow();
    }
  });

  it("every document region parses as documentRegionWireSchema", () => {
    for (const regions of Object.values(store.regionsByDocument)) {
      for (const region of regions) {
        expect(() => documentRegionWireSchema.parse(region)).not.toThrow();
      }
    }
  });

  it("every review task parses as reviewTaskWireSchema", () => {
    for (const task of store.reviewTasks) {
      expect(() => reviewTaskWireSchema.parse(task)).not.toThrow();
    }
  });

  it("all thirteen unknown_reason codes appear at least once", () => {
    const seen = new Set(
      store.attributeValues.filter((a) => a.status === "UNKNOWN").map((a) => a.unknown_reason),
    );
    for (const reason of UNKNOWN_REASONS) {
      expect(seen.has(reason)).toBe(true);
    }
  });

  it("all six review reason codes carry at least one open task (queue tabs are never empty)", () => {
    const { counts } = reviewCounts();
    for (const code of REVIEW_REASON_CODES) {
      expect(counts[code]).toBeGreaterThan(0);
    }
  });

  it("review queue tab counts equal the actual open task counts (risk F-3)", () => {
    const { counts, total_open } = reviewCounts();
    const actualOpen = store.reviewTasks.filter((t) => t.state === "open");
    const actualByReason = Object.fromEntries(REVIEW_REASON_CODES.map((r) => [r, 0])) as Record<
      string,
      number
    >;
    for (const t of actualOpen) actualByReason[t.reason_code] += 1;

    expect(total_open).toBe(actualOpen.length);
    for (const code of REVIEW_REASON_CODES) {
      expect(counts[code]).toBe(actualByReason[code]);
    }
  });

  it("dashboard record count equals the actual record count", () => {
    expect(store.records.length).toBe(new Set(store.records.map((r) => r.id)).size);
  });

  it("at least three SUPERSEDED values exist, each with a visible HUMAN-provenance successor (docs/14-frontend-implementation-plan.md §4.2)", () => {
    const superseded = store.attributeValues.filter(
      (av) => (av as { status: string }).status === "SUPERSEDED",
    ) as { id: string; record_id: string; attribute_code: string; value_display: string | null }[];

    expect(superseded.length).toBeGreaterThanOrEqual(3);

    for (const old of superseded) {
      // The chain's current member: same record + attribute, still addressable, not
      // itself superseded, corrected by a human (INV-5: provenance is never upgraded by
      // the client — this is the server-side correction path, `HUMAN` is a distinct kind).
      const current = store.attributeValues.find(
        (av) =>
          (av as { record_id: string }).record_id === old.record_id &&
          (av as { attribute_code: string }).attribute_code === old.attribute_code &&
          (av as { status: string }).status !== "SUPERSEDED",
      ) as { id: string; provenance_kind: string | null } | undefined;

      expect(current, `no current successor found for superseded value ${old.id}`).toBeTruthy();
      expect(current!.id).not.toBe(old.id);
      expect(current!.provenance_kind).toBe("HUMAN");
    }
  });

  it("SUPERSEDED values never appear in a record's current attribute list (GET /records/{id})", () => {
    for (const id of store.recordDetails.keys()) {
      for (const attr of fullDetail(id)!.attributes as { status: string }[]) {
        expect(attr.status).not.toBe("SUPERSEDED");
      }
    }
  });

  it("the three canonical demo objects exist and are internally consistent", () => {
    const canonical = fullDetail("rec_canonical_abc123");
    expect(canonical).toBeTruthy();
    expect(canonical!.mpn_raw).toBe("ABC-123");

    const pressure = (
      canonical!.attributes as { attribute: { code: string }; status: string; confidence: number }[]
    ).find((a) => a.attribute.code === "pressure_rating_wog");
    expect(pressure?.status).toBe("NEEDS_APPROVAL"); // INV-9: Tier 0 never auto-accepts
    expect(pressure?.confidence).toBe(0.97);

    const ansiClass = (
      canonical!.attributes as {
        attribute: { code: string };
        status: string;
        unknown_reason: string | null;
      }[]
    ).find((a) => a.attribute.code === "ansi_class");
    expect(ansiClass?.status).toBe("UNKNOWN"); // NRM-17: never derived from WOG
    expect(ansiClass?.unknown_reason).toBe("ATTRIBUTE_NOT_IN_DOCUMENT");

    expect(store.canonicalIds.wrongRowTaskId).toBeTruthy();
    const wrongRowTask = store.reviewTasks.find((t) => t.id === store.canonicalIds.wrongRowTaskId);
    expect(wrongRowTask?.reason_code).toBe("VERIFICATION_FAILED");

    const runs = store.runs as { id: string; kind: string }[];
    const judgeIds = runs.filter((r) => r.kind === "judge").map((r) => r.id);
    expect(judgeIds.sort()).toEqual([
      "judge_run_abstain",
      "judge_run_rejected",
      "judge_run_success",
    ]);
  });
});
