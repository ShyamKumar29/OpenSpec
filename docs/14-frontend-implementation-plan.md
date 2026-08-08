# Phase 15 — Frontend Implementation Plan (F0–F7 + Polish)

> **Audience:** whoever is building the frontend. **Prerequisites:** `06-frontend.md`, `api.md`.
> **Status:** approved plan, not yet started. Repository currently contains documentation only —
> there is no `frontend/` directory and no git repository yet.
>
> **This document does not replace `06-frontend.md`.** That document says *what* the frontend is.
> This one says *in what order it gets built while the backend does not yet exist*, and which
> decisions that ordering forces. Where the two disagree, `06-frontend.md` wins and this file is
> wrong and must be corrected.

---

## 1. The deviation being made, stated plainly

`13-implementation-blueprint.md` §1 rule 3 says: **"Vertical slices, never horizontal layers. Never
'build all the backend, then all the frontend.'"** Risk K2 in that document names horizontal
building as a failure mode.

**We are deliberately building the frontend first, ahead of the backend.** This is a documented,
accepted deviation from the blueprint's ordering rule — not an oversight. It is accepted because:

- Two of the documentation's own recommendations *require* it. `api.md` §Recommendations 2: *"Design
  `/attributes/{id}/explain` before building the pipeline. What it must return determines what the
  pipeline must persist, and discovering that late is expensive."* `06-frontend.md`
  §Recommendations 3: *"Design the 'Why?' panel before the review queue."* Building the Why panel
  against real fixtures is the cheapest way to discover what the pipeline must persist.
- `DocumentViewer` is named the highest-risk single piece of frontend work (risk E2). Retiring it
  early against synthetic fixtures with *known* coordinates is strictly better than retiring it
  against a parser that is itself new.

**The mitigations that keep the deviation honest** — these are binding, not aspirational:

| # | Mitigation |
|---|---|
| D1 | The mock layer implements **`api.md` routes literally** — same paths, same `snake_case` wire shapes, same RFC 9457 errors, same cursor pagination, same SSE event shape. It is a mock *server*, not a mock *service layer*. |
| D2 | **No endpoint may exist in the mock that does not exist in `api.md`.** If the UI needs more, `api.md` changes first, in the same PR. The treaty rule survives the reordering. |
| D3 | Every frontend phase is still a vertical slice: UI → query hook → typed contract → HTTP → mock handler. Nothing is stubbed at the component level. |
| D4 | Backend integration is a **base-URL change plus deleting `app/api/mock/`**. If any phase makes that untrue, that phase is not done. |

---

## 2. Verdict on the proposed phase order

The proposed order **F0 → F1 → F2+F3 → F4 → F5 → F6 → F7 → Polish** is accepted, with three
amendments.

| | Amendment | Reason |
|---|---|---|
| **A1** | **F0 gains a mandatory sub-phase `F0.5 — Contracts & Fixture Universe`**, completed and reviewed before any page beyond the shell is built. | Every phase from F1 on consumes the same DTOs and the same seed dataset. Authoring fixtures per-page produces a catalog whose numbers do not reconcile with its dashboard — which, in a product whose thesis is trust, is the worst possible bug to demo. |
| **A2** | **F5 (Review Queue) has a protected budget and cannot be compressed to fund F4 (Judge Mode).** If the schedule slips, Judge Mode ships with two scenarios instead of three; the review queue does not lose prefetch or the throughput meter. | FR-RVW-9 (≥5× baseline) is the economic claim. Judge Mode is the presentation of it. Risk E3 is precisely "review UI is beautiful but slow, failing the 5× claim". |
| **A3** | **`/` (Dashboard) ships a credible shell in F0, not a blank page**, and is filled in at F6. | It is the first route anyone opens, including a judge clicking a preview link mid-build. |

F4 before F5 is kept as proposed: Judge Mode's run-event abstraction (§6.4) is shared infrastructure
reused by `/runs/:id` and by the record-detail *Re-enrich* action, so building it first is not
wasted work.

---

## 3. Conflicts found between the brief and the documentation

Resolved as below. None require a change to an architectural decision.

### C1 — Product domain: PVF only, not mixed industrial

