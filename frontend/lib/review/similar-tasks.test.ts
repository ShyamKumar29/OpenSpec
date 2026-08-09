import { describe, expect, it } from "vitest";
import { findSimilarTasks } from "./similar-tasks";
import type { ReviewTask } from "@/lib/contracts/review";

function task(overrides: Partial<ReviewTask>): ReviewTask {
  return {
    id: "task_1",
    recordId: "rec_1",
    recordMpn: "ABC-123",
    recordDescription: "1/2 BRS BALL VLV 600WOG",
    attributeValueId: "av_1",
    attributeCode: "seat_material",
    attributeName: "Seat Material",
    riskTier: 1,
    reasonCode: "VERIFICATION_FAILED",
    state: "open",
    priority: 0,
    assignedTo: null,
    proposedValue: null,
    rejectionReason: null,
    documentVersionId: "docver_1",
    page: 2,
    similarTaskCount: 0,
    openedAt: "2026-08-01T00:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

describe("findSimilarTasks", () => {
  it("matches tasks sharing reason code, attribute, and document", () => {
    const current = task({ id: "current" });
    const same = task({ id: "same" });
    const result = findSimilarTasks(current, [current, same]);
    expect(result.map((t) => t.id)).toEqual(["same"]);
  });

  it("excludes the current task itself", () => {
    const current = task({ id: "current" });
    expect(findSimilarTasks(current, [current])).toEqual([]);
  });

  it("excludes tasks with a different attribute", () => {
    const current = task({ id: "current" });
    const other = task({ id: "other", attributeCode: "body_material" });
    expect(findSimilarTasks(current, [current, other])).toEqual([]);
  });

  it("excludes tasks with a different reason code", () => {
    const current = task({ id: "current" });
    const other = task({ id: "other", reasonCode: "BELOW_THRESHOLD" });
    expect(findSimilarTasks(current, [current, other])).toEqual([]);
  });

  it("excludes tasks bound to a different document", () => {
    const current = task({ id: "current" });
    const other = task({ id: "other", documentVersionId: "docver_2" });
    expect(findSimilarTasks(current, [current, other])).toEqual([]);
  });

  it("excludes tasks that are no longer open", () => {
    const current = task({ id: "current" });
    const resolved = task({ id: "resolved", state: "resolved" });
    expect(findSimilarTasks(current, [current, resolved])).toEqual([]);
  });

  it("returns nothing for a task with no bound document", () => {
    const current = task({ id: "current", documentVersionId: null });
    const other = task({ id: "other", documentVersionId: null });
    expect(findSimilarTasks(current, [current, other])).toEqual([]);
  });
});
