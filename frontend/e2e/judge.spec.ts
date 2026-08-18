import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * F4 — Judge Mode (docs/09-testing.md §7 flow 8: "Judge Mode: run a record, stage
 * narration progresses, results render"). Covers the three documented demo scenarios,
 * hostile/unrehearsed free-text input (FR-JDG-1/5), the completion hand-off into the
 * real record/Why panel (docs/14-frontend-implementation-plan.md §6 F4), and `/runs/:id`
 * reusing the same stage timeline + run-event source for a run started elsewhere
 * (Re-enrich).
 */

test.describe("Judge Mode — the three canonical demo scenarios", () => {
  test("success: full pipeline narrates to completion and hands off into the real record", async ({
    page,
  }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await expect(page.getByLabel("MPN")).toHaveValue("ABC-123");
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.getByTestId("stage-row")).toHaveCount(9);
    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    await expect(resultPanel).toContainText(/Run complete — \d+ extracted, \d+ unknown/);

    // Hands off into the real record — the hero attribute rows and a working [why?].
    const pressureRow = resultPanel
      .getByTestId("attribute-row")
      .filter({ hasText: "Pressure Rating (WOG)" });
    await expect(pressureRow).toBeVisible();
    await pressureRow.getByRole("button", { name: "[why?]" }).click();
    await expect(page.getByRole("dialog").getByTestId("document-viewer")).toBeVisible();
    await page.keyboard.press("Escape");

    const openRecord = resultPanel.getByRole("link", { name: /Open full record/ });
    await expect(openRecord).toHaveAttribute("href", "/catalog/rec_canonical_abc123");
  });

  test("evidence missing: abstains rather than guessing, with no record to open", async ({
    page,
  }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Evidence missing/ }).click();
    await page.getByRole("button", { name: "Run" }).click();

    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    await expect(resultPanel).toContainText(/abstained on every attribute/);
    await expect(resultPanel).toContainText(/isolated from catalog data/);
    await expect(resultPanel.getByRole("link", { name: /Open full record/ })).toHaveCount(0);
  });

  test("proposed value rejected: verification catches the wrong-row binding, held for review", async ({
    page,
  }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Proposed value rejected/ }).click();
    await page.getByRole("button", { name: "Run" }).click();

    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    await expect(resultPanel).toContainText(/1 value rejected by verification, held for review/);
  });
});

test.describe("Judge Mode — unrehearsed and hostile input (FR-JDG-1)", () => {
  test("an unrecognised free-text MPN still completes and abstains honestly, never crashing", async ({
    page,
  }) => {
    await page.goto("/judge");
    const hostile = '<script>alert(1)</script> "; DROP TABLE records; --';
    await page.getByLabel("MPN").fill(hostile);
    await page.getByRole("button", { name: "Run" }).click();

    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    // The run abstained (the mock's honest fallback for an unrecognised MPN) — never a
    // guessed value, never a crash.
    await expect(resultPanel).toContainText(/abstained on every attribute/);
    // The hostile string is echoed back as literal, React-escaped text — never executed,
    // never dropped (INV-7: document content is data, not instruction). It now appears in
    // two places, the engine header and the console's own input frame, so this asserts on
    // both rather than on a single match.
    await expect(page.getByText(hostile, { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("engine-console")).toContainText(hostile);
    // No dialog/alert was triggered by the injected script content.
    await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
  });

  test("Run stays disabled with both fields empty, and is unblocked by either alone", async ({
    page,
  }) => {
    await page.goto("/judge");
    await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
    await page.getByLabel("Description").fill("some unrecognised product");
    await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
  });
});

test.describe("Judge Mode — the engine console is readable while it streams", () => {
  test("hovering pauses the reveal, and the text stays selectable and copyable", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();

    const log = page.getByTestId("engine-console");
    await expect(log).toContainText("CLASSIFYING", { timeout: 15_000 });
    await log.hover();
    await expect(log).toHaveAttribute("data-paused", "true");

    // Nothing moves under the pointer.
    const held = await log.textContent();
    await page.waitForTimeout(900);
    expect(await log.textContent()).toBe(held);

    // Ordinary DOM text: drag-select it and copy it with the keyboard.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="engine-console"]');
      if (!el) throw new Error("console missing");
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toContain(
      "CLASSIFYING",
    );
    await page.keyboard.press("ControlOrMeta+C");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("CLASSIFYING");

    // Leaving resumes; it does not restart.
    await page.mouse.move(0, 0);
    await expect(log).toHaveAttribute("data-paused", "false");
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });
  });

  test("keyboard focus pauses it too, so the pause is not mouse-only", async ({ page }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();

    const log = page.getByTestId("engine-console");
    await log.focus();
    await expect(log).toHaveAttribute("data-paused", "true");
    await log.blur();
    await expect(log).toHaveAttribute("data-paused", "false");
  });

  test("the console narrates the run's own stages, and the ledger keeps the numbers", async ({
    page,
  }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });

    const log = page.getByTestId("engine-console");
    await expect(log).toContainText("CLASSIFYING", { timeout: 15_000 });
    await expect(log).toContainText("Bound: apollo-70-100-series.pdf", { timeout: 15_000 });
    await expect(log).toContainText("COMPLETE", { timeout: 15_000 });

    // The per-stage duration/cost table is still there, in its own ledger.
    const ledger = page.getByRole("group", { name: "Stage ledger" });
    await expect(ledger.getByTestId("stage-row")).toHaveCount(9);
    await expect(ledger).toContainText("420ms");
  });
});

