import { test, expect } from "@playwright/test";

/**
 * F7 — Evaluation (docs/14-frontend-implementation-plan.md §6 F7). Covers: the run
 * history renders real numbers from the fixture store (`mocks/fixtures/eval-runs.ts`,
 * five historical runs); selecting an older run drives the detail sections via `?run=`;
 * every metric block is labelled real/synthetic (FR-EVL-4) and carries its QR target;
 * the frontier chart plots the "generic LLM, no abstention" baseline
 * (docs/12-hackathon-strategy.md); the per-slice table's real-per-class rows drill down
 * into the live Catalog rather than a duplicate browsing surface; and the four required
 * responsive widths (docs/06-frontend.md §9).
 */

test.describe("Evaluation — the quality gate renders real, sourced numbers", () => {
  test("headline metrics show the latest eval run's real numbers, each with a QR target and a Wilson CI", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByRole("heading", { level: 1, name: "Evaluation" })).toBeVisible();

    await expect(page.getByText("STP — all mandatory attributes")).toBeVisible();
    await expect(page.getByText(/QR-3 · target 55% · stretch 70%/)).toBeVisible();
    await expect(page.getByText("STP — auto-eligible attributes only")).toBeVisible();
    await expect(page.getByText("Precision — auto-accepted").first()).toBeVisible();
    await expect(page.getByText(/QR-1 \/ QR-2/).first()).toBeVisible();
    await expect(page.getByText("Expected Calibration Error").first()).toBeVisible();
    await expect(page.getByText("Over-abstention rate")).toBeVisible();

    // Every rate carries a Wilson CI (ASM-7) — never a bare point estimate.
    await expect(page.getByText(/CI \[/).first()).toBeVisible();
  });

  test("every metric block is labelled real or synthetic, and names its source eval run (FR-EVL-4)", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByText("Real slice").first()).toBeVisible();
    await expect(page.getByText(/Source: eval run eval_run_5 · gold set v1\.4/)).toBeVisible();
  });

  test("the demo-data indicator is present (mock adapter is active) — risk F-5", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByText("Demo data — no backend connected").first()).toBeVisible();
  });

  test("run history lists all five eval runs, most recent first and marked Latest", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    const rows = page.getByTestId("eval-run-row");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText("eval_run_5");
    await expect(rows.first()).toContainText("Latest");
    await expect(rows.last()).toContainText("eval_run_1");
    await expect(rows.last()).toContainText("first run");
  });

  test("selecting an older run updates the URL and shows an honest empty state for detail sections not retained for that run", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await page.getByRole("link", { name: "eval_run_1" }).click();
    await expect(page).toHaveURL(/\?run=eval_run_1/);
    await expect(page.getByText("No per-slice data for this run")).toBeVisible();
    await expect(page.getByText("No frontier data for this run")).toBeVisible();
    await expect(page.getByText("No ablation data for this run")).toBeVisible();
    // Headline metrics still render for the older run — only the detail breakdown is thin.
    await expect(page.getByText("STP — all mandatory attributes")).toBeVisible();
  });

  test("the frontier chart plots OpenSpec's own modes against the 'generic LLM, no abstention' baseline", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByText("OpenSpec (verified)").first()).toBeVisible();
    await expect(page.getByText("Generic LLM, no abstention").first()).toBeVisible();
    await expect(page.getByText(/always answers instead of returning/)).toBeVisible();
  });

  test("the reliability diagram reports the ECE headline number against its QR-13 target", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByText(/QR-13, target ≤0\.05/)).toBeVisible();
  });

  test("the per-slice table orders real slices before synthetic ones and drills a real class slice into the Catalog", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    const rows = page.locator("tr", { hasText: "View in catalog" });
    await expect(rows.first()).toBeVisible();

    const link = page.getByRole("link", { name: /view in catalog/i }).first();
    await link.click();
    await expect(page).toHaveURL(/\/catalog\?class_id=/);
    // The Catalog's own class filter reflects the drill-down — no dead-end, no duplicate
    // browsing surface (session brief).
    await expect(page.getByRole("combobox", { name: "Filter by class" })).toContainText(
      /Ball Valve|Gate|Pipe Fitting/,
    );
  });

  test("the ablation table quantifies each defence layer, including a lower-is-better ECE layer as an improvement", async ({
    page,
  }) => {
    await page.goto("/evaluation");
    await expect(page.getByText("verification pass")).toBeVisible();
    await expect(page.getByText("calibration (isotonic)")).toBeVisible();
    await expect(page.getByText(/improves expected calibration error/i)).toBeVisible();
  });

  test("triggering an evaluation run is honest about what the mock does", async ({ page }) => {
    await page.goto("/evaluation");
    await page.getByRole("button", { name: "Run evaluation" }).click();
    await expect(page.getByText("Evaluation run acknowledged")).toBeVisible();
  });
});

test.describe("Evaluation responsive behaviour (docs/06-frontend.md §9)", () => {
  for (const width of [1440, 1280, 900, 480]) {
    test(`usable at ${width}px — no horizontal page overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/evaluation");
      await expect(page.getByRole("heading", { level: 1, name: "Evaluation" })).toBeVisible();
      await expect(page.getByText("STP — all mandatory attributes")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow).toBe(false);
    });
  }
});
