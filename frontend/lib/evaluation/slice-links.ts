/**
 * Drill-down from a gold-set slice name into the live Catalog, reusing the catalog's
 * existing `class_id` filter (`lib/catalog/filters.ts`) rather than inventing a second
 * "eval slice browser" surface (session brief: "connect those to the existing Catalog...
 * rather than creating duplicate experiences"). Only wired for the `real:<class>` slices
 * that correspond to one of the five taxonomy classes — the API contract has no gold-set
 * example endpoint (`docs/api.md` §Evaluation exposes aggregate metrics only, not
 * per-example results), so this links to the *class* a slice measures, not to the
 * specific gold-set rows behind it. Synthetic slices (`synthetic:injection`,
 * `synthetic:domain_knowledge_bait`, …) describe adversarial/held-out documents that
 * don't correspond to any live catalog record, so they deliberately resolve to `null`
 * rather than a misleading link.
 *
 * Uses each class's `code` (e.g. `BALL_VALVE_BRONZE`), not its `id` (`cls_ball_valve`) —
 * `GET /records` accepts either as `class_id` (`app/api/mock/v1/records/route.ts` matches
 * `class?.id || class?.code`), but only the `code` values appear in the Catalog's own
 * filter dropdown (`lib/catalog/class-options.ts`), so a link built from `code` lands on
 * a page whose filter UI actually shows the class as selected, instead of a technically-
 * filtered list with a mismatched, empty-looking control.
 */
const REAL_SLICE_CLASS_CODES: Record<string, string> = {
  ball_valve: "BALL_VALVE_BRONZE",
  gate_globe_check: "GATE_GLOBE_CHECK_VALVE",
  pipe_fitting: "PIPE_FITTING_CU_BRS",
  pvc_cpvc: "PVC_CPVC_VALVE_FITTING",
  gauge_backflow: "GAUGE_BACKFLOW",
};

/** `"real:ball_valve"` -> `/catalog?class_id=BALL_VALVE_BRONZE`; anything else -> `null`. */
export function catalogLinkForSlice(slice: string): string | null {
  const [kind, ...rest] = slice.split(":");
  if (kind !== "real") return null;
  const suffix = rest.join(":");
  const classCode = REAL_SLICE_CLASS_CODES[suffix];
  return classCode ? `/catalog?class_id=${classCode}` : null;
}

/** `"real:ball_valve"` -> `"ball valve"` for display; `"overall"` passes through unchanged. */
export function sliceLabel(slice: string): string {
  const [kind, ...rest] = slice.split(":");
  if (kind !== "real" && kind !== "synthetic") return slice.replaceAll("_", " ");
  return rest.join(":").replaceAll("_", " ") || kind;
}
