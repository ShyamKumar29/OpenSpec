import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * F5 - Review Queue (docs/09-testing.md section 7 flows 4, 5, 6, 9;
 * docs/14-frontend-implementation-plan.md section 6 F5, "protected budget"). Task ids
 * embed a fixture-generation counter that depends on total generation order, so tests
 * that need a *specific* task (the ABC-123 wrong-row hero, a Tier 0 task, a
 * bulk-eligible group) discover it live from the mock's own GET /review/tasks rather
 * than hardcoding an id -- the same discipline catalog.spec.ts uses for
 * rec_canonical_abc123, applied where the id itself isn't stable.
 *
 * The whole file runs serially (one worker, declaration order): several tests mutate
 * shared mock-store state (accept/reject/correct a task), and Playwright's default
 * full parallelism would let two tests race to decide the same task. Serial execution
 * makes every test's own fresh fetch-then-act sequence race-free without needing to
 * hand-partition which task index each test is allowed to touch.
 */

interface TaskWire {
  id: string;
  record_id: string;
  record_mpn: string;
  attribute_name: string;
  attribute_code: string;
  risk_tier: 0 | 1 | 2 | 3;
  reason_code: string;
  document_version_id: string | null;
  proposed_value: { value_display: string } | null;
}

async function fetchOpenTasks(request: APIRequestContext, reasonCode: string): Promise<TaskWire[]> {
  const res = await request.get(`/api/mock/v1/review/tasks?reason_code=${reasonCode}&limit=100`);
  const body = (await res.json()) as { items: TaskWire[] };
  return body.items;
}

