/**
 * D2 (docs/14-frontend-implementation-plan.md §1): "No endpoint may exist in the mock
 * that does not exist in api.md." This walks app/api/mock/v1/** for every route.ts,
 * derives its path, and asserts a corresponding row exists in docs/api.md's endpoint
 * tables. It does NOT require the reverse (every api.md endpoint need not yet have a
 * mock handler) — endpoints land per-phase as the UI needs them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const MOCK_ROOT = path.resolve(__dirname, "../../app/api/mock/v1");
const API_MD_PATH = path.resolve(__dirname, "../../../docs/api.md");

function walkRoutes(dir: string, base = ""): string[] {
  const entries = readdirSync(dir);
  const routes: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...walkRoutes(full, `${base}/${entry}`));
    } else if (entry === "route.ts") {
      routes.push(base || "/");
    }
  }
  return routes;
}

/** `[id]` -> `{id}`, `[versionId]` -> `{version_id}`-shaped comparison is done loosely:
 *  any bracketed dynamic segment is treated as a wildcard against api.md's `{...}`. */
function toPattern(route: string): RegExp {
  const escaped = route
    .split("/")
    .map((seg) =>
      seg.startsWith("[") ? "\\{[^}/]+\\}" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`(^|\\s|\`)${escaped}(\\s|\`|$)`);
}

describe("mock routes are a subset of docs/api.md (risk F-2, rule D2)", () => {
  const routes = walkRoutes(MOCK_ROOT);
  const apiMd = readFileSync(API_MD_PATH, "utf-8");

  it("found a non-trivial number of mock routes", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it.each(routes)("mock route %s is documented in docs/api.md", (route) => {
    const pattern = toPattern(route);
    expect(pattern.test(apiMd)).toBe(true);
  });
});