The brief suggests mock products including *circuit breakers, LED luminaires, safety gloves*.
`docs/domain/pvf-reference.md` §2 scopes the taxonomy to **five PVF classes**: bronze/brass ball
valves · gate/globe/check valves · copper/brass pipe fittings · PVC/CPVC valves & fittings ·
pressure gauges & backflow preventers.

**Resolution: mock data uses the five documented PVF classes only.** Electrical and PPE products
would imply a taxonomy that does not exist, break every validation rule and unit trap in the
reference, and dilute the demo. Breadth of *record state* (§4.2) is what makes the catalog feel
real — not breadth of product category.

### C2 — Mock metrics on the Dashboard and Evaluation pages

`CLAUDE.md` working agreements: *"Report honestly. Real evaluation numbers before synthetic ones,
always, including in the pitch."* FR-EVL-4 requires real and synthetic slices reported separately
and labelled. F6 and F7 will render numbers that are entirely fabricated.

**Resolution:** a **data-provenance indicator is a first-class, non-removable UI element** while the
mock adapter is active:

- A persistent `DEMO DATA — no backend connected` marker in the app shell, driven by the API mode,
  not by a hardcoded flag in a component.
- `/evaluation` and `/` additionally label every metric block with its source (`fixture` /
  `eval run <id>`), which is a control we keep permanently — it is exactly what FR-EVL-4 asks for
  once the numbers are real.
- Fabricated metrics are **plausible and imperfect**, consistent with the QR targets in
  `01-requirements.md` §4 (e.g. STP ~58%, precision ~98.2%, ECE ~0.04, over-abstention ~15%), never
  round, never 100% except QR-8/QR-9 which are structural.

### C3 — Evidence bounding-box coordinate system is under-specified

`api.md` gives `bbox: [312, 480, 372, 494]` with no unit, origin, or DPI, and
`GET /documents/{version_id}/pages/{n}/image` returns an image with no dimension metadata. Risk E1
("highlight is 12px off") lives entirely in this gap.

**Resolution — smallest viable change, to be reflected in `api.md` when the frontend needs it:**

1. **The `DocumentViewer` component consumes normalised rectangles only** — `[x0, y0, x1, y1]` as
   fractions of page width/height in `[0,1]`, origin top-left. The component is therefore DPI-,
   zoom-, and device-pixel-ratio independent by construction.
2. Conversion from the wire format happens **once**, in the contract adapter, nowhere else.
3. To make that conversion possible, `GET /documents/{version_id}` must expose per-page dimensions.
   Proposed addition to `api.md` (additive, non-breaking):
   ```json
   "pages": [ { "n": 1, "width_px": 1700, "height_px": 2200, "dpi": 200 } ]
   ```
   Plus a stated convention: `bbox` is in the same pixel space as the rendered page image, origin
   top-left. This is what "share a coordinate system by construction" (`api.md` §Documents) means
   made explicit.

**This is the one item requiring a doc change before F2.** It is additive and preserves the original
intent; it is recorded here rather than actioned so the API owner approves it.

### C4 — Mock page images

Server-side rasterisation (ADR-0012) means the frontend never renders a PDF. Fixtures must therefore
supply page *images*.

**Resolution:** fixture pages are **generated as static SVG datasheet pages** committed to
`frontend/public/mock/pages/`, with the table geometry authored by us. Consequences: exact known
bbox positions for the visual-regression fixture required by `09-testing.md` §7; no binary blobs in
git; no manufacturer IP in the repo; the family-table row-binding demo beat is pixel-reproducible.
One real rasterised page may be added later for screenshot fidelity — the component does not care.

### C5 — Milestone tags

`07-devops.md` §2 defines tags `m0…m6`. The brief proposes `frontend-f0…frontend-polish`.

**Resolution:** both, no collision. `frontend-f*` tags mark frontend phase gates; `m*` tags remain
reserved for whole-system milestone gates and are only cut when backend and frontend both meet the
milestone checklist in `10-roadmap.md`. `git init` happens as the first action of F0 — the
repository is not yet under version control.

### C6 — Route inventory

The brief's route list matches `06-frontend.md` §2 exactly. `/export` is correctly *not* a route —
export is an action from `/catalog` and `/catalog/:id`, per `api.md` §Export. No change.

