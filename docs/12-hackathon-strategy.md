# Phase 13 — Hackathon Strategy

> **Audience:** the team. **Assumption A1:** judges include Unilog engineering, product, and
> content-operations people — i.e. **domain experts who run a catalog enrichment operation today**.
> If A1 is wrong, only §2 and §7 change.

---

## 1. The strategic frame

**What we are NOT doing:** explaining that bad product data is a problem. This audience lives it.
Spending 90 seconds on the problem would signal that we think they need educating.

**What we ARE doing:** demonstrating that we understand their operation better than they expect a
student team to, and that we built the one thing their current operation cannot produce — **a
per-attribute receipt** — while making the operation itself several times cheaper.

| Instinct | Why it's wrong here | Do instead |
|---|---|---|
| "AI replaces manual enrichment" | Says "we're here to eliminate your department" to a room containing that department | "We turn a linear-cost service into a software-margin product; analysts become exception handlers" |
| Long problem setup | They know | 20 seconds, using their own vocabulary |
| Maximise attribute coverage | Coverage without trust is what they already can't sell | Lead with the **refusal**, then the coverage |
| Hide the `Unknown` rate | They will find it | **Volunteer it.** It's the feature |
| Claim 100% accuracy | Instantly not credible | Show the calibration curve and the confidence intervals |

---

## 2. Judging alignment

| Likely criterion | Our evidence | Where it appears |
|---|---|---|
| **Problem relevance** | Their own vocabulary, their own SKU shapes, PVF specifics | Slide 1, 20s |
| **Technical depth** | Ablation study, calibration curve, region-scoped grounding, invariants as DB constraints | Live + slides |
| **Innovation** | Verification as a separate stage; calibrated abstention; reason-coded `Unknown` taxonomy | Demo beat 3 |
| **Working product** | Live pipeline, Judge Mode with judge-supplied input | Whole demo |
| **Business viability** | Cost/SKU vs manual baseline, measured 5× throughput, CX1 export | Dashboard, live |
| **Integration potential** | CX1-shaped export validating against their schema | Demo beat 6 |
| **Engineering quality** | Architecture tests, eval in CI, ADRs, docs tree, tech debt register | Slide + repo |
| **Presentation** | Rehearsed, timed, with backups | — |

---

## 3. Demo story — the narrative spine

> **6:00am. A plant is down.** A maintenance tech needs a 1/2" brass ball valve, FNPT, 600 WOG, full
> port, lead-free. Your site has the part. Your site cannot find it, because all it knows is
> `1/2 BRS BALL VLV 600WOG`. The tech buys it somewhere else in twenty seconds.
>
> The specification exists. It's in a PDF on the manufacturer's site. It has always existed.
> The problem was never knowledge — it was **trust at scale**: nobody could extract it fast enough,
> and nothing that extracted it fast could be trusted with a pressure rating.
>
> So we built the extraction engine that **proves every value, and refuses to guess.**

---

## 4. Demo script — 3 minutes

| Time | Beat | What happens | The line |
|---|---|---|---|
| **0:00–0:20** | **The record** | Show `ABC-123 / 1/2 BRS BALL VLV 600WOG`. Show the empty facet panel on a storefront. | "You know this record. Twenty-two attributes needed. Three present." |
| **0:20–0:50** | **The run** | Judge Mode. Stage narration: CLS → SCH → DOC → PRS → EXT → VER → VAL → NRM → CNF. | "Forty percent of classification needed no AI at all — it's a dictionary. We use the model where the model earns it." |
| **0:50–1:20** | **The receipt** ⭐ | Click an attribute → "Why?" panel → highlighted table row on the actual PDF page. | "Every value has a receipt: the document, the page, the row, the verifier's reasoning, and the exact transform chain." |
| **1:20–1:45** | **The refusal** ⭐⭐ | Show ANSI Class = `Unknown`, with: *"Cannot be derived from a WOG rating — different rating basis."* Then a wrong-document rejection. | "This is the part nobody else ships. We could have guessed. Class 150 is the obvious answer. It would also be wrong, and it would go on a valve." |
| **1:45–2:05** | **The gate** | Show the pressure rating held at `AWAITING APPROVAL` at 0.97 confidence. Attempt to auto-accept it — the **database** refuses. | "Safety attributes never auto-publish. Not a policy — a constraint. It is physically impossible in our schema." |
| **2:05–2:30** | **The economics** | Review queue at speed, keyboard-only, throughput meter climbing. Then the dashboard: cost/SKU vs manual baseline. | "Five times an analyst's throughput, at under twelve cents a SKU — and every decision is auditable, which the manual process never was." |
| **2:30–2:50** | **The proof** | The frontier chart with the "generic LLM, no abstention" point plotted, plus the ablation table. | "Here's what each safety layer costs us in coverage, and what it buys in precision. Measured, on a labelled set, with confidence intervals." |
| **2:50–3:00** | **The close** | CX1-shaped export validating. | "Everyone else built AI that produces. We built AI that proves." |

