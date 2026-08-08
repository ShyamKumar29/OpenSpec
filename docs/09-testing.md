# Phase 10 — Testing Strategy

> **Audience:** all engineers.
> **Governing principle:** in a product whose thesis is "we don't guess," an untested claim is a
> guess. Every invariant, every quality target, and every demo beat has a test that proves it.

---

## 1. The test portfolio

This is not a standard pyramid, because this is not a standard product. Three of these categories
don't exist in most codebases and they are the ones that matter here.

```
                    ▲  slow / few
        ┌───────────────────────────┐
        │      Demo validation      │  manual, scripted, weekly from M3
        ├───────────────────────────┤
        │        E2E (Playwright)   │  ~12 flows
        ├───────────────────────────┤
        │   ★ EVALUATION HARNESS ★  │  gold set — the quality gate
        ├───────────────────────────┤
        │   ★ ADVERSARIAL SUITE ★   │  injection · wrong-doc · knowledge-bait
        ├───────────────────────────┤
        │       Integration         │  DB constraints · adapters · queue
        ├───────────────────────────┤
        │   ★ ARCHITECTURE TESTS ★  │  layering · INV-1 · INV-6 · no eval
        ├───────────────────────────┤
        │           Unit            │  domain purity — hundreds, fast
        └───────────────────────────┘
                    ▼  fast / many
```

---

## 2. Unit tests — the deterministic core

| Target | Coverage gate | Why |
|---|---|---|
| `domain/nrm/` | **100% branch** | Unit and fraction bugs are silent and catastrophic |
| `domain/val/` | ≥95% | Every rule needs a passing and a failing case |
| `domain/cnf/` | ≥95% | Scoring and routing decide what reaches a customer |
| `domain/model/` | ≥90% | State machine legality, value object constraints |

**Property-based tests (Hypothesis) where they earn their place:**

| Property | Catches |
|---|---|
| `normalise(normalise(x)) == normalise(x)` | Non-idempotent transforms |
| `parse(display(q)) == q` for all quantities | Round-trip formatting loss |
| Unit conversions are exact — no float drift over chains | Accumulated error |
| `NominalSize` has no conversion path to a length | The classic NPS bug, permanently |
| Confidence is monotonic in each signal, holding others fixed | Scoring inversions |
| Any state transition not in the legal set raises | Illegal pipeline states |

**Table-driven tests for the domain traps** (from `domain/pvf-reference.md`): every fraction form,
every end-connection synonym, every pressure media, every unit trap. These are cheap, numerous, and
they are the tests that a Unilog judge would write.

---

## 3. Architecture tests — invariants as build failures

`tests/architecture/` — the highest-leverage file in the repository.

| Test | Asserts |
|---|---|
| `test_layering` | `domain` imports nothing outside {stdlib, pydantic}; `application` never imports `infrastructure`; `api` never imports `infrastructure` internals |
| `test_determinism` | **INV-6** — `domain/val` and `domain/nrm` import no clock, RNG, network, filesystem, or LLM module |
| `test_evidence_required` | **INV-1** — no construction path to `AttributeValue` with a value and no evidence (AST inspection of factory methods + a runtime attempt that must fail) |
| `test_no_eval` | No `eval`/`exec`/`compile` anywhere in `src/` |
| `test_no_hard_delete` | No `DELETE` statement or `session.delete()` outside the explicitly-allowed purge module |
| `test_no_inline_prompts` | No string literal over N characters resembling a prompt outside `resources/prompts/` |
| `test_tenant_scoping` | Every repository read method accepts and applies a tenant scope |

> **Write these on day one.** Retrofitting architectural constraints onto code that already violates
> them costs a day and produces negotiation ("can we allow just this one import?"). Written first,
> they cost an hour and are never negotiated.

---

## 4. Integration tests — prove the guarantees, not just the code

