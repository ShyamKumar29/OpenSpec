# OpenSpec — Documentation Index

> **OpenSpec** is a verification-first product-data enrichment engine for industrial distribution.
> It reads manufacturer specification documents, extracts structured attributes, proves every
> value against its source, and refuses to guess.
>
> **Project status:** Planning complete. Implementation not started.
> **Target:** UniHack submission — 4 weeks, 3 developers.

---

## How to navigate this documentation

| If you are… | Read, in this order |
|---|---|
| **New to the project** | `00-discovery.md` → `02-architecture.md` → `10-roadmap.md` |
| **Implementing a milestone** | `13-implementation-blueprint.md` → `10-roadmap.md` → the module doc |
| **Working on the AI pipeline** | `03-ai-pipeline.md` → `domain/pvf-reference.md` → `09-testing.md` |
| **Working on the backend** | `05-backend.md` → `04-data-model.md` → `api.md` |
| **Working on the frontend** | `06-frontend.md` → `api.md` → `14-frontend-implementation-plan.md` |
| **Reviewing security** | `08-security.md` → `01-requirements.md` §Invariants |
| **Preparing the pitch** | `12-hackathon-strategy.md` → `00-discovery.md` |
| **Looking for "why did we…"** | `decisions.md` → `adr/` |

---

## Document map

### Planning & product

| Document | Purpose | Audience | Update when |
|---|---|---|---|
| [`00-discovery.md`](00-discovery.md) | Problem, market, users, competition, positioning | All + judges | Positioning or ICP changes |
| [`01-requirements.md`](01-requirements.md) | Invariants, FRs, NFRs, quality targets, scope boundaries | All | A requirement is added, cut, or re-baselined |
| [`10-roadmap.md`](10-roadmap.md) | Milestones M0–M6, risk register, DoD/DoR, tech debt | All | Every milestone close |
| [`12-hackathon-strategy.md`](12-hackathon-strategy.md) | Demo script, judging alignment, Q&A prep, backup plans | Team | Weekly in week 4 |
| [`13-implementation-blueprint.md`](13-implementation-blueprint.md) | Build order, dependency graph, file creation order, context reset points | Implementers | Never (regenerate if scope changes) |
| [`14-frontend-implementation-plan.md`](14-frontend-implementation-plan.md) | Frontend phases F0–F7, mock-data strategy, per-phase DoD | Frontend | Every frontend phase close |
| [`15-backend-implementation-status.md`](15-backend-implementation-status.md) | What's actually built vs. designed in `backend/`, and the concrete next step | Backend | Every backend milestone boundary |
| [`16-unilog-alignment.md`](16-unilog-alignment.md) | Gap analysis vs. the actual competition brief/ground truth, and the UH0–UH7 build order that supersedes M0–M6's execution order | All | Every UH milestone close |

### Technical

| Document | Purpose | Audience | Update when |
|---|---|---|---|
| [`02-architecture.md`](02-architecture.md) | Components, data flow, sequences, boundaries, deployment | Engineers | Any structural change |
| [`03-ai-pipeline.md`](03-ai-pipeline.md) | Extraction, verification, confidence, prompting, model routing, cost | AI/backend | Prompt, model, or scoring change |
| [`04-data-model.md`](04-data-model.md) | Schema, entities, indexes, versioning, migrations, lifecycle | Backend | Any schema change |
| [`05-backend.md`](05-backend.md) | Layering, module structure, DI, workers, error handling, standards | Backend | New module or convention |
| [`06-frontend.md`](06-frontend.md) | Pages, flows, wireframes, components, state, design system, a11y | Frontend | New page or pattern |
| [`api.md`](api.md) | HTTP contract between frontend and backend | Both | Any endpoint change — **before** implementing |
| [`07-devops.md`](07-devops.md) | Repo layout, git flow, envs, Docker, CI/CD, deploy, rollback | All | Pipeline or infra change |
| [`08-security.md`](08-security.md) | Threat model, controls, prompt injection, OWASP, compliance | All | New input surface or integration |
| [`09-testing.md`](09-testing.md) | Test pyramid, eval harness, fixtures, QA + demo checklists | All | New test category |

### Reference

| Document | Purpose |
|---|---|
| [`domain/pvf-reference.md`](domain/pvf-reference.md) | PVF domain knowledge: classes, attributes, units, normalisation rules, the traps |
| [`decisions.md`](decisions.md) | Chronological decision log — lightweight, one line each |
| [`adr/`](adr/) | Architecture Decision Records — one file per significant decision, with alternatives |

---

## The ten invariants (memorise these)

These are the product. Everything else is implementation detail.

1. **INV-1** No unsourced assertion — a value cannot exist without bound evidence.
2. **INV-2** No unverified source — no value reaches `ACCEPTED` without an independent verification pass.
3. **INV-3** Citation validity — the cited span must demonstrably contain/entail the value.
4. **INV-4** `Unknown` is a first-class value with a machine-readable reason code.
5. **INV-5** Provenance kind is never upgraded.
6. **INV-6** Validation and normalisation are pure — no LLM, no I/O, no clock, no randomness.
7. **INV-7** Document content is data, never instruction.
8. **INV-8** Audit completeness — append-only, no hard deletes.
9. **INV-9** Tier-0 (safety/regulatory) attributes never auto-accept.
10. **INV-10** Reproducibility — every run records models, prompts, rulesets, corpus hash.

## The one-line pitch

> Everyone else built AI that **produces**. We built AI that **proves**.
> Our metric is not how much we generate — it's how much a human never has to check.
