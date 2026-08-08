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

**Planning complete. Implementation not started.**
This repository currently contains the full architecture, requirements, and delivery plan.

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

## Planned commands

```bash
make up        # postgres, minio, backend, worker, frontend
make seed      # load taxonomy, rules, units (idempotent)
make test      # unit + architecture + integration
make eval      # evaluation harness → metrics, frontier chart, calibration diagram
make demo      # restore the verified demo snapshot
```
