# OpenSpec — Frontend

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 + shadcn/ui · TanStack Query.

Read `../CLAUDE.md` first, then `../docs/06-frontend.md`, `../docs/api.md`, and
`../docs/14-frontend-implementation-plan.md` — those documents are the source of truth;
nothing here duplicates them.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. There is no backend yet — every request goes to the mock
HTTP layer under `app/api/mock/v1/**`, backed by a deterministic fixture universe in
`mocks/fixtures/`. Backend integration is a `NEXT_PUBLIC_API_BASE_URL` change plus
deleting `app/api/mock/` — nothing else in the app talks to a specific backend.

## Scripts

| Script                            | Purpose                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                            |
| `npm run build` / `npm run start` | Production build / serve                                              |
| `npm run typecheck`               | `tsc --noEmit`                                                        |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                     |
| `npm test`                        | Vitest (unit + architecture guard tests)                              |
| `npm run test:e2e`                | Playwright (+ axe accessibility)                                      |
| `npm run generate:mock-pages`     | Regenerate `public/mock/pages/**` SVGs from the fixture store         |
| `npm run verify`                  | typecheck → lint → format:check → test → build (the CI gate, locally) |

## Layout

```
app/(shell)/**        Routed pages, wrapped by the app shell (sidebar/topbar/palette)
app/api/mock/v1/**     The mock HTTP layer — implements docs/api.md literally
components/ui/**       shadcn/ui primitives
components/attribute/  INV-1/4/5/9-guarding primitives (ConfidenceIndicator, UnknownValue, …)
components/shell/**    App shell: nav, topbar, command palette, keyboard overlay
components/state/**    Shared loading / empty / error / confirm patterns
lib/contracts/**       zod wire schemas + the only snake_case → camelCase mapping point
lib/api/**             Fetch client, RFC 9457 errors, API-mode flag
lib/keyboard/**        The shortcut registry (combos + "g <letter>" chords)
lib/queries/**         TanStack Query provider + key conventions
mocks/fixtures/**      Deterministic seeded generators — the canonical dataset
mocks/server/**        Mock route-handler helpers (latency, pagination, RFC 9457)
tests/architecture/**  Guard tests: fixtures conform to contracts, mock routes ⊆ api.md
e2e/**                 Playwright + axe
```

## Guard tests worth knowing about

- `tests/architecture/fixtures-conform-to-contracts.test.ts` — every generated fixture
  object validates against the same zod schema the frontend parses; queue tab counts
  reconcile with actual task counts (risk F-3); all closed-set codes appear at least once.
- `tests/architecture/mock-routes-match-api-md.test.ts` — every mock route exists in
  `docs/api.md` (D2 — the mock is a strict subset of the documented contract).
- `tests/architecture/confidence-formatting.test.ts` — confidence numbers are only ever
  formatted in one place (NFR-ACC-3).
