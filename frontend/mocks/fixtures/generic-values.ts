/**
 * Plausible generic display values for attribute datatypes that aren't tied to a
 * specific document cell (docs/domain/pvf-reference.md §5, §7). Kept separate from
 * documents.ts because these values are synthesized, not read off a rendered table.
 */
import type { Rng } from "./rng";
import type { AttributeDefinition } from "@/lib/contracts/taxonomy";

const END_CONNECTIONS = [
  "NPT_FEMALE",
  "NPT_MALE",
  "SOLDER",
  "PRESS",
  "FLANGED",
  "GROOVED",
  "COMPRESSION",
] as const;
const END_CONNECTION_DISPLAY: Record<string, string> = {
  NPT_FEMALE: "NPT Female",
  NPT_MALE: "NPT Male",
  SOLDER: "Solder (C×C)",
  PRESS: "Press",
  FLANGED: "Flanged",
  GROOVED: "Grooved",
  COMPRESSION: "Compression",
};

const GENERIC_ENUM_DISPLAY: Record<string, string> = {
  BRASS: "Brass",
  BRONZE: "Bronze",
  CI: "Cast Iron",
  DUCTILE_IRON: "Ductile Iron",
  CS: "Carbon Steel",
  SS304: "Stainless Steel 304",
  SS316: "Stainless Steel 316",
  PVC: "PVC",
  CPVC: "CPVC",
  COPPER: "Copper",
  "1_PIECE": "1-Piece",
  "2_PIECE": "2-Piece",
  "3_PIECE": "3-Piece",
  FULL: "Full Port",
  STANDARD: "Standard Port",
  REDUCED: "Reduced Port",
  PTFE: "PTFE",
  RPTFE: "Reinforced PTFE",
  PEEK: "PEEK",
  NYLON: "Nylon",
  LEVER: "Lever",
  TEE: "Tee Handle",
  OVAL: "Oval Handle",
  LOCKING: "Locking Lever",
  NSF_61: "NSF/ANSI 61",
  NONE: "None stated",
  GATE: "Gate",
  GLOBE: "Globe",
  CHECK: "Check",
  UNION: "Union Bonnet",
  SCREWED: "Screwed Bonnet",
  BOLTED: "Bolted Bonnet",
  COUPLING: "Coupling",
  ELBOW: "Elbow",
  ADAPTER: "Adapter",
  BUSHING: "Bushing",
  NIPPLE: "Nipple",
  REDUCER: "Reducer",
  TYPE_K: "Type K",
  TYPE_L: "Type L",
  TYPE_M: "Type M",
  VALVE: "Valve",
  FITTING: "Fitting",
  SCH_40: "Schedule 40",
  SCH_80: "Schedule 80",
  PRESSURE_GAUGE: "Pressure Gauge",
  BACKFLOW_PREVENTER: "Backflow Preventer",
  DIRECT: "Direct Mount",
  PANEL: "Panel Mount",
  SURFACE: "Surface Mount",
  RP: "Reduced Pressure (RP)",
  DC: "Double Check (DC)",
  PVB: "Pressure Vacuum Breaker (PVB)",
  ASSE_1013: "ASSE 1013",
  ASSE_1015: "ASSE 1015",
};

export function genericDisplayAndCanonical(
  attrDef: AttributeDefinition,
  rng: Rng,
): { display: string; canonical: Record<string, unknown> } {
  if (attrDef.code.startsWith("end_connection")) {
    const conn = rng.pick(END_CONNECTIONS);
    return { display: END_CONNECTION_DISPLAY[conn], canonical: { connection: conn } };
  }
  if (attrDef.datatype === "bool") {
    const value = rng.bool(0.7);
    return { display: value ? "Yes" : "No", canonical: { bool: value } };
  }
  if (attrDef.datatype === "enum") {
    const options = attrDef.allowedValues ?? ["BRASS", "BRONZE"];
    const picked = rng.pick(options);
    return { display: GENERIC_ENUM_DISPLAY[picked] ?? picked, canonical: { enum: picked } };
  }
  if (attrDef.datatype === "number") {
    const value = rng.range(2, 40, 1);
    return { display: String(value), canonical: { value, unit: null } };
  }
  if (attrDef.datatype === "dimensional") {
    const value = rng.range(1.5, 4, 2);
    return { display: `${value} in`, canonical: { magnitude: value, unit: "in" } };
  }
  // Fallback for anything unmodeled — still a valid, evidenced value.
  const value = rng.range(1, 100, 0);
  return { display: String(value), canonical: { value } };
}
