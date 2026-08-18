# OpenSpec

**Verification-first product-data enrichment for industrial distribution.**

Industrial distributors sell technical products from catalog records like this:

```
MPN:          ABC-123
Description:  1/2 BRS BALL VLV 600WOG
```

Twenty-two attributes are needed to sell it. Three are present, and they're encoded, not structured.
The other nineteen exist — in a manufacturer PDF that nobody has time to read at catalog scale.

OpenSpec reads those documents, extracts the specifications, **proves every value against its exact
source**, and returns `Unknown` when the evidence isn't there.

> Everyone else built AI that **produces**.
> We built AI that **proves**.
> Our metric is not how much we generate — it's **how much a human never has to check**.

---

## Status

**M0 and M1 (classification, schema resolution, evaluation harness) complete against their
documented checklists; real classification/evaluation accuracy blocked on the same missing gold
set and LOV reference pack M0 already documented — see
[`docs/15-backend-implementation-status.md`](docs/15-backend-implementation-status.md) §15–§16.**
`backend/` runs today: a FastAPI app, an in-memory dev repository, CSV import with column mapping
and per-row error reporting, a designed-and-DDL-verified Postgres schema with its first Alembic
migration, a deterministic + LLM-residual classifier validated against a closed taxonomy, a schema
resolver, a full evaluation harness (`make eval`) that runs end-to-end against real pipeline
predictions and honestly reports `GOLD_SET_UNAVAILABLE` rather than a fabricated accuracy number,
and 572 passing tests (5 skipped, Postgres-dependent). `frontend/` has a full UI (catalog,
documents, review queue, Judge Mode) built against a mock HTTP layer, ready to point at the real
backend once the pipeline stages that produce enriched data (`M2`–`M6`) exist. Next up: `M2` —
parsing, document binding, and the `DocumentViewer`, per [`docs/10-roadmap.md`](docs/10-roadmap.md).

---

## What makes it different

| | Typical AI enrichment | OpenSpec |
|---|---|---|
| Missing data | Plausible guess | **`Unknown` + a machine-readable reason code** |
| Provenance | "Source: file.pdf" | **Document → page → table row → highlighted span → transform chain** |
| Verification | The model checks itself | **Independent pass, different model, adversarial framing** |
| Units | Model converts them | **Deterministic code. An LLM that converts units can be wrong about arithmetic** |
| Confidence | Model self-report | **Calibrated composite of 11 measured signals, with a reliability diagram** |
| Safety attributes | Auto-published | **Cannot be auto-published — enforced by a database constraint** |

---

## The ten invariants

1. No unsourced assertion — a value cannot exist without bound evidence
2. No unverified source — nothing is accepted without an independent verification pass
3. Citation validity — the cited span must demonstrably contain the value
4. `Unknown` is a first-class value with a reason code
5. Provenance kind is never upgraded
6. Validation and normalisation are pure — no LLM, no I/O, no clock, no randomness
7. Document content is data, never instruction
8. Audit is append-only
9. Safety/regulatory attributes never auto-accept
10. Every run is reproducible — models, prompts, rulesets, corpus hash

Enforced by the type system, database constraints, and import-graph tests — **not by code review.**

---

## Documentation

Start at **[`docs/README.md`](docs/README.md)** for the full index and reading paths.

| | |
|---|---|
| Why this exists | [`docs/00-discovery.md`](docs/00-discovery.md) |
| What "done" means | [`docs/01-requirements.md`](docs/01-requirements.md) |
| How it fits together | [`docs/02-architecture.md`](docs/02-architecture.md) |
| How the AI works | [`docs/03-ai-pipeline.md`](docs/03-ai-pipeline.md) |
| What to build next | [`docs/13-implementation-blueprint.md`](docs/13-implementation-blueprint.md) |
| Why a decision was made | [`docs/decisions.md`](docs/decisions.md), [`docs/adr/`](docs/adr/) |

Agent instructions live in [`CLAUDE.md`](CLAUDE.md).

---

## Planned stack

Python 3.12 · FastAPI · PostgreSQL 16 · Next.js · TypeScript · Tailwind + shadcn/ui · Docker Compose

Rationale for every choice is in [`docs/02-architecture.md`](docs/02-architecture.md) §14 and the ADRs.

---

## Commands

```bash
make up        # docker compose: postgres (backend/worker/frontend containers land with their Dockerfiles)
make seed      # load taxonomy into Postgres (idempotent) — needs OPENSPEC_DATABASE_URL
make test      # backend: ruff + mypy --strict + pytest · frontend: typecheck + lint + unit tests
make eval      # real predictions scored against the gold set — honestly reports
               # GOLD_SET_UNAVAILABLE today; no real gold set exists yet (M1, docs/10-roadmap.md)
make demo      # not built yet — demo-snapshot tooling lands at M6 (docs/10-roadmap.md)
```

No Docker/Postgres in this repository's own development sandbox — `backend/` runs today against an
in-memory dev repository (`OPENSPEC_REPOSITORY_BACKEND=memory`, the default) with no external
dependencies: `cd backend && make install && make run`.
