# Phase 1 — Problem Discovery & Strategic Positioning

> **Audience:** everyone, including judges. **This is the "why".**

---

## 1. Problem statement

> Industrial distributors sell technical products whose purchase decisions are **entirely
> attribute-driven**, using catalog records that contain **almost no attributes**. The authoritative
> data exists — in manufacturer specification documents — but it is trapped in unstructured formats
> and is not economically extractable by human labour at catalog scale. Automated extraction is
> technically feasible but commercially unusable, because current AI approaches produce output that
> cannot be trusted, audited, or selectively accepted — and in this domain, a wrong specification is
> materially worse than a missing one.

### The gap, precisely

```
Distributor record:            Buyer's actual query:
  mpn:  ABC-123                  "1/2 inch brass ball valve, FNPT × FNPT,
  desc: 1/2 BRS BALL VLV 600WOG   full port, 600 WOG, PTFE seat, lead-free"

Attributes needed:   ~22        Present in the record:      ~3 (encoded, not structured)
Present in the PDF:  ~22        Machine-readable:            0
```

The description is not empty — it is **compressed by tribal knowledge**. `BRS` = brass.
`600WOG` = 600 psi Water/Oil/Gas non-shock. `1/2` is a *nominal size designation*, not a dimension.
A counter salesperson decodes this instantly. A search index, a facet filter, a marketplace feed,
and a procurement system cannot. **The decompression key is locked in PDFs and in the heads of people
who are retiring.**

### Why industrial is harder than retail

| | Consumer retail | **Industrial / MRO** |
|---|---|---|
| Attributes per product | 5–15 | **20–80** |
| Attribute criticality | Cosmetic | **Safety / regulatory / fitment** |
| Cost of a wrong value | A return | **Wrong-part install, leak, downtime, liability** |
| Long-tail SKUs | Thousands | **Hundreds of thousands to millions** |
| Data-pool coverage | High | **Very low for the long tail** |
| Substitutability | High | **Near zero — fitment is binary** |

**Industrial is the segment where hallucination is unacceptable *and* where volume makes manual work
impossible.** That intersection is the market gap.

---

## 2. The three failure modes (this reframes the whole product)

| # | Mode | Example | Does a citation prevent it? |
|---|---|---|---|
| **F1** | **Fabrication** — value invented | "800 WOG" when the PDF never says it | ✅ Yes |
| **F2** | **Misgrounding** — cites a real span that doesn't support the value | Cites a header row, or another model's row | ❌ **No — the citation looks perfect** |
| **F3** | **Misattribution** — correct extraction from the wrong document/row | Reads `ABC-124`'s row in a 40-SKU table | ❌ **No — worse, it's verifiable and wrong** |

**Consequence:** "we cite everything" is not a defensible claim. The defensible claim is:

> **No unsourced assertion, and no unverified source.** Every value must (a) be bound to a
> retrievable evidence span, (b) survive an independent verification pass that did not produce it,
> and (c) survive deterministic validation. Failing any of the three ⇒ `Unknown` with a reason.

That is a **system** claim — auditable, testable, and true. It also demands a genuinely novel
architecture (generate → verify → validate) rather than "we asked the model to cite its sources."

---

## 3. Users & stakeholders

| Persona | Pain | Role |
|---|---|---|
| **P1 Catalog Data Manager** | Unbounded backlog; cannot *defend* data quality when challenged | Champion |
| **P2 Data Steward** | 70% of time is finding the right PDF page, not typing | **Daily user — the throughput metric** |
| **P3 Category Manager** | Scarcest domain expertise consumed by low-judgement work | Authority |
| **P4 eCommerce Director** | No facets, no comparison, no marketplace feeds, terrible search conversion | **Economic buyer** |
| **P5 IT / Security** | "Does our supplier data go to a third-party AI?" | **Gatekeeper (veto)** |
| **P6 Maintenance technician** | 6am, line down, needs a specific valve, can't filter, buys elsewhere | **Never in the room — the emotional anchor** |
| **P7 Manufacturer** | Misrepresented in 200 catalogs with no visibility | Second market (later) |

**ICP:** $100M–$1B industrial distributor · 50k–500k SKUs · 200+ suppliers · PVF/flow control ·
existing eCommerce channel · no data science team.
**Anti-ICP:** apparel, grocery, CPG (data pools cover them), anyone under 5k SKUs.

---

## 4. Existing solutions and why they fail

| Category | Examples | Why it fails |
|---|---|---|
| **PIM** | Akeneo, Salsify, inriver, Pimberly | A database with workflow. **It assumes you already have the data.** Completeness dashboards tell you what's missing; they don't fill it |
| **Data pools / syndication** | 1WorldSync, Syndigo, GDSN, IceCat | Strong in CPG/IT. **Coverage collapses on the industrial long tail** — exactly the SKUs that hurt |
| **Classification standards** | ETIM, UNSPSC, eCl@ss | A *schema*, not a filler. Useful to us as ground truth |
| **BPO / content services** | Offshore data teams | Accurate-ish, **linear cost**, slow, quality drifts, **and no lineage either** |
| **Generic LLM extraction** | GPT/Claude + a parser | **No abstention, no verification, no calibration, no audit trail.** Confident wrong values at scale |
| **AI enrichment startups** | Mostly retail/CPG-focused | Optimised for **marketing copy**, where a fluent guess is a feature. In industrial it is a liability |
| **Do nothing** | A spreadsheet | **The actual incumbent.** Beat this, not Salsify |

### The structural gap