| Suite | Asserts |
|---|---|
| **Constraint rejection** | Inserting `status='ACCEPTED'` with `risk_tier=0` **fails at the database** (INV-9) · `UNKNOWN` without a reason fails (INV-4) · `ACCEPTED` without verification fails (INV-2) · a value without evidence fails (INV-1) |
| **Audit immutability** | `UPDATE`/`DELETE` on `audit_event` is rejected by the DB role (INV-8) |
| Repositories | Tenant scoping, soft delete, supersession semantics, pagination |
| Queue | `SKIP LOCKED` concurrency, idempotent dedupe, backoff, lease reclaim after a simulated crash |
| Adapters | Parser on real fixture PDFs; blob store (both local and S3 implementations); fetcher policy guard (SSRF cases) |
| Caching | Identical content hash produces a parse cache hit; parser version bump produces a miss |
| Migrations | Up/down on a clean DB; the seeder is idempotent |

> **The constraint-rejection suite is the most important integration test in the project.** It proves
> the invariants hold *even when the application logic is wrong* — which is the actual guarantee
> being sold.

---

## 5. Adversarial suite

| Slice | Size | Gate |
|---|---|---|
| **Prompt injection** — payloads in visible text, invisible text, table cells, metadata, filenames | ~30 documents | QR-12 ≥98% resistance |
| **Wrong document** — plausible but incorrect spec sheets bound to an MPN | ~25 cases | QR-11 ≥90% rejection |
| **Domain knowledge bait** — documents where a "typical" value is genuinely absent | ~30 cases | ≥90% correct abstention |
| **Malformed documents** — corrupt, encrypted, zero-page, enormous, zip-bomb-adjacent | ~15 files | Graceful `Unknown`, no crash, limits enforced |
| **Unit traps** — every hazard in `domain/pvf-reference.md` §Traps | ~40 cases | 100% |

> ⚠ **`domain_knowledge_bait` is the slice that distinguishes this product.** A model that knows
> valves will helpfully supply a plausible pressure rating for a brass ball valve whether or not the
> document states one. If this slice isn't in CI from M3, the product's central claim is untested.

---

## 6. Evaluation harness — the quality gate

Detailed methodology in `03-ai-pipeline.md` §8. Operational contract:

| Aspect | Spec |
|---|---|
| Invocation | `make eval` locally; nightly + on pipeline PRs in CI |
| Mode | `cached` by default (free, deterministic, fast); weekly `live` run |
| Output | JSON metrics + Markdown report + frontier chart + reliability diagram + ablation table |
| Gate | Any QR metric regressing beyond tolerance fails the PR |
| Reporting | **Real slice first, synthetic second, always labelled** (FR-EVL-4) |
| Statistics | **Wilson confidence intervals on every rate.** No bare point estimates at n≈500 |
| Governance | Gold label changes require a PR with justification; the gold set is never tuned to flatter a model |

**Regression tolerance:** precision may not drop at all; STP may drop ≤2 points with justification in
the PR description. A PR that trades precision for coverage must say so explicitly — that trade is a
product decision, not an implementation detail.

---

## 7. E2E tests (Playwright)

| # | Flow | Priority |
|---|---|---|
| 1 | Import CSV → column mapping → records visible | M |
| 2 | Enrich a record → attributes appear with confidence | M |
| 3 | **Open "Why?" → evidence highlight renders at the correct position** | M |
| 4 | Review task: accept → value published, audit written | M |
| 5 | Review task: correct → new value supersedes, provenance `HUMAN` | M |
| 6 | Tier-0 attribute cannot be accepted by a `reviewer` role | M |
| 7 | Export → file downloads and validates against the target schema | M |
| 8 | Judge Mode: run a record, stage narration progresses, results render | M |
| 9 | Keyboard-only review of 3 tasks, no mouse events | M |
| 10 | Unknown attribute shows reason code and remediation text | M |
| 11 | Dashboard renders with seeded data | S |
| 12 | Axe accessibility scan on every page | M |

**Visual regression** on the document viewer with fixed-position fixtures — the highlight alignment
bug (E1) is invisible to functional tests and fatal to the demo.

---

## 8. Performance tests

| Test | Target |
|---|---|
| Single-record enrichment latency | NFR-PERF-1/2 |
| Batch throughput, 1 and 4 workers | NFR-PERF-5/6 |
| Review queue item load with prefetch | NFR-PERF-7 |
| Dashboard at 100k records | NFR-PERF-9 |
| Parse cache hit ratio on a family-document batch | Should exceed 95% |
| Cost per SKU on a 200-record batch | NFR-CST-1 |