---

## 4. Frontend-only data strategy

### 4.1 The boundary

```
  React components  ──────────────────────────────────  know nothing about mocks
        ↓  (hooks only, never fetch directly)
  lib/queries/*        TanStack Query hooks, query keys, prefetch rules
        ↓
  lib/contracts/*      zod schemas mirroring api.md wire DTOs (snake_case)
                       + parse/adapt to camelCase domain types  ← the ONLY mapping point
        ↓
  lib/api/client.ts    fetch wrapper: base URL, RFC 9457 errors, X-Correlation-Id, cursors
        ↓  HTTP
  app/api/mock/v1/**   Next.js Route Handlers implementing api.md   ← deleted at integration
        ↓
  mocks/fixtures/**    the single canonical seed dataset
```

**Decision: the mock is a Next.js Route Handler server, not MSW, for the application.** Rationale:

- It is real HTTP. Latency, streaming, error codes, cursor pagination and SSE are exercised for
  real, so the integration swap changes a URL and nothing else (D4).
- It works identically in `next dev`, in a Vercel preview deploy, and under Playwright — no
  service-worker registration, no test-only code path, no "works in dev, not in E2E" class of bug.
- Deletion is unambiguous: remove one directory, set `NEXT_PUBLIC_API_BASE_URL`.

MSW is used **only** in Vitest component tests, where booting a route handler is not appropriate.
Both drive the same fixture modules, so there is one source of truth for mock data.

`NEXT_PUBLIC_API_BASE_URL` defaults to `/api/mock/v1` and is the only place a backend URL appears.

### 4.2 The fixture universe (F0.5 — build this once, carefully)

**One connected dataset**, not per-page fakes. The demo journey in the brief §24 requires the same
record to appear coherently across catalog → detail → why → viewer → review → dashboard → judge, and
the dashboard's numbers must be *computed from* the record fixtures, never hand-typed.

| Fixture set | Size | Notes |
|---|---|---|
| `taxonomy` | 5 classes, ~80 attribute definitions | From `pvf-reference.md` §2–3. Ball valve schema (22 mandatory, 6 at Tier 0) is authored in full. |
| `records` | ~240 | Realistic thin distributor rows: `1/2 BRS BALL VLV 600WOG`, `3/4 CPLG CxC WROT CU`, `1-1/4 GATE VLV BRZ 200WOG`. Abbreviations from §8 of the reference. |
| `documents` | ~18 | Family datasheets, submittal sheets, one unparseable, one with an unresolvable revision conflict. Each with generated SVG pages + a region tree. |
| `attribute_values` | ~3,500 | Generated from records × schema, with the state distribution below. |
| `review_tasks` | ~410 | Distributed across all six reason codes; counts must equal the queue tab counts. |
| `runs` / `run events` | 6 scripted | Three Judge Mode scenarios + three catalog runs (complete, in-flight, failed). |
| `eval_runs` | 5 historical | Produces the quality trend on `/` and the frontier/reliability/ablation on `/evaluation`. |

**Mandatory state coverage** (from the brief §23, cross-checked against `01-requirements.md`):

- *Record states*: healthy · incomplete · partially enriched · awaiting Tier-0 approval · Unknown-heavy · unclassified (`CLASS_UNRESOLVED`) · unbound (no document) · conflicting sources.
- *Value states*: `ACCEPTED` · `NEEDS_REVIEW` · `NEEDS_APPROVAL` · `UNKNOWN` · `SUPERSEDED` (with a visible supersession chain on at least three values).
- *Provenance*: `EXTRACTED` · `DERIVED` (an `FIP → NPT_FEMALE` synonym mapping) · `INFERRED` (body material from description, unconfirmed) · `HUMAN` (a reviewer correction).
- *Evidence*: exact span · row-bound in a family table · ambiguous (two candidate rows) · wrong-row (the F5 hero task) · missing.
- *Unknown reasons*: all thirteen codes from `api.md` appear at least once; the six review reason codes carry realistic volume.

**Three canonical demo objects, referenced by ID everywhere:**

