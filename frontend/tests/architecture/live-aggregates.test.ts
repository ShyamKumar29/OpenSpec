/**
 * F6: record-level aggregates (completeness, status counts, tier0_pending_count,
 * unknown_count) must reconcile with the mock's *current* state after a review
 * decision, on both the catalog list and the record detail — not just at server
 * start (docs/01-requirements.md FR-DSH's acceptance criterion: "Dashboard numbers
 * reconcile with the database"; risk F-3).
 *
 * Before this fix, `mocks/fixtures/store.ts` computed these fields once in
 * `buildStore()` and froze them into a plain array (`records`) and `Map`
 * (`recordDetails`) — accept/reject/correct/approve mutate the underlying
 * `WireAttrValue` objects in place (mocks/server/review-actions.ts), but nothing ever
 * recomputed the frozen summaries, so the catalog, the record header, and every
 * dashboard tile kept reporting pre-decision numbers for the life of the dev server.
 * This test exercises the exact mutation path every review route uses
 * (`findOpenTask` + `apply*`) and asserts the live summary changes immediately.
 */
import { describe, expect, it } from "vitest";
import { getStore } from "@/mocks/fixtures/store";
import {
  findOpenTask,
  applyAccept,
  applyApprove,
  applyReject,
} from "@/mocks/server/review-actions";
import { catalogHealth } from "@/mocks/fixtures/aggregates";

function summaryFor(recordId: string) {
  const found = getStore().records.find((r) => r.id === recordId);
  if (!found) throw new Error(`no record summary for ${recordId}`);
  return found;
}

describe("record-level aggregates are live, not build-time snapshots (F6, risk F-3)", () => {
  it("the list summary and the composed record detail report the same live numbers for every record (no second, differently-stale copy)", () => {
    const store = getStore();
    for (const summary of store.records.slice(0, 25)) {
      const detail = store.recordDetails.get(summary.id)!;
      expect(detail.completeness).toEqual(summary.completeness);
      expect(detail.tier0_pending_count).toBe(summary.tier0_pending_count);
      expect(detail.unknown_count).toBe(summary.unknown_count);
      expect(detail.status).toBe(summary.status);
    }
  });

  it("accepting a proposed value increases the record's accepted count and decreases pending_review immediately", () => {
    const store = getStore();
    const task = store.reviewTasks.find(
      (t) => t.state === "open" && t.reason_code === "BELOW_THRESHOLD",
    )!;
    expect(task).toBeTruthy();

    const before = summaryFor(task.record_id);
    const lookup = findOpenTask(task.id);
    if (!lookup.ok) throw new Error(`expected an open task, got ${lookup.reason}`);
    applyAccept(lookup.task, lookup.av);

    const after = summaryFor(task.record_id);
    expect(after.completeness.accepted).toBe(before.completeness.accepted + 1);
    expect(after.completeness.pending_review).toBe(before.completeness.pending_review - 1);
    expect(after.completeness.filled).toBe(before.completeness.filled); // was already filled
    // The record-detail route must show the exact same post-decision numbers.
    expect(store.recordDetails.get(task.record_id)!.completeness).toEqual(after.completeness);
  });

  it("approving a Tier-0 task clears it from tier0_pending_count on both the list summary and the record detail", () => {
    const store = getStore();
    const task = store.reviewTasks.find(
      (t) => t.state === "open" && t.reason_code === "TIER0_APPROVAL",
    )!;
    expect(task).toBeTruthy();

    const before = summaryFor(task.record_id);
    expect(before.tier0_pending_count).toBeGreaterThan(0);

    const lookup = findOpenTask(task.id);
    if (!lookup.ok) throw new Error(`expected an open task, got ${lookup.reason}`);
    applyApprove(lookup.task, lookup.av);

    const after = summaryFor(task.record_id);
    expect(after.tier0_pending_count).toBe(before.tier0_pending_count - 1);
    expect(after.completeness.accepted).toBe(before.completeness.accepted + 1);
    expect(store.recordDetails.get(task.record_id)!.tier0_pending_count).toBe(
      after.tier0_pending_count,
    );
  });

  it("rejecting a proposed value increases unknown_count on the record summary AND the dashboard's catalog-health totals (mocks/fixtures/aggregates.ts)", () => {
    const store = getStore();
    const task = store.reviewTasks.find(
      (t) => t.state === "open" && t.reason_code === "VERIFICATION_FAILED",
    )!;
    expect(task).toBeTruthy();

    const beforeRecord = summaryFor(task.record_id);
    const beforeHealth = catalogHealth();

    const lookup = findOpenTask(task.id);
    if (!lookup.ok) throw new Error(`expected an open task, got ${lookup.reason}`);
    applyReject(lookup.task, lookup.av, "BELOW_CONFIDENCE_THRESHOLD");

    const afterRecord = summaryFor(task.record_id);
    expect(afterRecord.unknown_count).toBe(beforeRecord.unknown_count + 1);
    expect(afterRecord.completeness.filled).toBe(beforeRecord.completeness.filled - 1);

    // catalogHealth() reads store.records for its completeness distribution — this is
    // the exact aggregate F6's dashboard renders, so it must move too.
    const afterHealth = catalogHealth();
    expect(afterHealth.total_records).toBe(beforeHealth.total_records); // record count itself never changes
    const totalUnknownBefore = beforeHealth.unknown_reason_breakdown.reduce(
      (sum, r) => sum + r.count,
      0,
    );
    const totalUnknownAfter = afterHealth.unknown_reason_breakdown.reduce(
      (sum, r) => sum + r.count,
      0,
    );
    expect(totalUnknownAfter).toBe(totalUnknownBefore + 1);
  });

  it("PATCH /records/{id}/class-style mutation (writing to recordIdentities) is visible on the next read without a separate refresh step", () => {
    const store = getStore();
    const id = store.canonicalIds.record;
    const identity = store.recordIdentities.get(id)!;
    const originalClass = identity.class;

    identity.class = originalClass
      ? { ...originalClass, code: "TEST_RECLASS", provenance_kind: "HUMAN" }
      : null;

    expect(summaryFor(id).class?.code).toBe("TEST_RECLASS");
    expect(store.recordDetails.get(id)!.class?.code).toBe("TEST_RECLASS");

    identity.class = originalClass; // restore — other tests in this file read the canonical record
  });
});