**Beats 3, 4, and 5 are the demo.** If time is cut, cut beats 1, 7, and 8 — never 3–5.

---

## 5. Three-minute video flow

Same spine, different pacing. Screen recording with voiceover, no talking heads until the last five
seconds.

| Segment | Duration | Content |
|---|---|---|
| Hook | 0:00–0:15 | The thin record on screen. The empty facet panel. One sentence. |
| The run | 0:15–0:45 | Sped-up pipeline narration with the real timer visible (honesty) |
| The receipt | 0:45–1:15 | Slow. Zoom into the highlighted row. This is the shot people remember |
| The refusal | 1:15–1:45 | The `Unknown` with its reason. Then the Tier-0 gate |
| The economics | 1:45–2:15 | Review queue at speed + dashboard numbers |
| The proof | 2:15–2:45 | Frontier + ablation, briefly |
| Close | 2:45–3:00 | Architecture diagram flash + the one-liner |

**Production rules:** real numbers only, no mockups; show the timer, don't hide latency; caption
everything; no music louder than the voiceover.

---

## 6. Presentation structure (if slides are required)

1. **The record** — `1/2 BRS BALL VLV 600WOG`, 3 of 22 attributes. (20s)
2. **Why it's unsolved** — the two useless extremes: trustworthy-but-unscalable vs scalable-but-untrustworthy. (25s)
3. **What we built** — the pipeline diagram, with AI-vs-deterministic colour-coded. (25s)
4. **DEMO** — 3 minutes.
5. **The ablation table** — what each safety layer buys. (20s)
6. **The economics** — cost/SKU, throughput, margin math. (20s)
7. **What we deliberately did not build** — the tech debt register. (15s)
8. **Roadmap + close.** (15s)

> 💡 **Slide 7 is unconventional and it works.** Showing a deliberate, justified list of things you
> chose *not* to build reads as engineering maturity, pre-empts "but you didn't do X", and makes
> everything you *did* build look chosen rather than accidental.

---

## 7. Expected judge questions & strong answers

| Q | Answer |
|---|---|
| **"A citation doesn't mean it's correct. What if it cites the wrong row?"** | "Correct — that's failure mode F2, and it's why citation alone isn't our claim. Three things stop it: the model only ever sees the bound region, a deterministic check proves the span contains the value, and an independent verifier with a different model sees only the span and the claim. Our ablation shows verification alone removes about [X]% of residual errors. Here's a live example being rejected." |
| **"What if the PDF covers 40 SKUs?"** | "That's the normal case, not the edge case. We bind to the row, not the document, with a separate row-level confidence. Here it is — row 14 of 40." *(Demo it.)* |
| **"600 WOG vs Class 150 — are they the same?"** | "No, and we refuse to derive one from the other. Different rating bases; Class ratings are temperature-dependent curves. Our normaliser has an explicit non-derivation rule, and the value comes back `Unknown` with that explanation. That refusal is a deliberate design decision." |
| **"Is 1/2 inch a dimension?"** | "No — NPS is a designation, not a length. It's a distinct value type in our domain model with no conversion method, so it can't be unit-converted even by accident." |
| **"How do I know your confidence number means anything?"** | "Because we calibrated it and can show you the reliability diagram. ECE is [X]. It's not a model self-report — it's a composite of nine measured signals, and you can see the breakdown for any value." |
| **"What's your `Unknown` rate?"** | "About [X]% — and roughly [Y] of that is document sourcing, not extraction failure. We break `Unknown` into eleven reason codes because each one routes to a different fix. A high `Unknown` rate on `NO_DOCUMENT_FOUND` is a procurement problem, not an AI problem." |
| **"What stops OpenAI or Salsify building this?"** | "Nothing stops them building it. What's hard is shipping a system that returns `Unknown` a third of the time — that's a product-philosophy commitment a coverage-optimised incumbent won't make. Plus the labelled evaluation asset, which takes months of industrial data. We're not defending the model; we're defending the measurement." |
| **"How does this integrate with CX1?"** | "Export target is behind an adapter interface; here's a CX1-shaped export validating. The pipeline is API-driven, so it can run as an enrichment service behind your existing content workflow rather than as a replacement for it." |
| **"Does our supplier data go to a third-party AI provider?"** | "Yes, under zero-retention configuration — here's the exact data-flow diagram. No personal data ever enters a prompt. There's a per-tenant toggle to disable external models, and because the provider sits behind a port, a self-hosted model is a config change, not a rewrite." |
| **"Cost per SKU?"** | "Under twelve cents measured, and it *falls* as catalog density rises — one parse and one cached prompt prefix serve every SKU in a family document. Versus a manual baseline of [X]." |
| **"You replaced our content team."** | "No — we changed what they do. Tier-0 attributes always reach a human by design. What changes is that they review exceptions with the evidence already highlighted instead of hunting through PDFs. And the output is auditable, which the manual process never was." |
| **"What did you get wrong / what's weak?"** | *(Answer honestly — this question rewards candour.)* "Document sourcing is our weakest link; we handle public PDFs well and portal-gated documents not at all. Our real-data eval set is [N] values, which gives wider confidence intervals than I'd want. And OCR-only documents degrade — we abstain rather than guess, but that's a coverage gap, not a solution." |
| **"How long would production readiness take?"** | "The architecture is there — stateless services, queue-backed, tenant-scoped schema, audit log, RBAC. What's missing is named in our tech debt register: SSO, pen test, AV scanning, and real connectors. Call it a quarter with a pilot customer." |