| Object | Purpose |
|---|---|
| `ABC-123` — `1/2 BRS BALL VLV 600WOG` | The demo record. Carries the highlighted family-table row (beat 3), the ANSI-Class-from-WOG refusal (beat 4), and the Tier-0 `AWAITING APPROVAL` pressure rating at 0.97 (beat 5). |
| Review task `wrong-row` | Proposed `Seat Material = PTFE` whose span came from row 15, not bound row 14 — the F5 hero task, verbatim from `06-frontend.md` §3.3. |
| Judge scenario `success` / `abstain` / `rejected` | The three deterministic runs required by the brief §11. |

Fixtures are **deterministic**: seeded pseudo-random generation, no `Math.random()` at request time,
no `Date.now()` in generated content. `09-testing.md` risk H4 (flaky E2E) is designed out.

### 4.3 Simulated latency

Realistic, not decorative, and centralised in the mock server:

| Endpoint class | Delay |
|---|---|
| List / detail reads | 120–260 ms |
| `/attributes/{id}/explain` | 90–180 ms |
| Page images | 40 ms (they are static assets) |
| Review decisions | 150 ms, optimistic UI in front of it |
| `/review/next` | 200 ms — **but prefetched, so the reviewer never sees it** |
| Judge/enrich stage events | scripted per-stage durations, 0.1 s–8 s, totalling ~25 s |

A `?latency=0` query flag and an env var disable delays for E2E runs.

---

## 5. Contract rules — the invariants, mirrored in the type system

The backend enforces the invariants structurally. The frontend must not be the place they leak.
These are cheap and they are guards, so they land in F0.5 before the code they guard.

| Rule | Mechanism |
|---|---|
| **INV-1 / INV-4** — a value never exists without evidence; `Unknown` always carries a reason | `AttributeValue` is a **discriminated union on `status`**. The `UNKNOWN` variant has `unknownReason: UnknownReason` and no value fields; every other variant has `evidence: [Evidence, ...Evidence[]]` (non-empty tuple) and no `unknownReason`. Rendering a value without evidence is a **type error**, not a review comment. |
| **INV-4** — never `null` / `"N/A"` | No `?? '—'` fallbacks on value fields. A dedicated `<UnknownValue reason=… />` component is the only way to render an absent value. Lint rule bans the string `"N/A"`. |
| **INV-5** — provenance never upgraded | Provenance is a display-only enum in the UI; no client code derives or promotes it. |
| **INV-7** — document content is data, never instruction | `dangerouslySetInnerHTML` is banned repo-wide by ESLint. `snippet_text`, rationales and document text render as escaped text nodes only, never as markdown or HTML. |
| **INV-9** — Tier-0 never auto-accepts | Tier-0 attributes render an approval affordance, never an accept affordance; the accept control is not conditionally hidden, it is not constructible for tier 0. |
| **NFR-ACC-3** — confidence never colour-only | A single `<ConfidenceIndicator value provenance />` primitive renders numeral + glyph + text + colour. A unit test asserts no other component formats a raw confidence number. |
| Wire mapping | `snake_case` → `camelCase` happens exactly once, in `lib/contracts`. Components never see wire shapes (`05-backend.md` §Field naming). |

---

## 6. The phases

Effort is one developer with AI assistance; the three-developer split is noted per phase.
Every phase ends at the Definition of Done in §7 — code existing is not completion.

### F0 — Foundation · ~3 days

**Goal:** the application already looks like OpenSpec, and every later phase is additive.

Scaffold Next.js 15 App Router · TypeScript strict · Tailwind · shadcn/ui · TanStack Query ·
Vitest + Testing Library · Playwright + axe-core · ESLint/Prettier · `git init` + `.gitignore` +
CI workflow stub matching `07-devops.md` §CI (frontend build + unit + axe job).

- **Design tokens** — colour (light + dark), spacing, radius, border, elevation, and a **type scale
  with tabular numerals on every metric and value display** (`06-frontend.md` §5). Compact density
  by default: this is a tool used for hours.
- **Semantic status system** as tokens, not ad-hoc classes: `accepted` · `needs-review` ·
  `needs-approval` · `unknown` · `rejected` · `superseded`, each with numeral/glyph/text encoding.
