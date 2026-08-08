/**
 * The five PVF demo classes (docs/domain/pvf-reference.md §2). Ball valve carries the
 * full ~22-mandatory-attribute schema authored in the reference (§3); the other four
 * are authored at a smaller but representative depth — breadth of *record state* is
 * what sells the demo (docs/14-frontend-implementation-plan.md C1), not breadth of
 * category. Hand-authored, not randomly generated: this is structural config, the
 * frontend equivalent of `resources/taxonomy/*.yaml`.
 */
import type { AttributeDefinition, TaxonomyClass } from "@/lib/contracts/taxonomy";

function attr(
  code: string,
  name: string,
  datatype: string,
  riskTier: 0 | 1 | 2 | 3,
  opts: {
    mandatory?: boolean;
    unitDimension?: string | null;
    allowedValues?: string[] | null;
  } = {},
): AttributeDefinition {
  return {
    code,
    name,
    datatype,
    unitDimension: opts.unitDimension ?? null,
    allowedValues: opts.allowedValues ?? null,
    isMandatory: opts.mandatory ?? true,
    riskTier,
  };
}

// Matches docs/domain/pvf-reference.md §3 exactly: 22 mandatory attributes, six at
// Tier 0 (pressure_rating_wog, pressure_rating_wsp, ansi_class, temperature_range,
// lead_free_compliance, potable_water_listing) — the ceiling that caps STP near 73%.
const BALL_VALVE_ATTRIBUTES: AttributeDefinition[] = [
  attr("nominal_size", "Nominal Size", "designation", 1),
  attr("size_standard", "Size Standard", "enum", 1, { allowedValues: ["NPS", "DN", "TUBE"] }),
  attr("body_material", "Body Material", "enum", 1, {
    allowedValues: ["BRASS", "BRONZE", "CI", "DUCTILE_IRON", "CS", "SS304", "SS316", "PVC", "CPVC"],
  }),
  attr("body_style", "Body Style", "enum", 2, { allowedValues: ["1_PIECE", "2_PIECE", "3_PIECE"] }),
  attr("end_connection_inlet", "End Connection (Inlet)", "enum", 1),
  attr("end_connection_outlet", "End Connection (Outlet)", "enum", 1),
  attr("port_type", "Port Type", "enum", 1, { allowedValues: ["FULL", "STANDARD", "REDUCED"] }),
  attr("pressure_rating_wog", "Pressure Rating (WOG)", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("pressure_rating_wsp", "Pressure Rating (WSP)", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("ansi_class", "ANSI Class", "enum", 0, { allowedValues: ["125", "150", "300", "600"] }),
  attr("temperature_range", "Temperature Range", "temperature_range", 0, {
    unitDimension: "temperature",
  }),
  attr("seat_material", "Seat Material", "enum", 2, {
    allowedValues: ["PTFE", "RPTFE", "PEEK", "NYLON"],
  }),
  attr("stem_material", "Stem Material", "enum", 2),
  attr("ball_material", "Ball Material", "enum", 2),
  attr("packing_material", "Packing Material", "enum", 2),
  attr("handle_type", "Handle Type", "enum", 3, {
    allowedValues: ["LEVER", "TEE", "OVAL", "LOCKING"],
  }),
  attr("lead_free_compliance", "Lead-Free Compliance", "bool", 0),
  attr("potable_water_listing", "Potable Water Listing", "enum", 0, {
    allowedValues: ["NSF_61", "NONE"],
  }),
  attr("blowout_proof_stem", "Blowout-Proof Stem", "bool", 2),
  attr("iso_5211_mounting", "ISO 5211 Mounting", "bool", 2),
  attr("cv_flow_coefficient", "Cv Flow Coefficient", "number", 2),
  attr("mss_sp_110_conformance", "MSS SP-110 Conformance", "bool", 1),
];

const GATE_GLOBE_CHECK_ATTRIBUTES: AttributeDefinition[] = [
  attr("nominal_size", "Nominal Size", "designation", 1),
  attr("size_standard", "Size Standard", "enum", 1, { allowedValues: ["NPS", "DN"] }),
  attr("valve_type", "Valve Type", "enum", 1, { allowedValues: ["GATE", "GLOBE", "CHECK"] }),
  attr("body_material", "Body Material", "enum", 1, {
    allowedValues: ["BRASS", "BRONZE", "CI", "DUCTILE_IRON"],
  }),
  attr("bonnet_type", "Bonnet Type", "enum", 2, { allowedValues: ["UNION", "SCREWED", "BOLTED"] }),
  attr("end_connection_inlet", "End Connection (Inlet)", "enum", 1),
  attr("end_connection_outlet", "End Connection (Outlet)", "enum", 1),
  attr("pressure_rating_wog", "Pressure Rating (WOG)", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("pressure_rating_wsp", "Pressure Rating (WSP)", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("ansi_class", "ANSI Class", "enum", 0, { allowedValues: ["125", "150", "300"] }),
  attr("temperature_range", "Temperature Range", "temperature_range", 0, {
    unitDimension: "temperature",
  }),
  attr("disc_material", "Disc Material", "enum", 2),
  attr("seat_material", "Seat Material", "enum", 2),
  attr("stem_material", "Stem Material", "enum", 2),
  attr("lead_free_compliance", "Lead-Free Compliance", "bool", 0),
  attr("potable_water_listing", "Potable Water Listing", "enum", 0, {
    allowedValues: ["NSF_61", "NONE"],
  }),
];

const PIPE_FITTING_ATTRIBUTES: AttributeDefinition[] = [
  attr("nominal_size", "Nominal Size", "designation", 1),
  attr("size_standard", "Size Standard", "enum", 1, { allowedValues: ["NPS", "TUBE"] }),
  attr("fitting_type", "Fitting Type", "enum", 1, {
    allowedValues: ["COUPLING", "ELBOW", "TEE", "ADAPTER", "BUSHING", "NIPPLE", "REDUCER"],
  }),
  attr("body_material", "Body Material", "enum", 1, {
    allowedValues: ["BRASS", "BRONZE", "COPPER"],
  }),
  attr("end_connection_inlet", "End Connection (Inlet)", "enum", 1),
  attr("end_connection_outlet", "End Connection (Outlet)", "enum", 1),
  attr("pressure_rating_wog", "Pressure Rating (WOG)", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("temperature_max", "Temperature Max", "temperature", 0, { unitDimension: "temperature" }),
  attr("lead_free_compliance", "Lead-Free Compliance", "bool", 0),
  attr("potable_water_listing", "Potable Water Listing", "enum", 0, {
    allowedValues: ["NSF_61", "NONE"],
  }),
  attr("wall_thickness_class", "Wall Thickness Class", "enum", 2, {
    mandatory: false,
    allowedValues: ["TYPE_K", "TYPE_L", "TYPE_M"],
  }),
];

const PVC_CPVC_ATTRIBUTES: AttributeDefinition[] = [
  attr("nominal_size", "Nominal Size", "designation", 1),
  attr("size_standard", "Size Standard", "enum", 1, { allowedValues: ["NPS"] }),
  attr("body_material", "Body Material", "enum", 1, { allowedValues: ["PVC", "CPVC"] }),
  attr("product_type", "Product Type", "enum", 1, { allowedValues: ["VALVE", "FITTING"] }),
  attr("schedule", "Schedule", "enum", 1, { allowedValues: ["SCH_40", "SCH_80"] }),
  attr("end_connection_inlet", "End Connection (Inlet)", "enum", 1),
  attr("end_connection_outlet", "End Connection (Outlet)", "enum", 1),
  attr("pressure_rating_psi_at_73f", "Pressure Rating @ 73°F", "pressure", 0, {
    unitDimension: "pressure",
  }),
  attr("temperature_max", "Temperature Max", "temperature", 0, { unitDimension: "temperature" }),
  attr("solvent_weld_compliance", "Solvent-Weld Compliance", "bool", 2, { mandatory: false }),
];

const GAUGE_BACKFLOW_ATTRIBUTES: AttributeDefinition[] = [
  attr("connection_size", "Connection Size", "designation", 1),
  attr("size_standard", "Size Standard", "enum", 1, { allowedValues: ["NPS"] }),
  attr("device_type", "Device Type", "enum", 1, {
    allowedValues: ["PRESSURE_GAUGE", "BACKFLOW_PREVENTER"],
  }),
  attr("dial_size", "Dial Size", "dimensional", 2, { mandatory: false, unitDimension: "length" }),
  attr("pressure_range_min", "Pressure Range Min", "pressure", 0, { unitDimension: "pressure" }),
  attr("pressure_range_max", "Pressure Range Max", "pressure", 0, { unitDimension: "pressure" }),
  attr("accuracy_class", "Accuracy Class", "enum", 2, { mandatory: false }),
  attr("connection_type", "Connection Type", "enum", 1),
  attr("mount_type", "Mount Type", "enum", 2, { allowedValues: ["DIRECT", "PANEL", "SURFACE"] }),
  attr("body_material", "Body Material", "enum", 1, {
    allowedValues: ["BRASS", "BRONZE", "SS304", "SS316"],
  }),
  attr("backflow_type", "Backflow Assembly Type", "enum", 1, {
    mandatory: false,
    allowedValues: ["RP", "DC", "PVB"],
  }),
  attr("certification", "Certification", "enum", 0, {
    allowedValues: ["ASSE_1013", "ASSE_1015", "NONE"],
  }),
];

export const TAXONOMY: TaxonomyClass[] = [
  {
    id: "cls_ball_valve",
    code: "BALL_VALVE_BRONZE",
    name: "Ball Valve, Bronze/Brass",
    attributes: BALL_VALVE_ATTRIBUTES,
  },
  {
    id: "cls_gate_globe_check",
    code: "GATE_GLOBE_CHECK_VALVE",
    name: "Gate / Globe / Check Valve",
    attributes: GATE_GLOBE_CHECK_ATTRIBUTES,
  },
  {
    id: "cls_pipe_fitting",
    code: "PIPE_FITTING_CU_BRS",
    name: "Pipe Fitting, Copper/Brass",
    attributes: PIPE_FITTING_ATTRIBUTES,
  },
  {
    id: "cls_pvc_cpvc",
    code: "PVC_CPVC_VALVE_FITTING",
    name: "PVC/CPVC Valve & Fitting",
    attributes: PVC_CPVC_ATTRIBUTES,
  },
  {
    id: "cls_gauge_backflow",
    code: "GAUGE_BACKFLOW",
    name: "Pressure Gauge / Backflow Preventer",
    attributes: GAUGE_BACKFLOW_ATTRIBUTES,
  },
];

export function mandatoryCount(cls: TaxonomyClass): number {
  return cls.attributes.filter((a) => a.isMandatory).length;
}

export function tier0Count(cls: TaxonomyClass): number {
  return cls.attributes.filter((a) => a.riskTier === 0).length;
}
