import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * F2 (`DocumentViewer`) + F3 (Why panel) — docs/09-testing.md §7:
 *   - Flow 3: "Open Why → evidence highlight renders at the correct position". This is
 *     the coordinate fixture test named as a deliverable in docs/14-frontend-
 *     implementation-plan.md §6 F2 ("asserted by a Playwright screenshot comparison").
 *     Implemented here as a geometry assertion against the known fixture bbox rather
 *     than a pixel screenshot diff — screenshot baselines are brittle across OS/font
 *     rendering, whereas comparing the highlight's rendered position (as a fraction of
 *     the page image) against the bbox's known fraction retires the same risk (E1:
 *     "highlight is 12px off") without that fragility. Documented as a deviation in the
 *     phase report.
 * Plus document/page rendering, evidence region/highlight interaction, states, and
 * attribute → evidence → document navigation.
 */

const CANONICAL_ID = "rec_canonical_abc123";
const CANONICAL_DOC = "docver_apollo_70_100_v2024";
const UNPARSEABLE_DOC = "docver_unparseable_001";

test.describe("Why panel — coordinate fixture test (flow 3)", () => {
  test("evidence highlight renders at the position implied by the record's own evidence bbox", async ({
    page,
    request,
  }) => {
    // Ground truth from the same API the app itself calls — not a hand-copied constant.
    // (docs/api.md's own `bbox: [312, 480, 372, 494]` is an illustrative example, not
    // necessarily this record's actual evidence — deriving "expected" from the mock API
    // is what makes this test a real cross-check rather than two copies of one number.)
    const record = await (await request.get(`/api/mock/v1/records/${CANONICAL_ID}`)).json();
    const wogAttr = record.attributes.find(
      (a: { attribute: { code: string } }) => a.attribute.code === "pressure_rating_wog",
    );
    const evidence = wogAttr.evidence[0];
    const doc = await (
      await request.get(`/api/mock/v1/documents/${evidence.document_version_id}`)
    ).json();
    const pageMeta = doc.pages.find((p: { n: number }) => p.n === evidence.page);
    const [bx0, by0, bx1, by1] = evidence.bbox as [number, number, number, number];
    const expected = {
      x0: bx0 / pageMeta.width_px,
      y0: by0 / pageMeta.height_px,
      x1: bx1 / pageMeta.width_px,
      y1: by1 / pageMeta.height_px,
    };

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/catalog/${CANONICAL_ID}`);

    const wogRow = page.getByTestId("attribute-row").filter({ hasText: "Pressure Rating (WOG)" });
    await wogRow.getByRole("button", { name: "[why?]" }).click();

    const dialog = page.getByRole("dialog");
    const canvas = dialog.getByTestId("page-canvas");
    await expect(canvas).toHaveAttribute("data-page", String(evidence.page));
    const highlight = dialog.getByTestId("evidence-highlight").first();
    await expect(highlight).toBeVisible();

    const canvasBox = (await canvas.boundingBox())!;
    const highlightBox = (await highlight.boundingBox())!;
    const actual = {
      x0: (highlightBox.x - canvasBox.x) / canvasBox.width,
      y0: (highlightBox.y - canvasBox.y) / canvasBox.height,
      x1: (highlightBox.x + highlightBox.width - canvasBox.x) / canvasBox.width,
      y1: (highlightBox.y + highlightBox.height - canvasBox.y) / canvasBox.height,
    };

    const TOLERANCE = 0.01; // 1% of page dimension — retires "highlight is 12px off" (E1)
    expect(Math.abs(actual.x0 - expected.x0)).toBeLessThan(TOLERANCE);
    expect(Math.abs(actual.y0 - expected.y0)).toBeLessThan(TOLERANCE);
    expect(Math.abs(actual.x1 - expected.x1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(actual.y1 - expected.y1)).toBeLessThan(TOLERANCE);
  });

  test("attribute → Why → evidence → exact document location → highlighted source → verification, in one panel", async ({
    page,
  }) => {
    await page.goto(`/catalog/${CANONICAL_ID}`);
    const wogRow = page.getByTestId("attribute-row").filter({ hasText: "Pressure Rating (WOG)" });
    await wogRow.getByRole("button", { name: "[why?]" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Why: Pressure Rating (WOG)")).toBeVisible();
    // Evidence: document + location + verbatim. `exact: true` because the section also
    // shows a distinct (but textually related) table-caption line just below it.
    await expect(
      dialog.getByText("Apollo 70-100 Series Bronze Ball Valves", { exact: true }),
    ).toBeVisible();
    // Exact document location + highlighted source, in the same panel, no navigation.
    await expect(dialog.getByTestId("document-viewer")).toBeVisible();
    await expect(dialog.getByTestId("evidence-highlight").first()).toBeVisible();
    // Verification / provenance.
    await expect(dialog.getByRole("heading", { name: "Policy" })).toBeVisible();
    await expect(dialog.getByText(/Tier 0 — human approval required/)).toBeVisible();
  });
});

test.describe("Why panel — Unknown variant (FR-EXP-3)", () => {
  test("the ANSI Class refusal explains itself, citing rule NRM-17, with no document evidence to show", async ({
    page,
  }) => {
    await page.goto(`/catalog/${CANONICAL_ID}`);
    const ansiRow = page.getByTestId("attribute-row").filter({ hasText: "ANSI Class" });
    await ansiRow.getByRole("button", { name: "[why?]" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Not stated in the document")).toBeVisible();
    const validationSection = dialog.getByRole("heading", { name: "Validation" }).locator("..");
    await expect(validationSection.getByText("NRM-17")).toBeVisible();
    await expect(validationSection.getByText(/never derived from a WOG rating/)).toBeVisible();
    await expect(dialog.getByText("No document evidence")).toBeVisible();
  });
});

test.describe("DocumentViewer — record detail integration", () => {
  test("record detail shows the bound row highlighted inline at 1440px, with no extra click", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/catalog/${CANONICAL_ID}`);

    const viewer = page.getByTestId("document-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer.getByTestId("evidence-highlight").first()).toBeVisible();
  });

  test("below 1024px the document pane collapses to a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(`/catalog/${CANONICAL_ID}`);

    await expect(page.getByTestId("document-viewer")).not.toBeVisible();
    const trigger = page.getByRole("button", { name: "View source document" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog").getByTestId("document-viewer")).toBeVisible();
  });
});

test.describe("DocumentViewer — document/page rendering, navigation, states", () => {
  test("page navigation and zoom controls work on the document detail page", async ({ page }) => {
    await page.goto(`/documents/${CANONICAL_DOC}`);
    const viewer = page.getByTestId("document-viewer");
    const canvas = viewer.getByTestId("page-canvas");
    await expect(canvas).toHaveAttribute("data-page", "1");

    await viewer.getByRole("button", { name: "Next page" }).click();
    await expect(canvas).toHaveAttribute("data-page", "2");
    await viewer.getByRole("button", { name: "Previous page" }).click();
    await expect(canvas).toHaveAttribute("data-page", "1");

    await viewer.getByRole("button", { name: "Zoom in" }).click();
    await expect(viewer.getByText("125%")).toBeVisible();
    await viewer.getByRole("button", { name: "Fit to view" }).click();
    await expect(viewer.getByText("100%")).toBeVisible();
  });

  test("keyboard navigation moves pages without a mouse", async ({ page }) => {
    await page.goto(`/documents/${CANONICAL_DOC}`);
    const viewer = page.getByTestId("document-viewer");
    const canvas = viewer.getByTestId("page-canvas");
    await viewer.getByRole("button", { name: "Next page" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(canvas).toHaveAttribute("data-page", "2");
    await page.keyboard.press("ArrowLeft");
    await expect(canvas).toHaveAttribute("data-page", "1");
  });

  test("expand to fullscreen opens the same viewer in a dialog", async ({ page }) => {
    await page.goto(`/documents/${CANONICAL_DOC}`);
    const viewer = page.getByTestId("document-viewer");
    await viewer.getByRole("button", { name: "Expand to fullscreen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("document-viewer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("an unparseable document shows the unavailable-document state, not a broken image", async ({
    page,
  }) => {
    await page.goto(`/documents/${UNPARSEABLE_DOC}`);
    await expect(page.getByText("Document could not be parsed")).toBeVisible();
    await expect(page.getByTestId("page-canvas")).not.toBeVisible();
  });

  test("the corpus browser lists documents and filters by parse status", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByTestId("document-row").first()).toBeVisible();

    await page.getByLabel("Parse status").click();
    await page.getByRole("option", { name: "Unparseable" }).click();
    await expect(page).toHaveURL(/parse_status=unparseable/);
    const rows = page.getByTestId("document-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Scanned Legacy Catalog");
  });
});

test.describe("Accessibility — interactive states not covered by the route-level axe smoke pass", () => {
  test("the open Why panel dialog has zero axe violations, in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/catalog/${CANONICAL_ID}`);
      const wogRow = page.getByTestId("attribute-row").filter({ hasText: "Pressure Rating (WOG)" });
      await wogRow.getByRole("button", { name: "[why?]" }).click();
      await expect(page.getByRole("dialog").getByTestId("document-viewer")).toBeVisible();

      // Scoped to the dialog itself, not the whole page: base-ui's dialog inert/backdrop
      // handling of the *background* page is a shared app-shell concern (every dialog in
      // the app has the same backdrop), already covered at rest by axe-smoke.spec.ts;
      // this test's job is whether the panel's OWN content is accessible.
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("iframe")
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    }
  });

  test("the expanded fullscreen DocumentViewer dialog has zero axe violations", async ({
    page,
  }) => {
    await page.goto(`/documents/${CANONICAL_DOC}`);
    await page
      .getByTestId("document-viewer")
      .getByRole("button", { name: "Expand to fullscreen" })
      .click();
    await expect(page.getByRole("dialog").getByTestId("document-viewer")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("iframe")
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
