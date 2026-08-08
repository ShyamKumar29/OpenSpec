# Decision Log

Lightweight, chronological. One line per decision. Anything large enough to need alternatives and
consequences becomes an [ADR](adr/) instead.

| Date | Decision | Why | Ref |
|---|---|---|---|
| 2026-08-07 | Reframed "the AI must never hallucinate" to **"no unsourced assertion, and no unverified source"** | A model-behaviour claim is unfalsifiable; a system claim is testable. Citation ≠ correctness | `00-discovery.md` |
| 2026-08-07 | Document acquisition & MPN↔document binding promoted to a **first-class module** | It is the real bottleneck; demoing past it invites the fatal question | `01-requirements.md` FR-DOC |
| 2026-08-07 | Positioning: **margin expansion inside an existing content operation**, not BPO replacement | Judges likely include the content-ops team; "we replace you" is a losing frame | `12-hackathon-strategy.md` |
| 2026-08-07 | Vertical wedge: **PVF / flow control**, 5 classes | Messiest units in industrial → deterministic engineering visibly beats naive AI | `domain/pvf-reference.md` |
| 2026-08-07 | Introduced **attribute risk tiers**; Tier 0 never auto-accepts | A uniform threshold treats pressure ratings like handle types | ADR-0009 |
| 2026-08-07 | North-star metric: **STP rate at ≥98% precision**, reported alongside SKU-level correctness | Per-attribute precision overstates SKU-level correctness (0.98¹³ ≈ 77%) | `01-requirements.md` QR-16 |
| 2026-08-07 | Gold set target raised to **400–600 labelled values**; real and synthetic slices reported separately, real first | Synthetic-only metrics are inflated and a domain judge will find it | `09-testing.md` |
| 2026-08-07 | **Prompt injection elevated to a core requirement** (INV-7) with an adversarial CI slice | Our input surface is third-party documents; on-brand security work for a trust product | `08-security.md` |
| 2026-08-07 | Stack: Python/FastAPI + Next.js + Postgres | Team strengths; PDF/ML ecosystem; one datastore does five jobs | ADR-0003 |
| 2026-08-07 | Invariants enforced as **database CHECK constraints** and **import-graph tests**, not code review | A guarantee that depends on remembering is not a guarantee | `04-data-model.md`, `05-backend.md` |
| 2026-08-07 | **Judge Mode** included in Track A | Highest impact-per-hour item for a domain-expert audience | FR-JDG |
| 2026-08-07 | Description generation explicitly **out of scope** | Contradicts the thesis; refusing it is itself a positioning statement | OOS-3 |
| 2026-08-07 | **Eval harness lands at M1**, before the extractor | Otherwise three weeks of tuning happen blind | `10-roadmap.md` |
| 2026-08-07 | `demo` treated as a first-class environment with a versioned snapshot | Demo-day failure is the highest-consequence, most-preventable risk | `07-devops.md` |
| 2026-08-07 | Track A frozen after M0; additions require a removal | Scope creep is the dominant failure mode of ambitious 4-week builds | `10-roadmap.md` |

## Open decisions

| # | Question | Blocks | Owner | Due |
|---|---|---|---|---|
| OD-1 | Confirm assumption A1 (UniHack = Unilog; judges are domain experts) | Positioning only | — | Week 1 |
| OD-2 | Obtain the real CX1 import schema / API docs | ADR-0010 mapping, M6 export | — | Day 5 |
| OD-3 | ETIM licensing terms — adopt or stay hand-authored | ADR-0011, TD-4 | — | Week 2 |
| OD-4 | Verify PVF domain rules (§4–§7 of `domain/pvf-reference.md`) against primary sources | All validation rules | — | Week 1 |
| OD-5 | Manual-baseline throughput figure for the cost comparison | Business slide | — | M5 |