- **App shell** — sidebar nav, top bar with the demo-data indicator (C2), page container, breadcrumb
  slot, responsive behaviour per `06-frontend.md` §9.
- **Primitives** — button, input, select, dialog, drawer, dropdown, tabs, tooltip, badge, card,
  table, popover, toast. shadcn/ui provides the Radix behaviour; we own the tokens and density.
- **Command palette (⌘K)** and the **keyboard shortcut registry** — a single registry that owns
  bindings, scopes, and the `?` overlay. Built now because F5 depends on it and retrofitting a
  shortcut system across pages is a rewrite.
- **State primitives** — loading skeletons, empty, error (RFC 9457-aware), and confirmation patterns,
  as shared components so no page invents its own.
- **Routes** — all thirteen exist and are navigable. `/` gets a credible dashboard shell (A3);
  others get honest "in progress" states, never a blank page.
- **F0.5 — Contracts & Fixture Universe** (§4.2, §5). Reviewed as its own PR.

**Out of scope:** any real page content beyond the shell; charts; the document viewer.

**Parallelisation:** dev A tokens + primitives · dev B shell + nav + command palette · dev C
contracts + fixtures. Fixture work is the critical path for F1.

### F1 — Catalog + Record Detail · ~4 days

**Goal:** the first complete product workflow, and the surface the other phases hang from.

- `/catalog` — virtualised table (TanStack Virtual), cursor pagination, **URL-driven** search /
  filter / sort (`06-frontend.md` §6: filters live in the URL, never in component state).
  Columns: MPN · description · class + classification confidence · completeness bar · status mix ·
  Tier-0 pending · Unknown count. Filters mirror `GET /records` exactly: `class_id`, `status`,
  `completeness_lt`, `supplier`, `q`, `has_unknown_reason`.
- `/catalog/:id` — the layout from `06-frontend.md` §3.1: header (MPN, supplier, class + confidence,
  completeness), attribute panel grouped by conceptual section (Identification · Dimensional ·
  Pressure/Temperature · Materials · Compliance), document pane placeholder reserved for F2.
- `AttributeRow` composes **`ValueDisplay` · `ConfidenceIndicator` · `ProvenanceChip` ·
  `TierBadge` · `StatusChip` · `[why?]`** as separate concepts. Value, confidence, provenance,
  status, evidence and policy are never flattened into one column.
- `Unknown` values render reason code + fix owner + remediation hint (`01-requirements.md` §1.2).
- Actions: Export, Re-enrich, Reclassify — wired to mock endpoints, real optimistic behaviour.

**Definition of hero state:** opening `ABC-123` shows the Tier-0 gate and the ANSI-Class refusal
without scrolling on a 1440px screen.

### F2 + F3 — DocumentViewer, Why Panel, Provenance · ~6 days (the highest-risk phase)

Built together because the Why panel's `[show on page ▸]` is the interaction that justifies both.

**F2 — `DocumentViewer`**
- Consumes: document metadata · page number · page image URL · region tree · evidence spans, all in
  **normalised coordinates** (C3). No PDF is parsed client-side.
- Features: page navigation + counter, zoom, fit-to-view, span highlight, region overlay, evidence
  selection, keyboard navigation, expanded/fullscreen, loading / unavailable-document /
  invalid-evidence states, responsive split-to-drawer behaviour.
- **Coordinate fixture test is a deliverable, not a follow-up**: a fixture page with rectangles at
  known normalised positions, asserted by a Playwright screenshot comparison. Risk E1 is retired
  here or it is not retired at all.

**F3 — Why panel** — the layout in `06-frontend.md` §3.2, rendered entirely from structured
provenance (`GET /attributes/{id}/explain`). Sections: **Evidence** (document, revision, page,
table/row/cell, verbatim, context, *show on page*) · **Verification** (deterministic span check,
verdict, rationale, verifier model) · **Validation** (rule IDs, pass/fail, cross-field, skips) ·
**Normalisation** (the transform chain, raw → parsed → canonical, with the rule ID per step) ·
**Confidence** (the signal vector, never a model self-report) · **Policy** (tier note).

- **Never LLM-narrated.** All prose is templated from stored fields. The `rationale` string is the
  only model-authored text and it is labelled as the verifier's output.
