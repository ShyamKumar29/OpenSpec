import { test, expect } from "@playwright/test";

/**
 * F6 — Dashboard (docs/14-frontend-implementation-plan.md §6 F6). Covers: the metrics rail
 * and the command-center hero render real, non-fabricated numbers computed from the
 * fixture store; every tile, callout and node is traceable/navigable; the dashboard is a
 * *command center* and fits one desktop viewport without scrolling; responsive behaviour
 * at the four required widths (docs/06-frontend.md §9); and — the mock-layer bug this
 * work also fixes — that record-level aggregates (`completeness`, `tier0_pending_count`,
 * `unknown_count`) are *live*, not a build-time snapshot frozen at server start (risk
 * F-3; `01-requirements.md` FR-DSH's acceptance criterion "dashboard numbers reconcile
 * with the database").
 *
 * The detailed analytical panels the dashboard used to embed — the completeness
 * histogram, the STP Wilson intervals, the Unknown-reason breakdown, the cost/throughput
 * panels, the quality trend — are deliberately *not* asserted here any more: they belong
 * to `/catalog`, `/review` and `/evaluation`, and the dashboard now summarises and links
 * to them instead of reproducing them below the fold.
 *
 * The last test mutates the shared in-memory mock store over real HTTP, the same way the
 * app itself does, rather than clicking through the UI — deliberately, so it proves the
 * fix at the same layer the bug lived in (`GET /records`, `GET /records/{id}`) without
 * depending on brittle DOM selectors, and picks a record other than the canonical demo
 * record (`rec_canonical_abc123`) so it never disturbs the Tier-0/ANSI-Class fixture
 * state other spec files (`catalog.spec.ts`) assert on.
 */