```
  Trustworthy but unscalable            Scalable but untrustworthy
  ┌──────────────────────────┐          ┌──────────────────────────┐
  │ Humans / BPO             │          │ Generic LLM extraction   │
  │ ~5 SKU/hour  ·  $$$$     │ ← gap →  │ ~10,000 SKU/hour  ·  $   │
  │ no lineage either (!)    │          │ no lineage, no abstention│
  └──────────────────────────┘          └──────────────────────────┘
```

Nobody occupies the middle, because occupying it requires the unglamorous parts: evidence binding,
independent verification, deterministic validation, unit normalisation, calibrated confidence, and
risk-routed review. **That is engineering, not model access — which is why LLM commoditisation
doesn't erase the position.**

> **Underrated point:** the human BPO baseline has *no lineage either*. A steward types "600 WOG" and
> the reason is gone forever. **Our system produces better auditability than the human process it
> augments.**

---

## 5. Positioning

> **For** industrial eCommerce platforms and the distributors they serve, whose catalogs are
> attribute-starved and whose enrichment costs scale linearly with headcount,
> **OpenSpec** is a verification-first product-data enrichment engine
> **that** extracts specifications from manufacturer documents, proves every value against its
> source, and refuses to guess,
> **unlike** PIMs (which store data they assume you have), content BPOs (accurate but linear-cost and
> lineage-free), and generic AI enrichment (fast, cheap, unverifiable),
> **because** it is architected so an unproven value *cannot* be emitted.

### Two audiences, one system

| Audience | We sell them |
|---|---|
| **Platform / content-services operator** | **Margin.** ~5× analyst throughput, ≥60% straight-through, and an audit trail that becomes a sellable platform feature |
| **Distributor** | **Trust + coverage.** A complete catalog where every value is clickable back to the manufacturer document |

### The claims, in order

1. **Coverage** — machine-scale enrichment including the long tail no data pool covers.
2. **Verifiability** — a *receipt* per value: document → page → highlighted span → transform chain.
3. **Calibrated abstention** — we know what we don't know, with a confidence number measured against
   ground truth. **This is the moat.**

---

## 6. Competitive advantage — honest analysis

| Asset | Defensibility | Why |
|---|---|---|
| Verification + abstention architecture | 🟢 High | Hard to retrofit; a coverage-optimised competitor's metrics collapse if they enable it |
| Labelled eval set + calibration | 🟢 High | Proprietary, compounding, uncopyable in a weekend |
| Industrial normalisation engine | 🟡 Med-High | Deep, boring, tedious domain rules — copyable in principle, painful in practice |
| Reviewer-correction feedback loop | 🟢 High | A genuine data network effect |
| Reviewer UX / throughput | 🟡 Medium | Copyable, but where daily loyalty is won |

**Not defensible (don't pretend):** using an LLM · PDF parsing · RAG · "good prompts."

**When asked "what stops a big vendor doing this?"** — *"Nothing stops them building it. What's hard
is being willing to ship a system that returns `Unknown` a third of the time — a product-philosophy
commitment a coverage-optimised incumbent won't make — plus an evaluation asset that takes months of
labelled industrial data. We're not defending the model; we're defending the measurement."*

### Risks to the advantage
- **IP:** extracting *facts* is defensible (facts aren't copyrightable in US law; EU database rights
  are stricter). Extract atomic values, not prose. Counsel review before commercial launch.
- **Model dependency:** mitigated by the provider port.
- **Incumbent bundling:** integrate *into* PIMs rather than compete as one.

---

## 7. Success metrics

**Extraction quality (gold set):** precision @ auto-accept ≥98% · **STP rate ≥55%** (the headline) ·
coverage ≥85% · correct abstention ≥90% · over-abstention ≤18% · **citation validity 100%** ·
**unsourced assertion rate 0 (structural)** · binding accuracy ≥95% · ECE ≤0.05.

**Business:** cost/SKU <10% of manual baseline · reviewer throughput ≥5× · time-to-catalog weeks→hours ·
mandatory completeness 40%→90% · channel rejection ↓70%.

> 💡 **The killer chart:** plot STP rate (x) against precision (y) as the threshold sweeps, and
> overlay a "generic LLM, no abstention" point at 100% STP / ~85% precision. The visual argument is
> instantaneous.

---

## ✔ Summary

- The problem is structurally unsolved: **data compressed by tribal knowledge, locked in PDFs**, in
  the one category where a wrong value is worse than a missing one.
- Existing solutions cluster at two useless extremes; the middle is empty because it requires
  unglamorous engineering rather than model access.
- The defensible position is **not extraction** — it is **verification + calibrated abstention +
  evidence lineage**.
- "Never hallucinate" must be reframed as **"no unsourced assertion, no unverified source"** because
  F2/F3 failures survive naive provenance checks.
- The headline metric is **"how much a human never has to check."**

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Demoing past the hard part (assuming the PDF is in hand) | Document binding is a first-class module with its own confidence |
| R2 | "Citation ≠ correctness" attacked live | Independent verification + automated citation-validity check + rehearsed answer |
| R4 | No labelled eval set → every claim is an assertion | Gold set gates M1/M3/M4 |
| R10 | Judges don't know the domain (or, per A1, know it far too well) | Two prepared openings; §Q&A in `12-hackathon-strategy.md` |

## 💡 Recommendations

1. Lead with the **refusal**, then the coverage. The refusal is the differentiator; coverage is table stakes.
2. Never say "replace." Say "analysts become exception handlers, with the evidence already highlighted."
3. Volunteer the `Unknown` rate and the real-vs-synthetic delta before anyone asks. Candour is the
   product's brand.