- Reachable in **one click from any attribute row**, on Record Detail and in Review. Target: panel
  open and evidence highlighted in under 200 ms perceived.
- The `Unknown` variant of the panel is as complete as the value variant (FR-EXP-3) — the ANSI Class
  case must explain *why deriving it from WOG is refused*, citing rule NRM-17.

### F4 — Judge Mode · ~3 days

- `/judge` — MPN + description input, optional document drop, three deterministic scenarios.
- **Run-event abstraction**: a `RunEventSource` port with a scripted mock implementation now and an
  SSE implementation later; `api.md` §Runs already anticipates a polling fallback (risk M3), so the
  abstraction is justified rather than speculative. Reused by `/runs/:id` and Re-enrich.
- Stage timeline across `CLS · SCH · DOC · PRS · EXT · VER · VAL · NRM · CNF` with per-stage state,
  progress, duration, and a live counter of extracted / unknown / rejected plus running cost —
  matching `06-frontend.md` §3.4. Motion is purposeful and respects `prefers-reduced-motion`; this
  is the one substantially animated surface in the product.
- Scenarios: **success** · **evidence missing → Unknown** · **proposed value rejected → review**.
  Plus graceful partial results on timeout (FR-JDG-4) and a hostile-input path (FR-JDG-1/5).
- Completion hands off into the F1/F3 surfaces — the run result links straight to the Why panel.

### F5 — Review Queue · ~5 days · **protected budget (A2)**

- Queue sidebar with reason-code tabs and counts (`GET /review/tasks/counts`), open count, and time
  remaining at current rate.
- Task view: proposed value · rejection reason · evidence in the shared `DocumentViewer` · decision
  bar · edit flow · reattach evidence · skip · bulk apply to similar tasks in the same document.
- **Keyboard-first**: `J`/`K` navigate · `A` accept · `R` reject → Unknown · `E` edit · `U` unknown ·
  `D` reattach · `S` skip · `B` bulk · `Enter` next · `?` overlay. Handlers **never await the
  network**; optimistic with rollback (NFR-PERF-8, ≤100 ms).
- **Prefetch task *n+1* and its page image when task *n* opens** — in the first version, not a
  polish pass (risk E3, `06-frontend.md` §6).
- **Throughput meter from the first version** — resolved count, rate/hour, median decision time,
  against a configurable manual baseline. It is the business case rendered on the reviewer's screen.
- Session state (position, stats) in `sessionStorage`, surviving refresh (FR-RVW-10).
- Tier-0 tasks expose *approve*, never *accept*, and only for the approver role (INV-9).
- **Gate: three tasks resolved with zero mouse events**, asserted in Playwright (`09-testing.md` §7 flow 9).

### F6 — Dashboard · ~2.5 days

Every tile maps to a named requirement — risk E4 ("vanity metrics") is designed out by construction.

| Tile | Requirement |
|---|---|
| Catalog health · completeness distribution | FR-DSH-1 |
| STP — *all mandatory* **and** *auto-eligible only* | QR-3 / QR-4 |
| `Unknown` reason-code breakdown, routed by fix owner | `01-requirements.md` §1.2 |
| Cost per SKU vs configurable manual baseline | NFR-CST-1, FR-DSH-3 |
| Review throughput vs baseline · workload remaining | FR-RVW-9 |
| Quality trend across eval runs | FR-DSH-4 |
| Active runs / enrichment progress | FR-DSH-5 |

Charts are **lightweight inline SVG**, no charting library (`06-frontend.md` §7). Every number is
computed from the fixture store so it reconciles with the catalog — the manual QA line "dashboard
numbers reconcile with the database" must pass against mocks too.

### F7 — Evaluation · ~2.5 days

Frontier chart (with the "generic LLM, no abstention" baseline point plotted) · reliability diagram ·
per-slice table · ablation table · classification metrics · **Wilson confidence intervals on every
rate** (ASM-7 — no bare point estimates) · **real slice first, synthetic second, always labelled**
(FR-EVL-4) · run history with deltas · plain-language "what this metric means" for each chart.

Numbers per C2: plausible, imperfect, sourced-labelled.

