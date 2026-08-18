# Architecture Decision Records

One file per significant decision. **ADRs are immutable once Accepted** — a changed mind produces a
new ADR that supersedes the old one, it never edits it.

## When to write one

Write an ADR when the decision is hard to reverse, affects multiple modules, rejects a plausible
alternative, or will make someone later ask *"why on earth did they do that?"*

Smaller decisions go in `../decisions.md` as one line.

## Template

```markdown
# ADR-NNNN — <Title>
Status: Proposed | Accepted | Superseded by ADR-MMMM
Date: YYYY-MM-DD

## Context
What forces are at play? What constraints?

## Options considered
| Option | Pros | Cons |

## Decision
What we chose, stated plainly.

## Consequences
What becomes easier. What becomes harder. What we accept.

## Revisit when
The concrete trigger that should reopen this decision.
```

The **Revisit when** field is what stops an ADR becoming dogma. Never omit it.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](ADR-0001-modular-monolith.md) | Modular monolith over microservices | Accepted |
| [0002](ADR-0002-persisted-pipeline.md) | Pipeline as a persisted state machine | Accepted |
| [0003](ADR-0003-postgres-single-store.md) | PostgreSQL as the single data store | Accepted |
| [0004](ADR-0004-postgres-job-queue.md) | Postgres-backed job queue, no broker | Accepted |
| [0005](ADR-0005-pdf-parser-licensing.md) | pdfplumber + pypdfium2; reject PyMuPDF on licensing | Accepted |
| [0006](ADR-0006-no-vector-store.md) | No vector database in the MVP | Accepted |
| [0007](ADR-0007-independent-verifier.md) | Independent verification as a separate stage | Accepted |
| [0008](ADR-0008-composite-confidence.md) | Composite calibrated confidence, not model self-report | Accepted |
| [0009](ADR-0009-risk-tiers.md) | Attribute risk tiers with a Tier-0 human gate | Accepted |
| [0010](ADR-0010-export-adapter.md) | Export behind an adapter; CX1 as one target | Accepted |
| [0011](ADR-0011-own-taxonomy-subset.md) | Hand-authored taxonomy subset, ETIM-compatible | Accepted (scope narrowed by 0014) |
| [0012](ADR-0012-server-side-rasterisation.md) | Server-side PDF page rasterisation | Accepted |
| [0013](ADR-0013-templated-description-generation.md) | Templated multi-format description generation, in scope | Accepted |
| [0014](ADR-0014-unilog-vocabulary-adoption.md) | Adopt Unilog LOV/manufacturer vocabulary for demo classes | Accepted, supersedes 0011 |
