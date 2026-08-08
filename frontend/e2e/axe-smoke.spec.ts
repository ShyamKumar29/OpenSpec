import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * F0 owns no numbered E2E flow (docs/09-testing.md §7 maps flows 1-12 to F1 onward),
 * but its own Definition of Done requires "axe: zero violations on every route the
 * phase touched, in both themes" and "every route navigable, never a blank page"
 * (docs/14-frontend-implementation-plan.md §7). This is that check, across all twelve
 * routes and both themes.
 */
const ROUTES = [
  "/",
  "/catalog",
  "/catalog/rec_canonical_abc123",
  "/review",
  "/review/task_demo",
  "/documents",
  "/documents/docver_apollo_70_100_v2024",
  "/evaluation",
  "/judge",
  "/runs/run_batch_complete",
  "/settings",
  "/import",
];

for (const route of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route} has zero axe violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("iframe")
        .analyze();

      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
}

test("every route renders its own heading, never a blank page", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
