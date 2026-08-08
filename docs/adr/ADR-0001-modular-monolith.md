# ADR-0001 — Modular monolith over microservices
Status: Accepted
Date: 2026-08-07

## Context
14 logical modules, 3 developers, 4 weeks. Requirement NFR-MNT-2 demands every module be
independently replaceable. Requirement NFR-AVL-2 demands the demo run entirely on a laptop.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Microservices per module | True isolation; independent scaling | ~25% of budget on network contracts, orchestration, distributed tracing, N deploy pipelines. Local dev becomes painful. Demo becomes fragile |
| Serverless function per stage | Elastic; no server management | Cold starts; long-running parse jobs awkward; hard local dev; state coordination across functions |
| **Modular monolith + separate worker** | One deploy, one debug surface, `docker compose up`. Boundaries enforced by tests | Shared failure domain; requires discipline to keep boundaries |
| Single script | Fastest to start | Untestable, no boundaries, unmaintainable |

## Decision
A single deployable API service and a worker process sharing one codebase, composed of strictly
bounded modules with explicit ports. Boundaries are enforced by an import-graph test in CI, not by
convention.

## Consequences
**Easier:** local development, debugging, atomic refactors, demo reliability, transactional
enqueue-with-write.
**Harder:** independent scaling of a single stage; a runaway module can affect the whole process.
**Accepted:** replaceability is a *coupling* property (satisfied by ports), not a *deployment*
property. Extracting a module into a service later is a deploy change, not a rewrite.

## Revisit when
A single stage (most likely `PRS`) needs materially different CPU/memory scaling from the rest, or a
second team needs an independent release cadence.
