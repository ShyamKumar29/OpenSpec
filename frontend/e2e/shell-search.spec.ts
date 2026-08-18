import { test, expect } from "@playwright/test";

/**
 * Global command palette (docs/14-frontend-implementation-plan.md §F0: "a single
 * registry that owns bindings, scopes, and the `?` overlay") — the topbar "Search
 * catalog…" control and the ⌘K shortcut both open the same `CommandDialog`
 * (`components/shell/command-palette.tsx`).
 *
 * Regression coverage: `CommandDialog` (`components/ui/command.tsx`) rendered its
 * `cmdk` subcomponents (`CommandInput`, `CommandGroup`, `CommandItem`, ...) inside the
 * Base UI `Dialog` without ever mounting the `cmdk` root (`Command`), so those
 * subcomponents' `useCommandState` had no store context to read and threw
 * "Cannot read properties of undefined (reading 'subscribe')" the instant the dialog
 * opened, tripping the route error boundary. Covered here so the palette can't regress
 * to rendering outside its own store again.
 */
test.describe("Global search / command palette", () => {
  test("opens from the topbar control, supports typing and navigation, and closes cleanly", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Search catalog/ }).click();
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);

    await page.getByPlaceholder("Jump to a page…").fill("catalog");
    const catalogOption = page.getByRole("option", { name: /Catalog/ });
    await expect(catalogOption).toBeVisible();

    await catalogOption.click();
    await expect(page).toHaveURL(/\/catalog/);
    await expect(dialog).toHaveCount(0);
  });

  test("opens via ⌘/Ctrl+K and closes via Escape", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Command palette" });

    // Wait for hydration (the shortcut registry's keydown listener attaches in an
    // effect) before dispatching the shortcut, rather than racing first paint, and
    // focus the page — a fresh tab has no focused element for the key event to hit.
    const searchButton = page.getByRole("button", { name: /Search catalog/ });
    await expect(searchButton).toBeEnabled();
    await page.locator("body").click();

    // The registry effect can lag a render behind "enabled" under load, so retry the
    // shortcut rather than racing it a single time. Guarded on current visibility so a
    // late-arriving first press can't get toggled shut by a retry.
    await expect(async () => {
      if (await dialog.isVisible()) return;
      await page.keyboard.press("Control+k");
      await expect(dialog).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 10_000 });

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
