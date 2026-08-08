/**
 * NFR-ACC-3 guard (docs/14-frontend-implementation-plan.md §5): "A unit test asserts no
 * other component formats a raw confidence number." `lib/format/confidence.ts` is the
 * only place `.toFixed(` (or an equivalent fixed-decimal format) may be applied to
 * something named/typed as a confidence value.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ALLOWED_FILE = path.resolve(__dirname, "../../lib/format/confidence.ts");
const SCAN_ROOTS = ["app", "components", "lib"].map((d) => path.resolve(__dirname, "../..", d));
const CONFIDENCE_TOFIXED = /confidence[\s\S]{0,40}\.toFixed\(/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "ui") continue;
      out.push(...walk(full));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("confidence formatting is centralised", () => {
  const files = SCAN_ROOTS.flatMap(walk).filter((f) => path.resolve(f) !== ALLOWED_FILE);

  it("no file outside lib/format/confidence.ts formats a raw confidence number", () => {
    const offenders = files.filter((f) => CONFIDENCE_TOFIXED.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