test.describe.serial("F5 - Review Queue", () => {
  test.describe("Accept (flow 4)", () => {
    test("accept publishes the value, resolves the task, and the tab count reconciles", async ({
      page,
      request,
    }) => {
      const [task] = await fetchOpenTasks(request, "BELOW_THRESHOLD");
      test.skip(!task, "No BELOW_THRESHOLD task available in this fixture run");

      await page.goto("/review");
      await page.getByTestId("reason-tab").filter({ hasText: "Below threshold" }).click();
      await expect(page).toHaveURL(new RegExp(`/review/${task.id}$`));

      const beforeCount = await page
        .getByTestId("reason-tab")
        .filter({ hasText: "Below threshold" })
        .locator(".metric")
        .innerText();

      await expect(page.getByTestId("task-card")).toContainText(task.record_mpn);
      await page.getByTestId("decision-accept").click();
      await expect(page.getByText("Accepted", { exact: true })).toBeVisible();

      // Optimistic: the task is gone from the queue immediately, without waiting on a
      // network round trip to look like it worked.
      await expect(page.getByTestId("task-card")).not.toContainText(task.record_mpn);

      // The tab count reconciles with the server once the invalidated query resettles.
      await expect(async () => {
        const afterCount = await page
          .getByTestId("reason-tab")
          .filter({ hasText: "Below threshold" })
          .locator(".metric")
          .innerText();
        expect(Number(afterCount)).toBe(Number(beforeCount) - 1);
      }).toPass({ timeout: 5000 });

      // The value is genuinely published, not just hidden client-side.
      const record = await request.get(`/api/mock/v1/records/${task.record_id}`);
      const recordBody = await record.json();
      const attr = (
        recordBody.attributes as { attribute: { code: string }; status: string }[]
      ).find((a) => a.attribute.code === task.attribute_code);
      expect(attr?.status).toBe("ACCEPTED");
    });
  });

  test.describe("Correct / Edit (flow 5)", () => {
    test("a correction supersedes the value with HUMAN provenance", async ({ page, request }) => {
      const [task] = await fetchOpenTasks(request, "BELOW_THRESHOLD");
      test.skip(!task, "No BELOW_THRESHOLD task available in this fixture run");

      await page.goto(`/review/${task.id}`);
      await expect(page.getByTestId("task-card")).toContainText(task.record_mpn);

      await page.getByRole("button", { name: "[E] Edit value" }).click();
      const valueInput = page.getByLabel("Value");
      await valueInput.fill("");
      await valueInput.fill("CORRECTED-VALUE");
      await page.getByRole("button", { name: "Save correction" }).click();
      await expect(page.getByText("Correction saved")).toBeVisible();

      const record = await request.get(`/api/mock/v1/records/${task.record_id}`);
      const recordBody = await record.json();
      const attr = (
        recordBody.attributes as {
          attribute: { code: string };
          status: string;
          provenance_kind: string | null;
          value_display: string | null;
        }[]
      ).find((a) => a.attribute.code === task.attribute_code);
      expect(attr?.status).toBe("ACCEPTED");
      expect(attr?.provenance_kind).toBe("HUMAN");
      expect(attr?.value_display).toBe("CORRECTED-VALUE");
    });
  });

  test.describe("The F5 hero task (wrong-row reattach)", () => {
    test("reattaching evidence to a different cell corrects the value and resolves the task", async ({
      page,
      request,
    }) => {
      const tasks = await fetchOpenTasks(request, "VERIFICATION_FAILED");
      const hero = tasks.find(
        (t) => t.record_mpn === "ABC-123" && t.attribute_code === "seat_material",
      );
      test.skip(!hero, "ABC-123 wrong-row hero task is not open in this fixture run");

      await page.goto(`/review/${hero!.id}`);
      await expect(page.getByTestId("task-card")).toContainText("ABC-123");
      await expect(page.getByTestId("task-card")).toContainText("row 15, not the bound row 14");

      await page.getByRole("button", { name: "[D] Reattach" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByTestId("document-viewer")).toBeVisible();

      const candidate = dialog
        .getByRole("group", { name: "Candidate cells" })
        .getByRole("button")
        .first();
      await candidate.waitFor();
      const candidateText = await candidate.innerText();
      await candidate.click();

      const confirm = dialog.getByRole("button", { name: /^Use this cell/ });
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(page.getByText("Correction saved")).toBeVisible();

      const record = await request.get(`/api/mock/v1/records/${hero!.record_id}`);
      const recordBody = await record.json();
      const attr = (
        recordBody.attributes as {
          attribute: { code: string };
          provenance_kind: string | null;
          value_display: string | null;
        }[]
      ).find((a) => a.attribute.code === "seat_material");
      expect(attr?.provenance_kind).toBe("HUMAN");
      expect(candidateText).toContain(attr?.value_display ?? "");
    });
  });

  test.describe("Tier 0 cannot be accepted (flow 6, INV-9)", () => {
    test("Tier 0 tasks offer Approve, never Accept, in the UI", async ({ page, request }) => {
      const [task] = await fetchOpenTasks(request, "TIER0_APPROVAL");
      test.skip(!task, "No TIER0_APPROVAL task available in this fixture run");

      await page.goto(`/review/${task.id}`);
      await expect(page.getByTestId("task-card")).toContainText(task.record_mpn);
      await expect(page.getByRole("button", { name: "[A] Approve" })).toBeVisible();
      await expect(page.getByRole("button", { name: "[A] Accept" })).toHaveCount(0);
    });

    test("the server itself refuses to accept a Tier 0 task (defence in depth)", async ({
      request,
    }) => {
      const [task] = await fetchOpenTasks(request, "TIER0_APPROVAL");
      test.skip(!task, "No TIER0_APPROVAL task available in this fixture run");

      const res = await request.post(`/api/mock/v1/review/tasks/${task.id}/accept`, {
        headers: { "X-Correlation-Id": "test-tier0-accept" },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("POLICY_BLOCKED");
    });

    test("approving a Tier 0 task works and resolves it", async ({ page, request }) => {
      const [task] = await fetchOpenTasks(request, "TIER0_APPROVAL");
      test.skip(!task, "No TIER0_APPROVAL task available in this fixture run");

      await page.goto(`/review/${task.id}`);
      await page.getByRole("button", { name: "[A] Approve" }).click();
      await expect(page.getByText("Approved (Tier 0)")).toBeVisible();
    });
  });

  test.describe("Keyboard-only review of 3 tasks (flow 9)", () => {
    test("three tasks are resolved end to end with zero mouse events", async ({ page }) => {
      await page.goto("/review");
      await expect(page.getByTestId("task-card")).toBeVisible();

      for (let i = 0; i < 3; i++) {
        const before = await page.getByTestId("task-card").innerText();
        // The primary action is always "[A] Accept" or "[A] Approve" depending on tier
        // -- either way, "a" is the one key that resolves whatever task is focused.
        await page.keyboard.press("a");
        await expect
          .poll(async () =>
            page
              .getByTestId("task-card")
              .innerText()
              .catch(() => ""),
          )
          .not.toBe(before);
      }
    });

    test("J/K navigate without deciding anything, Enter advances", async ({ page }) => {
      await page.goto("/review");
      await expect(page.getByTestId("task-card")).toBeVisible();
      const first = await page.getByTestId("task-card").innerText();

      await page.keyboard.press("j");
      await expect.poll(() => page.getByTestId("task-card").innerText()).not.toBe(first);
      const second = await page.getByTestId("task-card").innerText();

      await page.keyboard.press("k");
      await expect.poll(() => page.getByTestId("task-card").innerText()).toBe(first);

      await page.keyboard.press("Enter");
      await expect.poll(() => page.getByTestId("task-card").innerText()).toBe(second);
    });

    test("the ? overlay lists the review shortcuts", async ({ page }) => {
      await page.goto("/review");
      await expect(page.getByTestId("task-card")).toBeVisible();
      await page.keyboard.press("Shift+?");
      const dialog = page.getByRole("dialog").filter({ hasText: "Keyboard shortcuts" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Review decisions")).toBeVisible();
      await expect(dialog.getByText("Review navigation")).toBeVisible();
    });
  });

  test.describe("Reject and mark Unknown", () => {
    test("rejecting a proposed value turns it into Unknown with a machine-readable reason", async ({
      page,
      request,
    }) => {
      const tasks = await fetchOpenTasks(request, "VERIFICATION_FAILED");
      const task = tasks[0];
      test.skip(!task, "No VERIFICATION_FAILED task available in this fixture run");

      await page.goto(`/review/${task.id}`);
      await page.getByRole("button", { name: "[R] Reject → Unknown" }).click();
      await expect(page.getByText("Rejected → Unknown")).toBeVisible();

      const record = await request.get(`/api/mock/v1/records/${task.record_id}`);
      const recordBody = await record.json();
      const attr = (
        recordBody.attributes as {
          attribute: { code: string };
          status: string;
          unknown_reason: string | null;
        }[]
      ).find((a) => a.attribute.code === task.attribute_code);
      expect(attr?.status).toBe("UNKNOWN");
      expect(attr?.unknown_reason).toBeTruthy();
    });

    test("a task with no proposed value offers Mark Unknown, not Reject", async ({
      page,
      request,
    }) => {
      const [task] = await fetchOpenTasks(request, "NO_DOCUMENT");
      test.skip(!task, "No NO_DOCUMENT task available in this fixture run");

      await page.goto(`/review/${task.id}`);
      await expect(page.getByRole("button", { name: "[U] Mark Unknown" })).toBeVisible();
      await expect(page.getByRole("button", { name: "[R] Reject → Unknown" })).toHaveCount(0);
      await page.getByRole("button", { name: "[U] Mark Unknown" }).click();
      await expect(page.getByText("Marked Unknown")).toBeVisible();
    });
  });

  test.describe("Bulk apply to similar tasks", () => {
    test("bulk-accepting a similar group resolves all of them and reports a summary", async ({
      page,
      request,
    }) => {
      const [belowThreshold, verificationFailed] = await Promise.all([
        fetchOpenTasks(request, "BELOW_THRESHOLD"),
        fetchOpenTasks(request, "VERIFICATION_FAILED"),
      ]);
      const groups = new Map<string, TaskWire[]>();
      for (const t of [...belowThreshold, ...verificationFailed]) {
        if (!t.document_version_id) continue;
        const key = `${t.reason_code}::${t.attribute_code}::${t.document_version_id}`;
        const group = groups.get(key) ?? [];
        group.push(t);
        groups.set(key, group);
      }
      const eligible = [...groups.values()].find((g) => g.length >= 2);
      test.skip(
        !eligible,
        "No document shares 2+ open tasks on the same attribute in this fixture run",
      );

      const anchor = eligible![0];
      // Deep-linking straight to `anchor.id` forces "ALL" mode, which pages in lazily
      // and stops as soon as the anchor itself is found — the *other* group member(s)
      // may not be loaded yet, under-reporting `similarTaskCount`. Selecting the tab
      // instead issues the exact same `reason_code`-filtered, limit-100 fetch this test
      // already used to discover the group, so both members are guaranteed loaded —
      // then step to the anchor's known position with the keyboard (still zero mouse
      // events for the decision itself).
      const tabTasks =
        anchor.reason_code === "BELOW_THRESHOLD" ? belowThreshold : verificationFailed;
      const tabLabel =
        anchor.reason_code === "BELOW_THRESHOLD" ? "Below threshold" : "Verification failed";
      const anchorIndex = tabTasks.findIndex((t) => t.id === anchor.id);

      await page.goto("/review");
      await page.getByTestId("reason-tab").filter({ hasText: tabLabel }).click();
      await expect(page.getByTestId("task-card")).toBeVisible();
      for (let i = 0; i < anchorIndex; i++) {
        await page.keyboard.press("j");
      }
      await expect(page.getByTestId("task-card")).toContainText(anchor.record_mpn);

      const similarIds = eligible!.filter((t) => t.id !== anchor.id).map((t) => t.id);

      const bulkButton = page.getByRole("button", { name: /^\[B\] Bulk/ });
      await expect(bulkButton).toBeEnabled();
      await bulkButton.click();
      await expect(
        page.getByRole("dialog").getByText(/Bulk apply to \d+ similar task/),
      ).toBeVisible();

      // Assert on the durable result (the mutation's own response, and the tasks it
      // named actually leaving the "open" state) rather than the toast's ephemeral
      // visibility — sonner's auto-dismiss duration can race a `getByText(...)` poll
      // under load in a way that reflects nothing about whether bulk apply worked.
      const bulkResponse = page.waitForResponse((r) => r.url().includes("/review/bulk"));
      await page.getByRole("button", { name: "Accept all" }).click();
      const res = await bulkResponse;
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { applied: number; skipped: number; total: number };
      expect(body.applied).toBeGreaterThan(0);

      await expect(async () => {
        const stillOpen = await fetchOpenTasks(request, anchor.reason_code);
        const stillOpenIds = new Set(stillOpen.map((t) => t.id));
        for (const id of similarIds) {
          expect(stillOpenIds.has(id)).toBe(false);
        }
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe("Deep link to a resolved/nonexistent task", () => {
    test("shows a clear not-open state instead of hanging or crashing", async ({ page }) => {
      await page.goto("/review/task_does_not_exist_e2e");
      await expect(page.getByText("This task is no longer open")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Review Queue" })).toBeVisible();
    });
  });

  test.describe("Responsive (docs/06-frontend.md section 9)", () => {
    test("under 768px shows the desktop-workflow notice instead of the decision bar", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 480, height: 900 });
      await page.goto("/review");
      await expect(page.getByText("Review is a desktop workflow")).toBeVisible();
      await expect(page.getByTestId("decision-bar")).toHaveCount(0);
    });

    for (const width of [1440, 1280, 1024]) {
      test(`review is usable at ${width}px - no horizontal page overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/review");
        await expect(page.getByTestId("task-card")).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(overflow).toBe(false);
      });
    }
  });

  test.describe("Accessibility", () => {
    test("a populated queue has zero axe violations, in both themes", async ({ page }) => {
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto("/review");
        await expect(page.getByTestId("task-card")).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .exclude("iframe")
          .analyze();
        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      }
    });
  });
});
