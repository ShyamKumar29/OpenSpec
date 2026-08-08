# ADR-0002 — Pipeline as a persisted state machine
Status: Accepted
Date: 2026-08-07

## Context
Enrichment is a 10-stage process where individual stages are expensive (PDF parsing, LLM calls),
failure-prone (network, malformed documents), and partially cacheable. Requirements NFR-REL-1
(resumability), NFR-REL-3 (partial degradation), NFR-SCL-4 (parse caching), and NFR-PERF-11 (live
progress) all bear on this.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| In-memory `enrich(record)` function | Trivial to write; fast to first result | No resumption, no caching, no partial results, no progress, every retry re-pays full LLM cost, undebuggable |
| Workflow engine (Temporal, Airflow) | Durable execution out of the box | Heavy dependency; operational learning curve; overkill at this scale |
| **Persisted state machine over a job table** | Resumable, cacheable, observable, replayable; no new dependency | ~1.5 days of upfront cost; more DB round trips |

## Decision
Each record carries a `pipeline_state`. Each stage is a separate job; its output, state transition,
and the enqueue of the next stage commit atomically. Stages are individually retryable and
individually cacheable.

## Consequences
**Easier:** worker crashes lose ≤1 stage; parse cost paid once per document rather than per SKU;
per-stage latency/cost metrics fall out for free; any record can be replayed from any stage against
a new prompt or ruleset version; the UI can narrate the pipeline live.
**Harder:** more moving parts than a function call; more database traffic.
**Accepted:** the upfront cost repays by M3 through parse caching alone.

## Revisit when
Per-stage database round trips become a measured throughput bottleneck (check against NFR-PERF-5), or
the stage graph grows complex enough (branching, compensation) to justify a workflow engine.
