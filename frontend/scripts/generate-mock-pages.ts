/**
 * Writes the generated SVG datasheet pages to public/mock/pages/ (docs/14-frontend-
 * implementation-plan.md §4.2 C4: "generated as static SVG datasheet pages committed to
 * frontend/public/mock/pages/... no binary blobs in git"). Deterministic — re-running
 * this script produces byte-identical output because the fixture store is seeded.
 *
 * Run with: npm run generate:mock-pages
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { getStore } from "../mocks/fixtures/store";

const OUT_DIR = path.resolve(__dirname, "../public/mock/pages");

function main() {
  const store = getStore();

  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  for (const page of store.pages) {
    const dir = path.join(OUT_DIR, page.documentVersionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${page.page}.svg`), page.svg, "utf-8");
  }

  console.log(
    `Wrote ${store.pages.length} page(s) across ${new Set(store.pages.map((p) => p.documentVersionId)).size} document version(s) to ${OUT_DIR}`,
  );
}

main();