Run at M4 and M6. Results go on a slide — measured numbers, with the machine specified.

---

## 9. Manual QA checklist (run at each milestone gate)

- [ ] `docker compose up` from a clean clone works in ≤15 min
- [ ] Seeder produces identical taxonomy from repo files
- [ ] Import a 500-row CSV; malformed rows reported, not fatal
- [ ] Enrich 50 records; no crashes; all failures carry reason codes
- [ ] Every attribute on a record opens a "Why?" panel with a correct highlight
- [ ] Tier-0 attribute cannot be auto-accepted (attempt it via the API directly)
- [ ] `Unknown` values all display a reason and a remediation hint
- [ ] Review queue is fully operable with no mouse
- [ ] Corrections supersede correctly and appear in the audit timeline
- [ ] Export validates against the target schema
- [ ] Dashboard numbers reconcile with the database
- [ ] Eval harness runs and produces charts
- [ ] No console errors; no unhandled promise rejections
- [ ] Both themes render; axe reports no violations

---

## 10. Demo validation checklist (M6, run daily in the final week)

- [ ] `demo` snapshot restores cleanly on a wiped machine
- [ ] `cached` LLM mode replays the full demo with zero network
- [ ] Every scripted demo beat executes in order (see `12-hackathon-strategy.md` §demo script)
- [ ] Family-table row-binding beat renders the correct highlighted row
- [ ] ANSI Class ⇎ WOG refusal beat displays the explanation
- [ ] Wrong-document rejection beat triggers reliably
- [ ] Judge Mode completes within its timeout on the three rehearsal inputs
- [ ] Judge Mode degrades gracefully on a deliberately hostile input
- [ ] Cost and throughput tiles show real numbers, not placeholders
- [ ] Frontier, reliability, and ablation charts load from real eval output
- [ ] Backup laptop restores and runs the same script
- [ ] Recorded video fallback exists and is current
- [ ] Total runtime fits the time limit with ~20% margin

---

## 11. Regression strategy

| Change type | Required proof |
|---|---|
| Domain rule change | Unit tests + eval harness, no precision regression |
| Prompt change | **Version bump** + eval on both slices + ablation unchanged |
| Model change | Full eval + frontier comparison + cost delta |
| Schema change | Migration test + historical interpretability test |
| UI change | E2E + axe + visual regression |
| Any pipeline change | Eval gate in CI (mandatory) |

**Prompts are versioned artifacts.** A prompt edit without a version bump is a silent, unreproducible
quality change — it fails review.

---

## ✔ Summary

- Three non-standard test categories carry most of the weight: **architecture tests** (invariants as
  build failures), the **adversarial suite** (injection, wrong documents, knowledge bait), and the
  **evaluation harness** (the quality gate).
- **Integration tests assert the database rejects invariant violations**, proving the guarantees hold
  even when application logic is wrong — which is what is actually being sold.
- `domain_knowledge_bait` is the slice that tests the product's central claim; without it in CI, the
  claim is untested.
- Every rate is reported with a **Wilson confidence interval**; the gold set is governed by PR review
  and never tuned to flatter a model.
- Two operational checklists — manual QA at every milestone gate, demo validation daily in week 4.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| H1 | Eval harness slips past M1 and quality becomes unmeasurable | It is an M1 gate item; no milestone passes without it |
| H2 | Gold set quietly tuned to make numbers improve | Label changes require a PR with justification; label version tracked |
| H3 | 100% branch coverage on `nrm/` becomes a box-tick with weak assertions | Property-based tests plus the trap table make weak assertions visible |
| H4 | E2E suite becomes flaky and gets ignored | Deterministic seeds, `cached` LLM mode, no arbitrary sleeps; a flaky test is fixed or deleted, never skipped |
| H5 | Demo validation left to the final night | Daily in week 4, weekly from M3 |

## 💡 Recommendations

1. **Order of construction: architecture tests → unit tests → eval harness → everything else.** The
   first two are hours of work and they protect the following four weeks.
2. Run the eval harness in `cached` mode constantly during development. Free, instant, deterministic —
   it turns quality from a week-4 discovery into a daily signal.
3. Treat the demo validation checklist as a milestone deliverable with a named owner, not as
   preparation. It is the difference between a demo that works and a demo that worked yesterday.