### Additional routes · folded into the phases above

| Route | Phase | Depth |
|---|---|---|
| `/documents`, `/documents/:id` | F2 | Corpus browser, parse/binding status, bound-record count, unbound records, document health. Full implementation — it shares the viewer. |
| `/runs/:id` | F4 | Full — reuses the stage timeline and run-event source. |
| `/import` | F6 | Full: drag/drop, column mapping, validation preview, row-level errors, progress, completion. It is demo beat 1 and E2E flow 1. |
| `/settings` | F7 | Polished shell: schema browser (read-only, real taxonomy fixtures), threshold and tier-policy views clearly marked read-only until the admin API exists (Track B in `api.md`). |

### Polish · ~3 days

A dedicated pass, not a victory lap. Full-screen sweep of every route for spacing, alignment,
hierarchy, hover/focus states, overflow, scroll containment, dark mode, terminology consistency,
copy, and dead UI. Plus: full axe pass on all routes, keyboard audit, contrast verification in both
themes, `prefers-reduced-motion` verification, bundle/route-split check, and a **rehearsal of the
full demo journey (brief §24) end-to-end without touching a URL bar**.

---

## 7. Definition of Done — every phase

Binding. A phase with code but without these is not complete.

- [ ] `tsc --noEmit` clean · ESLint clean · `next build` clean
- [ ] Unit tests for logic that is not trivially visual; component tests for interactive components
- [ ] Playwright flow(s) owned by this phase pass (`09-testing.md` §7)
- [ ] axe: zero violations on every route the phase touched, in **both** themes
- [ ] Keyboard: every action reachable, visible focus, no traps, logical order
- [ ] Loading, empty, and error states exist and were viewed — not just written
- [ ] Responsive verified at 1440 / 1280 / 900 / 480
- [ ] Mock data realistic and consistent with the single fixture universe
- [ ] No component fetches directly; no wire shapes above `lib/contracts`
- [ ] No endpoint used that is not in `api.md` (D2)
- [ ] Visual QA pass done against the running app, not the code
- [ ] `docs/` updated in the same PR if a decision changed
- [ ] Tagged `frontend-f<n>`; `main` runnable

**E2E flows mapped to phases** (from `09-testing.md` §7): F1 → 2, 10 · F2/F3 → 3 · F4 → 8 ·
F5 → 4, 5, 6, 9 · F6 → 1, 11 · Polish → 12 (axe on every page).

---

## 8. Repository layout

Consistent with `07-devops.md` §1 — `frontend/` is one independently-buildable app, no monorepo
tooling.

```
frontend/
├── app/
│   ├── (shell)/                 # layout: sidebar, topbar, command palette
│   │   ├── page.tsx             # /            Dashboard
│   │   ├── catalog/…            # /catalog, /catalog/[id]
│   │   ├── review/…             # /review, /review/[taskId]
│   │   ├── documents/…          # /documents, /documents/[id]
│   │   ├── judge/ evaluation/ import/ settings/ runs/[id]/
│   └── api/mock/v1/**           # ← the mock server. Deleted at backend integration.
├── components/
│   ├── ui/                      # shadcn primitives, our tokens
│   ├── attribute/               # AttributeRow, ValueDisplay, ConfidenceIndicator, …
│   ├── document-viewer/         # F2 — the highest-value shared component
│   ├── why-panel/               # F3
│   ├── review/  judge/  charts/
├── lib/
│   ├── api/                     # client, errors (RFC 9457), correlation id
│   ├── contracts/               # zod wire schemas + adapters  ← the only mapping point
│   ├── queries/                 # TanStack Query hooks, keys, prefetch policy
│   ├── run-events/              # RunEventSource port: mock now, SSE later
│   ├── keyboard/                # shortcut registry + ? overlay
│   └── format/                  # units, fractions, tabular numerals
├── mocks/fixtures/              # the single canonical dataset (§4.2)
├── public/mock/pages/           # generated SVG datasheet pages
└── e2e/                         # Playwright + axe
```

---

## 9. Risk register (frontend-specific, extending `06-frontend.md` §Risks)

