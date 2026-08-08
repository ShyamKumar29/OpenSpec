# Phase 12 — Documentation System

> **Audience:** whoever is maintaining this project — including AI agents.
> **Governing principle:** `CLAUDE.md` holds only what is true for every task. Everything else lives
> in a document that is loaded when it is relevant.

---

## 1. Why the split matters more than usual here

Three developers using Claude Code will collectively issue hundreds of agent sessions. Every session
loads `CLAUDE.md`. Therefore:

| Property | Consequence |
|---|---|
| `CLAUDE.md` is loaded **always** | It must be short, evergreen, and free of anything task-specific. Every line costs context in every session, forever |
| Specialised docs are loaded **on demand** | They can be long and detailed without penalty |
| Stale instructions are **worse than absent** ones | An agent will follow a wrong instruction confidently. Documentation drift is a correctness bug in an AI-assisted project, not a tidiness issue |
| Documentation is the **shared memory** across three developers and hundreds of stateless sessions | It is load-bearing infrastructure, not an artifact produced at the end |

> ⚠ **The failure mode to avoid:** `CLAUDE.md` grows to 800 lines of accumulated context, half of it
> outdated, and every agent session starts by absorbing stale instructions. Enforce the 150–250 line
> budget as a hard limit — if something must be added, something must be moved out.

---

## 2. The documentation tree

```
CLAUDE.md                         # 150–250 lines. Evergreen. Loaded every session.
README.md                         # Human quickstart. What it is, how to run it.
docs/
├── README.md                     # Index + navigation table + the ten invariants
├── 00-discovery.md               # Problem, market, users, competitors, positioning
├── 01-requirements.md            # Invariants, FRs, NFRs, quality targets, scope
├── 02-architecture.md            # Components, flow, sequences, boundaries, deployment
├── 03-ai-pipeline.md             # Extraction, verification, confidence, prompts, routing, eval
├── 04-data-model.md              # Schema, entities, indexes, versioning, lifecycle
├── 05-backend.md                 # Layering, modules, DI, workers, errors, standards
├── 06-frontend.md                # Pages, flows, wireframes, components, state, a11y
├── 07-devops.md                  # Repo, git, envs, Docker, CI/CD, rollback, DR
├── 08-security.md                # Threat model, controls, injection, OWASP, IP
├── 09-testing.md                 # Pyramid, eval harness, adversarial, QA + demo checklists
├── 10-roadmap.md                 # Milestones, dependency graph, risks, DoD/DoR, debt
├── 11-documentation-plan.md      # This file
├── 12-hackathon-strategy.md      # Demo script, judging, Q&A, backups, timing
├── 13-implementation-blueprint.md# Build order, file order, context reset points
├── api.md                        # HTTP contract — the frontend/backend treaty
├── domain/
│   └── pvf-reference.md          # PVF domain knowledge: classes, attributes, units, traps
├── decisions.md                  # Chronological one-line decision log
└── adr/
    ├── README.md                 # ADR index + template
    └── ADR-0001..0012.md         # One decision each, with alternatives and consequences
```

---

## 3. Per-document contract