---

## 8. Known weaknesses — own them before they're found

| Weakness | Prepared framing |
|---|---|
| Small real-data eval set | "n=[N], so we report Wilson intervals rather than point estimates. That's why our numbers have error bars." |
| Public documents only | "Portal-gated supplier documents are the obvious next integration and the one that would most improve coverage." |
| 5 product classes | "Deliberately narrow. The schema layer is declarative — a sixth class is a YAML file, not code. Here it is." |
| STP capped ~73% by Tier-0 policy | "Yes, by design. A system that auto-publishes pressure ratings is a system you can't deploy." |
| Manual baseline measured on our own team | "It's our best available baseline and it's labelled as such. A customer pilot would replace it." |
| No production users | "Correct. Every number is from a labelled evaluation set, and the methodology is in the repo." |

---

## 9. Backup plans

| Failure | Response | Prepared by |
|---|---|---|
| No internet | `cached` mode — full demo, zero network | M6, recorded and verified |
| Laptop dies | Backup machine with the restored snapshot | M6 |
| Judge Mode hangs | Hard timeout → partial results; one keystroke to a pre-cached record | FR-JDG-4 |
| Judge input breaks the pipeline | It returns `Unknown` with a reason — **which is the product working.** Say so, don't apologise | Design |
| Projector/display issues | Local-only demo; PDF of the deck on a phone | M6 |
| Everything fails | Recorded video, current as of the final day | M6 |
| Over time | Beats 3–5 only; ~70 seconds | Rehearsed separately |

> 💡 **The "judge breaks it" case is a gift, not a disaster.** A system that returns
> `Unknown(NO_DOCUMENT_FOUND)` on an unknown MPN is behaving exactly as designed. Rehearse saying
> that calmly — panicking would undo the entire trust narrative in one second.

---

## 10. Time management (final week)

| Day | Focus |
|---|---|
| 22–23 | Export + CX1 adapter + dashboard |
| 24 | Judge Mode + hardening. **First full rehearsal.** |
| 25 | Final ablation + performance runs. Deck built from real outputs. Rehearsal 2. |
| 26 | Video recorded. Backup machine prepared. DR drill. Rehearsal 3. |
| 27 | **Feature freeze.** Demo validation checklist. Q&A drilling. Documentation final pass. |
| 28 | Buffer. Submit early. |

**Feature freeze on day 27 is non-negotiable.** The marginal feature added on the final day has
historically negative expected value: it cannot be tested, it can break the demo, and no judge will
notice its absence.

---

## ✔ Summary

- **Reposition away from replacement**: margin expansion inside an existing content operation,
  analysts promoted to exception handlers. Essential for a room that contains that operation.
- Problem setup compressed to 20 seconds; the saved time goes into domain depth.
- **Beats 3–5 (receipt, refusal, gate) are the demo.** The refusal and the database-enforced Tier-0
  gate are the two moments no competing team will have.
- Every hard question has a prepared, honest answer — including "what's weak?", where candour scores
  better than deflection.
- **Slide 7 (what we deliberately did not build)** converts scope discipline into visible engineering
  maturity.
- Backups at every layer, and the "judge breaks it" scenario reframed as a demonstration rather than
  a failure.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| J1 | Demo runs long and the receipt/refusal beats get cut | Rehearse the 70-second cut version separately |
| J2 | A domain question we can't answer | §7 drilled; "we return `Unknown` for that, deliberately" is a strong fallback |
| J3 | Positioning lands as anti-analyst | Script the augmentation framing explicitly; don't improvise it |
| J4 | Numbers on slides don't match the live demo | All figures generated from the same eval run; regenerate the deck after the final run |
| J5 | Rehearsal deferred to the final night | Three scheduled rehearsals, days 24/25/26 |

## 💡 Recommendations

1. **Rehearse the refusal beat most.** It is the most counter-intuitive moment and the one that
   defines the product; it must be delivered with confidence, not apology.
2. **Generate every slide number from the eval harness output.** A mismatch between deck and demo is
   the fastest way to lose a technical audience.
3. **Freeze on day 27.** Write it in the roadmap now, while it is still easy to agree to.
