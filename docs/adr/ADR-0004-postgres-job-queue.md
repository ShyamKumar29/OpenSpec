# ADR-0004 — Postgres-backed job queue, no external broker
Status: Accepted
Date: 2026-08-07

## Context
The pipeline (ADR-0002) needs a durable queue with retry, backoff, dead-lettering, idempotency, and
crash recovery. Requirement NFR-REL-2 demands idempotent processing; NFR-REL-6 demands no data loss
on ungraceful shutdown.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Celery + Redis | Mature, familiar | Two more dependencies; Redis is not durable by default; **cannot enqueue a job and write a record in one transaction** without an outbox pattern |
| SQS / cloud queue | Managed, scalable | Cloud dependency breaks the local demo requirement; same transactional problem |
| RabbitMQ | Powerful routing | Operationally heavy for a 4-week build |
| **Postgres `SELECT … FOR UPDATE SKIP LOCKED`** | Transactional enqueue-with-write; durable; full SQL visibility; zero new dependencies | Polling rather than push; not suited to very high throughput |

## Decision
A `jobs` table claimed with `FOR UPDATE SKIP LOCKED`, with `dedupe_key` uniqueness for idempotency,
exponential backoff with jitter, a lease/heartbeat for crash reclaim, and a dead state that surfaces
on the ops dashboard.

## Consequences
**Easier:** a stage's output, its state transition, and the next job's enqueue commit atomically —
which eliminates an entire class of lost-work bugs that brokers require an outbox to avoid. Queue
state is inspectable with `SELECT`. Local dev and demo restore need nothing extra.
**Harder:** polling latency (~100–500ms); throughput ceiling in the low thousands/sec.
**Accepted:** our throughput target is ~1,500 SKU/hr. We are three orders of magnitude below the
ceiling.

## Revisit when
Sustained queue depth exceeds 10k, or claim contention appears in profiling. The `JobQueue` port
makes the swap contained.