| Document | Purpose | Audience | Contents | Update when |
|---|---|---|---|---|
| `CLAUDE.md` | Instruct any agent working in this repo | Agents, new devs | Invariants, layering rules, conventions, commands, pointers | A rule changes — **never** to record progress |
| `README.md` | Get a human running | Anyone | What it is, prerequisites, `make up`, key links | Setup changes |
| `docs/README.md` | Navigate | Everyone | Index, reading paths, invariants | A document is added or renamed |
| `00-discovery.md` | Why this exists | All + judges | Problem, personas, competitors, positioning, metrics | Positioning or ICP changes |
| `01-requirements.md` | What "done" means | All | INV, FR, NFR, QR, scope, assumptions | A requirement is added, cut, or re-baselined |
| `02-architecture.md` | How it fits together | Engineers | Components, flows, sequences, state, deployment | Any structural change |
| `03-ai-pipeline.md` | How the intelligence works | AI/backend | Grounding, prompting, confidence, routing, evaluation | Prompt, model, or scoring change |
| `04-data-model.md` | How data is shaped | Backend | Schema, constraints, indexes, lifecycle | **Same PR as any migration** |
| `05-backend.md` | How to write backend code here | Backend | Folders, layers, DI, workers, errors, standards | New module or convention |
| `06-frontend.md` | How to write frontend code here | Frontend | Pages, components, state, design system, a11y | New page or pattern |
| `api.md` | The frontend/backend treaty | Both | Endpoints, DTOs, errors, pagination, events | **Before** implementing an endpoint change |
| `07-devops.md` | How it ships | All | Repo, git, envs, CI/CD, rollback, DR | Pipeline or infra change |
| `08-security.md` | How it stays safe | All + customer security reviewers | Threat model, controls, OWASP, IP, egress answer | New input surface or integration |
| `09-testing.md` | How it's proven | All | Suites, gates, checklists | New test category |
| `10-roadmap.md` | What happens when | All | Milestones, risks, debt, DoD | **Every milestone close** |
| `12-hackathon-strategy.md` | How we win | Team | Script, judging, Q&A, backups | Weekly in week 4 |
| `13-implementation-blueprint.md` | What to build next | Implementers | Order, dependencies, reset points | Regenerate only if scope changes |
| `domain/pvf-reference.md` | Domain truth | All | Classes, attributes, units, synonyms, traps | A new class or rule is added |
| `decisions.md` | Lightweight history | All | One line per decision, dated | Any decision not big enough for an ADR |
| `adr/*` | Significant decisions with rationale | Engineers, reviewers | Context, options, decision, consequences | **Never edited** — superseded by a new ADR |

---

## 4. ADR discipline

**Write an ADR when a decision is:** hard to reverse · affects multiple modules · rejects a
plausible alternative · someone will later ask "why on earth did they…".

**Template** (`adr/README.md`):

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

**Rules:** ADRs are immutable once Accepted. A changed mind produces a *new* ADR that supersedes the
old one. The "Revisit when" field is what stops an ADR from becoming dogma — it names the condition
under which the decision is expected to change.

---

## 5. Documentation maintenance rules

| Rule | Enforcement |
|---|---|
| A migration PR must update `04-data-model.md` | PR checklist + reviewer |
| An endpoint change must update `api.md` **first** | PR checklist |
| A prompt change must bump its version and note it in `03-ai-pipeline.md` | Review |
| A milestone close must update `10-roadmap.md` status and the risk register | Milestone gate |
| `CLAUDE.md` may not exceed 250 lines | CI line-count check |
| No document may contain progress narration ("currently working on…") | Review — that belongs in the roadmap or issues |
| Every doc ends with ✔ Summary / ⚠ Risks / 💡 Recommendations | Convention |

> 💡 **The CI line-count check on `CLAUDE.md` is worth the five minutes it takes.** It is the only
> mechanism that reliably prevents the always-loaded file from silently becoming the dumping ground.

---

## 6. What deliberately does NOT get documented

| Not documented | Why |
|---|---|
| Code structure that the folder tree already shows | Duplication that will drift |
| Per-function behaviour | That is what types, names, and tests are for |
| Progress and status | Roadmap + git history + issues |
| Anything derivable from `resources/` YAML | The YAML is the source of truth |
| Meeting notes | Decisions become ADRs; everything else is noise |

---

## ✔ Summary

- **`CLAUDE.md` is always-loaded context and is therefore rationed**: 150–250 lines, evergreen only,
  enforced by a CI line-count check.
- Specialised knowledge lives in on-demand documents that can afford to be detailed.
- Each document has an explicit **purpose, audience, contents, and update trigger** — the update
  trigger is what prevents drift.
- **ADRs are immutable** and carry a "Revisit when" condition, which stops decisions from calcifying
  into dogma.
- Documentation is treated as load-bearing infrastructure because it is the shared memory across
  three developers and hundreds of stateless agent sessions.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| I1 | `CLAUDE.md` bloats and every session absorbs stale rules | Hard CI limit; "add one, move one" rule |
| I2 | Docs drift from code | Update triggers on PR checklists; docs and code in the same PR |
| I3 | ADRs edited in place, losing decision history | Immutability rule; supersession only |
| I4 | Documentation written at the end, from memory | Docs are milestone deliverables, not a final task |

## 💡 Recommendations

1. Add the `CLAUDE.md` line-count check to CI in M0.
2. Put "docs updated" on the PR template checklist — the cheapest anti-drift mechanism available.
3. Write ADRs *as decisions are made*, not retrospectively. A retrospective ADR records the outcome
   but loses the alternatives, which is the only part with lasting value.
