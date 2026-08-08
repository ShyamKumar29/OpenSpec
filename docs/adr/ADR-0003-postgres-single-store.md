# ADR-0003 — PostgreSQL as the single data store
Status: Accepted
Date: 2026-08-07

## Context
The system needs relational integrity (invariants as constraints), flexible attribute payloads,
full-text search over document text, a job queue, hot-reloadable config, and eventually vector
search. Each could be a separate technology.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Postgres + Redis + Elasticsearch + a vector DB | Each tool best-in-class | Four operational dependencies for a 4-week build; four failure modes at the demo; four things to seed and restore |
| MongoDB | Flexible documents | **No transactional invariant enforcement** — fatal, since our guarantees are constraints |
| SQLite | Zero ops | No concurrency for workers |
| **PostgreSQL 16 alone** | JSONB + relational + FTS + trigram + `SKIP LOCKED` queue + pgvector available | Not best-in-class at any single job |

## Decision
PostgreSQL 16 is the only stateful dependency, plus an object store for binaries. It serves as
relational store, document/JSONB store, full-text index, job queue, and config store.

## Consequences
**Easier:** one thing to back up, restore, seed, and reason about; transactional consistency across
records, jobs, and audit; demo restore is a single `pg_restore`.
**Harder:** each specialised workload is somewhat less optimal than a dedicated tool.
**Accepted:** at 400 documents and hundreds of thousands of attribute values, "somewhat less
optimal" is invisible. Every specialised need has a documented migration path (ADR-0004, ADR-0006).

## Revisit when
Any single workload becomes a measured bottleneck: queue depth sustained >10k (→ broker), corpus
>100k documents (→ pgvector, then a search service), or attribute rows >10M (→ partitioning first).
