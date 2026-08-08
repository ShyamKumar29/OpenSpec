import { API_BASE_URL } from "./client";

/**
 * Drives the persistent "DEMO DATA" indicator (docs/14-frontend-implementation-plan.md
 * §C2 / risk F-5) — a single source of truth, not a hardcoded flag in a component.
 * True whenever the API base URL points at the mock layer under app/api/mock/.
 */
export function isMockApiMode(): boolean {
  return API_BASE_URL.includes("/mock/");
}