test.describe("Judge Mode — re-run and hand-off to the run monitor", () => {
  test("'Run again' replays the same scripted scenario", async ({ page }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });

    await resultPanel.getByRole("button", { name: "Run again" }).click();
    await expect(page.getByTestId("stage-row")).toHaveCount(9);
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
  });

  test("'View in Run Monitor' opens /runs/:id with the same completed narration", async ({
    page,
  }) => {
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });

    await resultPanel.getByRole("link", { name: /View in Run Monitor/ }).click();
    await expect(page).toHaveURL(/\/runs\/judge_run_success/);
    await expect(page.getByTestId("stage-row")).toHaveCount(9);
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("/runs/:id — reused stage timeline and run-event source for a run started elsewhere", () => {
  test("a batch run opened directly narrates and shows aggregate results, no catalog framing", async ({
    page,
  }) => {
    await page.goto("/runs/run_batch_complete");
    await expect(page.getByTestId("stage-row")).toHaveCount(9);
    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    await expect(resultPanel).not.toContainText(/isolated from catalog data/);
  });

  test("a failed run shows the stage that errored and offers to replay", async ({ page }) => {
    await page.goto("/runs/run_batch_failed");
    const errorRow = page.getByTestId("stage-row").filter({ hasText: "Parse" });
    await expect(errorRow).toHaveAttribute("data-state", "error", { timeout: 15_000 });
  });

  test("Replay narration re-runs the same deterministic script without leaving the page", async ({
    page,
  }) => {
    await page.goto("/runs/judge_run_rejected");
    const resultPanel = page.getByTestId("live-result-panel");
    await expect(resultPanel).toBeVisible({ timeout: 15_000 });
    await resultPanel.getByRole("button", { name: "Replay narration" }).click();
    await expect(page).toHaveURL(/\/runs\/judge_run_rejected/);
    await expect(resultPanel).toContainText(/rejected by verification/, { timeout: 15_000 });
  });
});

test.describe("Judge Mode — responsive and accessible", () => {
  test("the run form and timeline stay usable at 480px", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto("/judge");
    await expect(page.getByRole("button", { name: /Success/ })).toBeVisible();
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });
  });

  test("a completed run has zero axe violations, in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/judge");
      await page.getByRole("button", { name: /Success/ }).click();
      await page.getByRole("button", { name: "Run" }).click();
      await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("iframe")
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    }
  });

  test("respects prefers-reduced-motion without breaking the run", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/judge");
    await page.getByRole("button", { name: /Success/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });

    // Reduced motion removes the reveal, never the content: everything the run narrated is
    // present, and the blinking caret is not.
    const log = page.getByTestId("engine-console");
    await expect(log).toContainText("CLASSIFYING");
    await expect(log).toContainText("COMPLETE");
    await expect(log.locator(".os-caret")).toHaveCount(0);
  });

  test("the run form is fully keyboard operable", async ({ page }) => {
    await page.goto("/judge");
    await page.getByLabel("MPN").focus();
    await page.keyboard.type("ABC-123");
    await page.keyboard.press("Tab"); // -> Description
    await page.keyboard.type("1/2 BRS BALL VLV 600WOG");
    await page.getByRole("button", { name: "Run" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("live-result-panel")).toBeVisible({ timeout: 15_000 });
  });
});
