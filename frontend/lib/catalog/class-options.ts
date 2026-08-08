/**
 * The five documented PVF demo classes (docs/domain/pvf-reference.md §2; CLAUDE.md
 * "domain traps"), for the catalog's class filter select. Not fetched from an endpoint:
 * `api.md` has no Track-A taxonomy listing route (schemas are read via
 * `GET /admin/schemas`, Track B — a settings/admin concern, out of scope for F1's
 * catalog filter). The taxonomy is explicitly a closed, frozen set for this product
 * (docs/14-frontend-implementation-plan.md C1: "mock data uses the five documented PVF
 * classes only"), so hardcoding it here follows the same precedent as
 * `RECORD_STATUSES`, `UNKNOWN_REASONS`, and `PROVENANCE_KINDS` — all closed sets typed
 * directly in `lib/contracts/*` rather than fetched. Codes are kept in sync by hand with
 * `mocks/fixtures/taxonomy.ts`; `class-options.test.ts` guards the sync in dev.
 */
export interface CatalogClassOption {
  code: string;
  name: string;
}

export const CATALOG_CLASS_OPTIONS: CatalogClassOption[] = [
  { code: "BALL_VALVE_BRONZE", name: "Ball Valve, Bronze/Brass" },
  { code: "GATE_GLOBE_CHECK_VALVE", name: "Gate / Globe / Check Valve" },
  { code: "PIPE_FITTING_CU_BRS", name: "Pipe Fitting, Copper/Brass" },
  { code: "PVC_CPVC_VALVE_FITTING", name: "PVC/CPVC Valve & Fitting" },
  { code: "GAUGE_BACKFLOW", name: "Pressure Gauge / Backflow Preventer" },
];
