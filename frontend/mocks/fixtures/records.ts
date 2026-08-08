/**
 * Record skeletons: identity, class, target status, and the raw description string —
 * everything that does NOT depend on attribute values or document binding, which are
 * generated afterward and feed back into the record's `completeness` (computed, never
 * hand-typed — risk F-3).
 */
import type { Rng } from "./rng";
import { isoDaysAgo } from "./rng";
import { TAXONOMY } from "./taxonomy";
import type { RecordStatus } from "@/lib/contracts/record";

export const NPS_SIZES = [
  "1/8",
  "1/4",
  "3/8",
  "1/2",
  "3/4",
  "1",
  "1-1/4",
  "1-1/2",
  "2",
  "2-1/2",
  "3",
  "4",
] as const;

const FICTIONAL_SUPPLIERS = [
  "Meridian Flow Control",
  "Cascade Brass Works",
  "Northgate PVF Supply",
  "Sterling Valve & Fitting",
  "Highline Industrial Supply",
  "Union Bay Plumbing Supply",
  "Anchorpoint Distribution",
  "Redstone Flow Products",
];

/** The one real-brand-shaped name in the fixture set — carried over verbatim from the
 *  demo beats already authored in docs/06-frontend.md §3.1-3.3 ("apollo-70-100-series.pdf",
 *  catalog no. "70-104-01"). Every other document/supplier name in this fixture set is
 *  fictional (docs/CLAUDE.md guidance against fabricated-but-real-seeming content). */
export const CANONICAL_PUBLISHER = "Apollo Valves";

export interface RecordSkeleton {
  id: string;
  mpnRaw: string;
  descriptionRaw: string;
  supplierName: string | null;
  classIndex: number | null; // index into TAXONOMY, null when CLASS_UNRESOLVED
  targetStatus: RecordStatus;
  size: string;
  catalogNo: string;
  createdAt: string;
}

const TARGET_STATUS_WEIGHTS: [RecordStatus, number][] = [
  ["healthy", 90],
  ["incomplete", 50],
  ["partially_enriched", 40],
  ["awaiting_tier0_approval", 25],
  ["unknown_heavy", 15],
  ["class_unresolved", 8],
  ["unbound", 8],
  ["conflicting_sources", 4],
];

function expandWeights(): RecordStatus[] {
  const out: RecordStatus[] = [];
  for (const [status, count] of TARGET_STATUS_WEIGHTS) {
    for (let i = 0; i < count; i++) out.push(status);
  }
  return out;
}

function describeBallValve(
  rng: Rng,
  size: string,
): { desc: string; wog: number; catalogNo: string } {
  const wog = rng.pick([150, 200, 300, 400, 600]);
  const mat = rng.pick(["BRS", "BRZ"]);
  const catalogNo = `70-${rng.int(100, 199)}-${rng.int(10, 99)}`;
  return { desc: `${size} ${mat} BALL VLV ${wog}WOG`, wog, catalogNo };
}

function describeGateGlobeCheck(
  rng: Rng,
  size: string,
): { desc: string; wog: number; catalogNo: string } {
  const kind = rng.pick(["GATE", "GLB", "CKV"]);
  const wog = rng.pick([125, 150, 200, 300]);
  const mat = rng.pick(["BRZ", "CI"]);
  const catalogNo = `41-${rng.int(100, 199)}-${rng.int(10, 99)}`;
  return { desc: `${size} ${kind} VLV ${mat} ${wog}WOG`, wog, catalogNo };
}

function describePipeFitting(
  rng: Rng,
  size: string,
): { desc: string; wog: number; catalogNo: string } {
  const fitting = rng.pick(["CPLG", "ELL", "TEE", "ADPT", "BSHG"]);
  const conn = rng.pick(["CxC", "FIP", "MIP"]);
  const mat = rng.pick(["WROT CU", "CAST BRS"]);
  const wog = rng.pick([200, 250, 300]);
  const catalogNo = `C${rng.int(1000, 9999)}`;
  return { desc: `${size} ${fitting} ${conn} ${mat}`, wog, catalogNo };
}

function describePvcCpvc(rng: Rng, size: string): { desc: string; wog: number; catalogNo: string } {
  const mat = rng.pick(["PVC", "CPVC"]);
  const sch = rng.pick(["SCH40", "SCH80"]);
  const kind = rng.pick(["BALL VLV", "CPLG", "ELL", "TEE"]);
  const psi = rng.pick([150, 235, 315]);
  const catalogNo = `P${rng.int(100, 999)}-${sch}`;
  return { desc: `${size} ${mat} ${kind} ${sch}`, wog: psi, catalogNo };
}

function describeGaugeBackflow(
  rng: Rng,
  size: string,
): { desc: string; wog: number; catalogNo: string } {
  const kind = rng.pick(["PRESS GAUGE", "BACKFLOW RP", "BACKFLOW DC"]);
  const range = rng.pick([100, 160, 200, 300]);
  const catalogNo = `G${rng.int(100, 999)}`;
  return { desc: `${size} ${kind} ${range}PSI`, wog: range, catalogNo };
}

const DESCRIBERS = [
  describeBallValve,
  describeGateGlobeCheck,
  describePipeFitting,
  describePvcCpvc,
  describeGaugeBackflow,
];

export function generateRecordSkeletons(rng: Rng, count: number): RecordSkeleton[] {
  const statuses = rng.shuffle(expandWeights()).slice(0, count);
  const skeletons: RecordSkeleton[] = [];

  const ballValveIndex = TAXONOMY.findIndex((c) => c.code === "BALL_VALVE_BRONZE");

  for (let i = 0; i < count; i++) {
    const targetStatus = statuses[i];
    // conflicting_sources records are always ball valves — they're bound to the
    // documented revision-conflict document pair, which is authored for that class.
    const classIndex =
      targetStatus === "class_unresolved"
        ? null
        : targetStatus === "conflicting_sources"
          ? ballValveIndex
          : i % TAXONOMY.length;
    const size = rng.pick(NPS_SIZES);
    const describer = DESCRIBERS[classIndex ?? rng.int(0, TAXONOMY.length - 1)];
    const { desc, catalogNo } = describer(rng, size);
    const mpn = `${rng.pick(["ABC", "PVF", "DST", "RTL", "SKU"])}-${rng.int(1000, 9999)}`;
    skeletons.push({
      id: `rec_${String(i + 1).padStart(4, "0")}`,
      mpnRaw: mpn,
      descriptionRaw: desc,
      supplierName: targetStatus === "class_unresolved" ? null : rng.pick(FICTIONAL_SUPPLIERS),
      classIndex,
      targetStatus,
      size,
      catalogNo,
      createdAt: isoDaysAgo(rng.int(1, 90)),
    });
  }

  // The canonical demo record (docs/14-frontend-implementation-plan.md §4.2):
  // "ABC-123" — 1/2 BRS BALL VLV 600WOG, carrying the highlighted family-table row,
  // the ANSI-Class-from-WOG refusal, and the Tier-0 AWAITING APPROVAL pressure at 0.97.
  skeletons[0] = {
    ...skeletons[0],
    id: "rec_canonical_abc123",
    mpnRaw: "ABC-123",
    descriptionRaw: "1/2 BRS BALL VLV 600WOG",
    supplierName: FICTIONAL_SUPPLIERS[0],
    classIndex: TAXONOMY.findIndex((c) => c.code === "BALL_VALVE_BRONZE"),
    targetStatus: "awaiting_tier0_approval",
    size: "1/2",
    catalogNo: "70-104-01",
    createdAt: isoDaysAgo(30),
  };

  return skeletons;
}

export { TAXONOMY };