test.describe("Dashboard — one viewport communicates system state at a glance", () => {
  test("the metrics rail renders real numbers computed from the fixture store, not placeholders", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("kpi-catalog-records")).toContainText("240");
    await expect(page.getByTestId("kpi-stp-all")).toContainText("%");
    await expect(page.getByTestId("kpi-stp-auto")).toContainText("%");
    await expect(page.getByTestId("kpi-open-workload")).toBeVisible();
    await expect(page.getByTestId("kpi-cost-per-sku")).toContainText("$");
    await expect(page.getByTestId("kpi-review-throughput")).toContainText("×");
    await expect(page.getByTestId("kpi-active-runs")).toBeVisible();

    // Never "Computed in F6" or any other placeholder text left over from the F0 shell.
    await expect(page.getByText("Computed in F6")).toHaveCount(0);
  });

  test("the whole dashboard fits a desktop viewport — it is a command center, not a report", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("command-center")).toBeVisible();
    await expect(page.getByTestId("pipeline-band")).toBeVisible();
    await expect(page.getByTestId("kpi-catalog-records")).toBeVisible();

    const { scrollH, clientH } = await page.evaluate(() => ({
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
    }));
    // A pixel of slack for sub-pixel layout rounding; anything more is a second screen.
    expect(scrollH).toBeLessThanOrEqual(clientH + 1);

    // The detailed analytical views live on their own pages now.
    await expect(page.getByText("Unknown reason breakdown")).toHaveCount(0);
    await expect(page.getByText("Quality trend")).toHaveCount(0);
  });

  test("the environment is the hero — it owns the majority of the page's vertical space", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const hero = await page.getByTestId("command-center").boundingBox();
    const rail = await page.getByTestId("kpi-catalog-records").boundingBox();
    const band = await page.getByTestId("pipeline-band").boundingBox();
    expect(hero!.height).toBeGreaterThan(rail!.height + band!.height);
    expect(hero!.height / 900).toBeGreaterThan(0.5);
  });

  test("the operations pulse narrates the in-flight run's real pipeline stages", async ({
    page,
  }) => {
    await page.goto("/");
    const pulse = page.getByTestId("operations-pulse");
    await expect(pulse).toBeVisible();

    const nodes = page.getByTestId("pipeline-node");
    await expect(nodes).toHaveCount(9);
    // The scripted `run_batch_in_flight` fixture has CLS/SCH/DOC/PRS done and EXT running
    // (mocks/fixtures/runs.ts) — this is real run state, not a decorative animation.
    await expect(nodes.filter({ hasText: "CLS" })).toHaveAttribute("data-state", "done");
    await expect(page.getByText(/Stages complete: \d\/9/)).toBeVisible();

    await page.getByTestId("operations-pulse-view-run").click();
    await expect(page).toHaveURL(/\/runs\/run_batch_in_flight/);
  });

  test("the compact pipeline strip shows all nine persisted stages and links to the run", async ({
    page,
  }) => {
    await page.goto("/");
    const band = page.getByTestId("pipeline-band");
    await expect(band.getByTestId("pipeline-band-node")).toHaveCount(9);
    await expect(band.getByTestId("pipeline-band-node").filter({ hasText: "CLS" })).toHaveAttribute(
      "data-state",
      "done",
    );
    // The href rather than a click: this strip re-renders on every `GET /runs` refetch,
    // and clicking it is the same navigation the operations-pulse test above already
    // exercises for real.
    await expect(page.getByTestId("pipeline-band-view-run")).toHaveAttribute(
      "href",
      "/runs/run_batch_in_flight",
    );
  });

  test("hotspot callouts surface real operational hotspots and click through to their owning page", async ({
    page,
  }) => {
    await page.goto("/");
    const callouts = page.getByTestId("insight-callout");
    // Seven major hotspots, never every metric: the rest of the numbers are on the metrics
    // rail or one click away. Asserted as an auto-retrying expectation rather than a bare
    // `count()` because the callout set fills in as `/review/counts` resolves.
    await expect(callouts).toHaveCount(7);

    // Not a hard-coded count: `review.spec.ts` resolves Tier-0 tasks in the same shared
    // mock store, so the number moves. That it is a real number from that store is what
    // the assertion is for.
    const tier0 = callouts.filter({ hasText: "Tier-0 gate" });
    await expect(tier0).toContainText(/\d+/);
    await tier0.click();
    // Generous, because this may be the first navigation to `/review` in this worker and
    // the dev server compiles the route on demand.
    await expect(page).toHaveURL(/\/review\?reason_code=TIER0_APPROVAL/, { timeout: 20_000 });
  });

  test("every hotspot callout points at the page that owns its number", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("insight-callout")).toHaveCount(7);
    const expected: [string, string][] = [
      ["Healthy enrichment", "/catalog?status=ACCEPTED"],
      ["Unknown hotspot", "/catalog?has_unknown_reason=true"],
      ["Tier-0 gate", "/review?reason_code=TIER0_APPROVAL"],
      ["Review workload", "/review"],
      ["Validation failures", "/review?reason_code=VERIFICATION_FAILED"],
      ["Document binding", "/review?reason_code=NO_DOCUMENT"],
      ["Active run", "/runs/run_batch_in_flight"],
    ];
    for (const [title, href] of expected) {
      const callout = page.getByTestId("insight-callout").filter({ hasText: title });
      await expect(callout).toHaveCount(1);
      await expect(callout).toHaveAttribute("href", href);
    }
  });

  test("the active-run hotspot and the pipeline strip below it agree about the same run", async ({
    page,
  }) => {
    await page.goto("/");
    // Both read the run's own persisted stage counters through `runProgress`, so a single
    // screen can never show two different percentages for one run.
    const hotspot = page.getByTestId("insight-callout").filter({ hasText: "Active run" });
    const percent = (await hotspot.innerText()).match(/(\d+)%/)?.[1];
    expect(percent).toBeTruthy();
    await expect(page.getByTestId("pipeline-band")).toContainText(`${percent}%`);
  });

  test("every data flow ends at a node that links into the page that owns it", async ({ page }) => {
    await page.goto("/");
    const nodes = page.getByTestId("command-channel");
    // One healthy outbound flow, the six review reason codes and the Unknown hotspot, all
    // eight in the stacked list; the three that no callout card reports on also get their
    // own marker chip out on the environment.
    await expect(nodes).toHaveCount(11);
    for (const href of await nodes.evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
      expect(href).toMatch(/^\/(catalog|review)/);
    }
  });

  test("the environment is the supplied reference plate, not a generated one", async ({ page }) => {
    await page.goto("/");
    // The scene is a static asset and decoration in full: every fact over it is HTML.
    const plate = page.getByTestId("command-center").locator('img[src*="command-center"]');
    await expect(plate).toHaveAttribute("alt", "");
    // …and it actually decoded, rather than silently 404ing to an empty frame. Polled
    // rather than read once: this is the page's LCP image and it is still in flight when
    // the rest of the dashboard has settled.
    await expect
      .poll(() => plate.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0);
  });

  test("the demo-data indicator is present (mock adapter is active) — risk F-5", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Demo data — no backend connected").first()).toBeVisible();
  });
});

