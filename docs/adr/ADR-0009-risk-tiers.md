# ADR-0009 — Attribute risk tiers with a mandatory Tier-0 human gate
Status: Accepted
Date: 2026-08-07

## Context
A single confidence threshold across all attributes treats "handle type" and "pressure rating" as
equally consequential. In PVF they are not: a wrong pressure rating can put an under-rated valve into
a pressurised line. Additionally, per-attribute precision of 98% implies only ~77% of SKUs are fully
correct across 13 auto-accepted attributes — so per-attribute thresholds alone do not protect the
SKU-level outcome where it matters most.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| One global threshold | Simple; maximises STP | Treats safety attributes as ordinary; not deployable by a real distributor |
| Per-attribute learned thresholds | Optimal on paper | Opaque; a safety attribute could still auto-accept; hard to explain to a buyer |
| **Four risk tiers, Tier 0 never auto-accepts** | Explainable; deployable; matches how the industry already reasons about liability | Caps maximum STP (~73% with 6 of 22 attributes at Tier 0) |

## Decision
Four tiers. **Tier 0 (safety/regulatory: pressure, temperature, ANSI class, lead-free, potable
listing) never auto-accepts regardless of confidence (INV-9).** Tier 1 (fitment) requires τ ≥ 0.95
plus `EXTRACTED`/`DERIVED` provenance plus verification `PASS`. Tier 2 requires τ ≥ 0.85. Tier 3
requires τ ≥ 0.75. Enforced in the routing policy **and** as a database `CHECK` constraint.

## Consequences
**Easier:** the product becomes deployable by a real distributor; "what if you're wrong about the
pressure rating?" has a structural answer rather than a statistical one; the constraint means even a
routing bug cannot publish a Tier-0 value.
**Harder:** STP is capped around 73%, which looks worse than a competitor claiming full automation.
**Accepted:** and reframed — we report both "73% of all attributes" and "96% of auto-eligible
attributes", and we argue in the pitch that a system which auto-publishes pressure ratings is one a
distributor cannot deploy.

## Revisit when
A customer explicitly accepts liability for auto-published Tier-0 attributes under a signed policy,
or measured Tier-0 precision at very high thresholds justifies a supervised trial with a named owner.
