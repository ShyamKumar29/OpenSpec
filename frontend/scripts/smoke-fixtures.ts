/* Dev-only smoke test: builds the fixture store and prints sanity counts. Not part of
 * the test suite (no assertions) — tests/architecture/fixtures-conform-to-contracts.test.ts
 * is the real guard. This just gives a human-readable summary during development. */
import { getStore } from "../mocks/fixtures/store";
import {
  reviewCounts,
  catalogHealth,
  throughput,
  sessionStats,
} from "../mocks/fixtures/aggregates";

const store = getStore();

console.log("records:", store.records.length);
console.log("documents:", store.documents.length);
console.log("attributeValues:", store.attributeValues.length);
console.log("reviewTasks:", store.reviewTasks.length);
console.log("runs:", store.runs.length);
console.log("evalRuns:", store.evalRuns.summaries.length);
console.log("canonicalIds:", store.canonicalIds);
console.log("reviewCounts:", JSON.stringify(reviewCounts()));
console.log("sessionStats:", JSON.stringify(sessionStats()));
console.log("throughput:", JSON.stringify(throughput()));
const health = catalogHealth();
console.log("catalogHealth.totalRecords:", health.total_records);
console.log(
  "catalogHealth.unknownReasonBreakdown:",
  JSON.stringify(health.unknown_reason_breakdown, null, 2),
);

const canonical = store.recordDetails.get("rec_canonical_abc123");
const canonicalAttrs = store.attrsByRecordId.get("rec_canonical_abc123") ?? [];
console.log("canonical record status:", canonical?.status, "class:", canonical?.class?.code);
const pressureAttr = canonicalAttrs.find((a) => a.attribute.code === "pressure_rating_wog");
console.log("canonical pressure_rating_wog:", JSON.stringify(pressureAttr, null, 2));
const ansiAttr = canonicalAttrs.find((a) => a.attribute.code === "ansi_class");
console.log("canonical ansi_class:", JSON.stringify(ansiAttr, null, 2));