test.describe("Dashboard responsive behaviour (docs/06-frontend.md §9)", () => {
  for (const width of [1440, 1280, 900, 480]) {
    test(`usable at ${width}px — no horizontal page overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
      await expect(page.getByTestId("kpi-catalog-records")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow).toBe(false);
    });
  }

  test("below the floating breakpoint every channel is still a plain, readable row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto("/");
    // The stacked list is the small-screen equivalent of the node layer — the same links,
    // no absolute positioning, and no reliance on being able to read the picture.
    const rows = page.getByTestId("command-channel");
    await expect(rows.filter({ hasText: "Commerce-ready" }).first()).toBeVisible();
    await expect(rows.filter({ hasText: "Tier-0 approval" }).first()).toBeVisible();
  });
});

test.describe("Live aggregates reconcile with the current mock state (F1/F5 fix, risk F-3)", () => {
  test("a Tier-0 approval decision is reflected in GET /records/{id} and GET /records immediately, for a non-canonical record", async ({
    request,
  }) => {
    // Picked from the *tail* of the TIER0_APPROVAL bucket, deliberately not `tasks[0]` —
    // e2e/review.spec.ts's Tier-0 tests pick from the front of the same bucket, and both
    // spec files can run in parallel workers against the one shared mock-store process
    // (Playwright's default `fullyParallel`); picking from opposite ends keeps the two
    // files' mutations from racing to resolve the same task.
    const tasksRes = await request.get(
      "/api/mock/v1/review/tasks?reason_code=TIER0_APPROVAL&limit=100&latency=0",
    );
    expect(tasksRes.ok()).toBe(true);
    const { items: tasks } = await tasksRes.json();
    const task = [...(tasks as { id: string; record_id: string; state: string }[])]
      .reverse()
      .find((t) => t.record_id !== "rec_canonical_abc123" && t.state === "open");
    test.skip(!task, "No non-canonical open TIER0_APPROVAL task available in this fixture run");

    const beforeRes = await request.get(`/api/mock/v1/records/${task!.record_id}?latency=0`);
    const before = await beforeRes.json();
    expect(before.tier0_pending_count).toBeGreaterThan(0);

    // Approve it — the same request the review queue's [A] button fires.
    const approveRes = await request.post(
      `/api/mock/v1/review/tasks/${task!.id}/approve?latency=0`,
    );
    expect(approveRes.ok()).toBe(true);

    // Both the record detail AND the catalog list summary must reflect it immediately —
    // before the F6 fix, both were frozen at server-start values.
    const afterDetailRes = await request.get(`/api/mock/v1/records/${task!.record_id}?latency=0`);
    const afterDetail = await afterDetailRes.json();
    expect(afterDetail.tier0_pending_count).toBe(before.tier0_pending_count - 1);
    expect(afterDetail.completeness.accepted).toBe(before.completeness.accepted + 1);

    // `q=` the record's own (unique) MPN rather than paginating a status filter, so this
    // assertion is exact regardless of how many other records share the same status.
    const afterListRes = await request.get(
      `/api/mock/v1/records?q=${encodeURIComponent(before.mpn_raw)}&latency=0`,
    );
    const { items: afterItems } = await afterListRes.json();
    const afterListEntry = (afterItems as { id: string; tier0_pending_count: number }[]).find(
      (r) => r.id === task!.record_id,
    );
    expect(afterListEntry?.tier0_pending_count).toBe(before.tier0_pending_count - 1);
  });
});