| # | Risk | Trigger | Mitigation |
|---|---|---|---|
| **F-1** | Highlight coordinates misalign (inherits E1) | Any bbox handling outside the adapter | Normalised coordinates; conversion in one place; known-position visual regression fixture in F2 |
| **F-2** | Mock shapes diverge from what the backend can produce | An endpoint appears in the mock but not `api.md` | D2 enforced in review; a test asserts every mock route path exists in `api.md` |
| **F-3** | Fixture universe becomes internally inconsistent | Dashboard numbers hand-typed | All aggregates **computed** from record fixtures; a test asserts queue tab counts equal task counts |
| **F-4** | F5 compressed to fund F4 polish | Schedule slip in week 2 | A2 — Judge Mode loses a scenario before Review loses prefetch |
| **F-5** | Mock metrics presented as real | Any screenshot leaves the team | C2 — non-removable demo-data indicator driven by API mode |
| **F-6** | Frontend-first produces UI the pipeline cannot feed | Why panel invents fields | Every Why-panel field traced to a column in `04-data-model.md` §3.4 before F3 ships |
| **F-7** | Three developers, heavy merge contention | Shared token/primitive files | Module ownership agreed at F0 kickoff (`07-devops.md` §2); tokens frozen at end of F0 |

---

## 10. Open decisions requiring sign-off

| # | Decision | Recommendation |
|---|---|---|
| **O1** | Add per-page dimensions + a stated bbox convention to `api.md` (C3) | **Approve before F2.** Additive, non-breaking, and it is the difference between retiring risk E1 and discovering it in week 3. |
| **O2** | Mock server as Next Route Handlers rather than MSW (§4.1) | Recommended as written. MSW retained for component tests only. |
| **O3** | PVF-only mock data (C1) | Recommended as written; the brief's cross-category examples are dropped. |
| **O4** | Fabricated dashboard/eval numbers carry a permanent source label (C2) | Recommended as written — it becomes a real FR-EVL-4 control once numbers are real. |

---

## 11. Session brief template

Per `13-implementation-blueprint.md` §8 — one fresh session per phase, no reliance on prior chat.

```
Phase: F<n> — <theme>
Read:  CLAUDE.md · docs/06-frontend.md · docs/api.md · docs/14-frontend-implementation-plan.md §6.<n>
       + docs/04-data-model.md §3.4 if the phase touches attribute values
State: git log --oneline -5 · ls frontend/ · what tag are we on
Constraints: api.md is the treaty (D2) · contracts boundary is the only mapping point ·
             INV-1/4/5/7/9 mirrored per §5 · no component fetches directly
Done when: §7 checklist passes and frontend-f<n> is tagged
```

---

## ✔ Summary

- The F0–F7 order is **accepted with three amendments**: a mandatory contracts + fixture sub-phase
  in F0, a protected budget for F5, and a credible dashboard shell from day one.
- Frontend-first is a **stated, mitigated deviation** from the blueprint's vertical-slice rule — kept
  honest by implementing `api.md` literally as a mock HTTP server that is deleted at integration.
- **The fixture universe is one connected dataset**, computed rather than hand-typed, covering every
  documented status, provenance kind, evidence state, and reason code.
- The invariants are **mirrored in the frontend type system** — rendering a value without evidence
  or an `Unknown` without a reason is a compile error.
- **Normalised evidence coordinates** plus a known-position visual fixture retire risk E1 in F2,
  which requires one additive change to `api.md` (O1).
- Fabricated metrics carry a **permanent source label**; in a product that sells trust, unlabelled
  synthetic numbers are the one bug that cannot be shipped.

## ⚠ Risks

See §9. The three that decide the outcome: **F-1** (coordinates), **F-4** (Review Queue compressed),
**F-5** (mock numbers mistaken for real).

## 💡 Recommendations

1. **Do F0.5 as its own reviewed PR.** Everything after it depends on those types and that dataset;
   fixing them in week 3 means touching every page.
2. **Sign off O1 before F2 starts.** It is a two-line contract addition that prevents the single most
   expensive class of frontend bug in this project.
3. **Author the three canonical demo objects first**, before the bulk fixtures. The demo journey is
   the acceptance test for the whole frontend, and it should be walkable from the end of F3.
