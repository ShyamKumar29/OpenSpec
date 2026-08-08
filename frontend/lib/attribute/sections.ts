/**
 * Conceptual attribute grouping for Record Detail (docs/06-frontend.md §3.1:
 * "ATTRIBUTES ⌄ group by … ▸ Identification / ▾ Dimensional / ▾ Pressure / Temperature
 * ⚠ TIER 0 / ▾ Materials"). Not a documented API field — the five PVF schemas
 * (mocks/fixtures/taxonomy.ts, docs/domain/pvf-reference.md §2-3) don't carry a
 * "section" on `AttributeDefinition`, so this is frontend-owned presentation config,
 * keyed by attribute code. Every code across all five taxonomy classes is mapped
 * explicitly — `sections.test.ts` asserts none fall through to the "Other" catch-all.
 */
export const ATTRIBUTE_SECTIONS = [
  "Identification",
  "Dimensional",
  "Pressure / Temperature",
  "Materials",
  "Compliance",
  "Other",
] as const;
export type AttributeSection = (typeof ATTRIBUTE_SECTIONS)[number];

/** Only "Pressure / Temperature" opens by default. It carries the record's Tier-0
 *  attributes (INV-9) — the F1 hero state ("opening ABC-123 shows the Tier-0 gate and
 *  the ANSI-Class refusal without scrolling on a 1440px screen",
 *  docs/14-frontend-implementation-plan.md §6 F1) depends on this default, not on
 *  section ordering, so the documented wireframe order can stay untouched. */
export const SECTION_DEFAULT_OPEN: Record<AttributeSection, boolean> = {
  Identification: false,
  Dimensional: false,
  "Pressure / Temperature": true,
  Materials: false,
  Compliance: false,
  Other: true,
};

const SECTION_BY_CODE: Record<string, AttributeSection> = {
  // Identification — what kind of thing this is
  body_style: "Identification",
  port_type: "Identification",
  handle_type: "Identification",
  valve_type: "Identification",
  fitting_type: "Identification",
  product_type: "Identification",
  device_type: "Identification",
  backflow_type: "Identification",
  bonnet_type: "Identification",
  schedule: "Identification",
  mount_type: "Identification",
  connection_type: "Identification",

  // Dimensional — size and how it connects
  nominal_size: "Dimensional",
  size_standard: "Dimensional",
  connection_size: "Dimensional",
  dial_size: "Dimensional",
  end_connection_inlet: "Dimensional",
  end_connection_outlet: "Dimensional",
  cv_flow_coefficient: "Dimensional",
  wall_thickness_class: "Dimensional",
  iso_5211_mounting: "Dimensional",

  // Pressure / Temperature — Tier-0 heavy; NRM-17 (ANSI Class ⇎ WOG) lives here
  pressure_rating_wog: "Pressure / Temperature",
  pressure_rating_wsp: "Pressure / Temperature",
  pressure_rating_psi_at_73f: "Pressure / Temperature",
  pressure_range_min: "Pressure / Temperature",
  pressure_range_max: "Pressure / Temperature",
  ansi_class: "Pressure / Temperature",
  temperature_range: "Pressure / Temperature",
  temperature_max: "Pressure / Temperature",
  accuracy_class: "Pressure / Temperature",

  // Materials
  body_material: "Materials",
  seat_material: "Materials",
  stem_material: "Materials",
  ball_material: "Materials",
  packing_material: "Materials",
  disc_material: "Materials",

  // Compliance — regulatory / conformance
  lead_free_compliance: "Compliance",
  potable_water_listing: "Compliance",
  solvent_weld_compliance: "Compliance",
  blowout_proof_stem: "Compliance",
  mss_sp_110_conformance: "Compliance",
  certification: "Compliance",
};

export function sectionForAttribute(code: string): AttributeSection {
  return SECTION_BY_CODE[code] ?? "Other";
}

/** Groups items (anything carrying an `attribute.code`) into the five ordered
 *  sections plus "Other". Sections with no items are omitted from the returned map so
 *  callers don't render empty groups. */
export function groupByAttributeSection<T extends { attribute: { code: string } }>(
  items: readonly T[],
): Map<AttributeSection, T[]> {
  const map = new Map<AttributeSection, T[]>();
  for (const item of items) {
    const section = sectionForAttribute(item.attribute.code);
    const bucket = map.get(section);
    if (bucket) bucket.push(item);
    else map.set(section, [item]);
  }
  // Re-insert in canonical order so iteration order is deterministic regardless of
  // input order (fixture generation order is not the display order).
  const ordered = new Map<AttributeSection, T[]>();
  for (const section of ATTRIBUTE_SECTIONS) {
    const bucket = map.get(section);
    if (bucket && bucket.length > 0) ordered.set(section, bucket);
  }
  return ordered;
}
