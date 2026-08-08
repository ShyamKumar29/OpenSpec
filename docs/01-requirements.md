# Phase 2 — Requirements

> **Audience:** everyone. **This is what "done" means.**
> IDs are stable and referenced throughout the codebase, PR descriptions, and tests.

**Priority:** `M` Must (Track A, demo-critical) · `S` Should (Track B, designed + partially built) ·
`C` Could (Track C, deferred with justification)
**Verification:** `T` test · `E` eval harness · `M` metric · `I` inspection · `D` demo

---

## 1. Invariants — the Truth Contract

These are the product. Everything else is implementation.

| ID | Invariant | Enforced by | Verify |
|---|---|---|---|
| **INV-1** | **No unsourced assertion.** `AttributeValue` cannot be constructed with a value and no evidence | Type constructor (no such path exists) + deferred DB constraint | T, I |
| **INV-2** | **No unverified source.** Nothing reaches `ACCEPTED` without an independent verification pass | State machine guard + DB `CHECK` | T |
| **INV-3** | **Citation validity.** The cited span must deterministically contain/entail the value | Post-extraction assertion | T, E |
| **INV-4** | **`Unknown` is first-class** with a machine-readable reason code. Never `null`, `""`, or `"N/A"` | Serializer + DB `CHECK` | T |
| **INV-5** | **Provenance kind is never upgraded** | Transform pipeline | T |
| **INV-6** | **`domain/val/` and `domain/nrm/` are pure** — no LLM, I/O, clock, or randomness | Import-graph test | T, I |
| **INV-7** | **Document content is data, never instruction** | Prompt assembly + adversarial suite | T |
| **INV-8** | **Audit is append-only.** No hard deletes | Repository layer + DB role without `UPDATE`/`DELETE` | T, I |
| **INV-9** | **Tier-0 attributes never auto-accept** | Routing policy **and** DB `CHECK` | T, D |
| **INV-10** | **Reproducibility** — every run records models, prompt versions, ruleset versions, corpus hash | Run manifest | T, I |

> **INV-1 and INV-6 are architectural, not procedural.** They are enforced by a type with no unsafe
> constructor and by an import-graph test that fails the build — not by checks someone can forget.

### 1.1 Attribute risk tiers (ADR-0009)

| Tier | Definition | PVF examples | Auto-accept policy |
|---|---|---|---|
| **0** | Safety / regulatory / code-bearing | `pressure_rating_wog`, `pressure_rating_wsp`, `ansi_class`, `temperature_max`, `lead_free_compliance`, `potable_water_listing` | **Never.** Human approval required (INV-9) |
| **1** | Fitment-determining | `nominal_size`, `end_connection_*`, `port_type`, `body_material` | τ ≥ 0.95 **and** provenance ∈ {EXTRACTED, DERIVED} **and** verification PASS |
| **2** | Descriptive / commercial | `handle_type`, `body_style`, `seat_material` | τ ≥ 0.85 |
| **3** | Cosmetic | `finish`, `country_of_origin` | τ ≥ 0.75 |

**Consequence, accepted deliberately:** with 6 of 22 attributes at Tier 0, maximum STP ≈ 73%. Report
as *"73% of all attributes; 96% of auto-eligible attributes."* A system that auto-publishes pressure
ratings is one a distributor cannot deploy.

### 1.2 `Unknown` reason codes (closed set)

| Code | Fix owner | | Code | Fix owner |
|---|---|---|---|---|
| `NO_DOCUMENT_FOUND` | Ops (sourcing) | | `VERIFICATION_FAILED` | Reviewer |
| `DOCUMENT_LOW_CONFIDENCE` | Reviewer | | `VALIDATION_FAILED` | Reviewer + rules owner |
| `DOCUMENT_UNPARSEABLE` | Ops (OCR/manual) | | `NORMALIZATION_FAILED` | Rules owner |
| `ATTRIBUTE_NOT_IN_DOCUMENT` | Ops (other doc) | | `BELOW_CONFIDENCE_THRESHOLD` | Reviewer |
| `AMBIGUOUS_CANDIDATES` | Reviewer | | `CLASS_UNRESOLVED` | Reviewer |
| `CONFLICTING_SOURCES` | Reviewer | | `POLICY_BLOCKED` | Approver |
| `SYSTEM_ERROR` | Engineering | | | |

> Each code routes to a **different queue and a different fix**. That is what makes this an
> operations product rather than a scoring function: *"your 34% Unknown rate is six problems, and
> four of them are document sourcing, not AI."*

---

## 2. Functional requirements by module

Full per-requirement detail and acceptance criteria are maintained here; module design is in the
corresponding technical docs.

| Module | Key requirements | Acceptance criterion |
|---|---|---|
| **ING** (FR-ING-1…9) | CSV/XLSX + REST intake · MPN canonicalisation + variants · per-row error reporting · immutable raw storage · duplicate detection | 5,000-row CSV with 40 bad rows imports 4,960 + a downloadable error report; original file retrievable byte-identical |
| **CLS** (FR-CLS-1…8) | One class or `CLASS_UNRESOLVED` · runs on thin description alone · **deterministic pre-pass before the LLM** · abstention · signal recorded · human reclassification feeds a rules store | ≥95% top-1, ≤5% abstention; **pre-pass alone resolves ≥40% at ≥99% precision** |
| **SCH** (FR-SCH-1…6) | Attribute schema per class with datatype, unit, allowed values, risk tier · **declarative YAML, not code** · versioned · cross-field constraint declarations · completeness computation | 5 classes, ≥80 attributes; **adding a 6th class requires zero code changes** |
| **DOC** (FR-DOC-1…10) | Corpus with source + hash + effective date · document-level **and row-level** binding confidence · deterministic-first retrieval hierarchy · abstain rather than bind weakly · conflict detection · manual attach · **runs from a local corpus with no network** | ≥95% binding accuracy; ≥90% adversarial rejection; a family datasheet resolves to the correct **row**, live |
| **PRS** (FR-PRS-1…8) | Text + tables with page/bbox · stable region IDs · `DOCUMENT_UNPARSEABLE` rather than empty results · OCR fallback · **cache by content hash** | ≥90% of corpus parses usably; every span round-trips to a correct visual highlight |
| **EXT** (FR-EXT-1…8) | Per-attribute candidate or explicit not-found · **≥1 evidence span always** · verbatim preserved separately · **scoped to the bound region** · multi-candidate ranking · rules-based inference marked `INFERRED` · schema-enforced output · untrusted-content boundary | 100% of candidates carry valid spans; zero candidates reference an unbound document |
| **VER** (FR-VER-1…7) | **Independent pass** seeing only span + claim · ENTAILED/NOT_ENTAILED/PARTIAL + rationale · **deterministic pre-check first** · failure ⇒ `Unknown` · optional dual-model for Tier 0/1 | ≥90% rejection on the poisoned slice; **verification's error-reduction delta measured and reported** |
| **VAL** (FR-VAL-1…8) | Type, enum+synonyms, range, cross-field, class consistency · **zero LLM, zero I/O (INV-6)** · rule ID + human-readable explanation per failure · declarative + versioned | ≥60 rules across 5 classes; build fails if `val/` imports an LLM or network module; every rule has a pass and a fail test |
| **NRM** (FR-NRM-1…10) | Canonical + display forms · exact fraction parsing · **NPS/DN never unit-converted** · media-preserving pressure handling · **explicit Class ⇎ WOG non-derivation** · exact-arithmetic conversion with trace · connection synonyms · unmappable ⇒ `Unknown` · pure | 100% branch coverage; property tests for idempotence and round-trip; the Class⇎WOG refusal is a demo beat |
| **CNF** (FR-CNF-1…8) | **Composite of measured signals, not model self-report** · signal vector stored and exposed · **calibrated on the gold set** · per-tier routing policy in config · INV-9 · `INFERRED` never auto-accepts Tier 0/1 | ECE ≤0.05; the frontier chart is generated by the harness, not drawn by hand |
| **PRV** (FR-PRV-1…7) | Document + hash + page + region + offsets + verbatim + models + prompt/ruleset versions · four provenance kinds, never upgraded · full transform chain · append-only audit · soft delete only · exportable · run manifests | Any published value returns complete lineage in one call; a week-1 run remains explainable in week 4 |
| **RVW** (FR-RVW-1…10) | Queue grouped by reason code · **split view with highlighted span** · accept/reject/correct/reclassify/reattach/escalate · **full keyboard operation** · bulk actions · every action audited · corrections feed eval · Tier-0 approver flow · throughput measurement · session resumption | **≥5× manual baseline, measured in a timed head-to-head**; no action requires a mouse |
| **EXP** (FR-EXP-1…5) | Plain-language explanation per attribute · **generated from stored provenance, never model-narrated** · `Unknown` explained as thoroughly as a value · signal breakdown | Every attribute is one click from an explanation; explanation text is deterministic given the provenance |
| **PUB** (FR-PUB-1…7) | CSV/XLSX/JSON with column mapping · **CX1 adapter behind an `ExportTarget` port** · provenance + confidence + reason codes included · policy filters · versioned + diffable · REST pull · webhooks | Export validates against the target schema with zero errors; a second target is a new adapter only |
| **EVL** (FR-EVL-1…8) | Versioned gold set · one-command run · full metric set · **real and synthetic reported separately, real first** · CI gate · charts as artifacts · adversarial slice · historical comparison | ≤10 min in CI; a deliberate regression fails the build; charts reproducible from a clean checkout |
| **DSH** (FR-DSH-1…6) | Catalog health · throughput + cost/SKU · **comparison against a configurable manual baseline** · quality trend · run monitor · reviewer productivity | Dashboard numbers reconcile with the database |
| **JDG** (FR-JDG-1…5) | Free-text MPN + description, live run with stage streaming · ad-hoc PDF upload · every intermediate inspectable · **hard timeout with graceful partial results** · isolated from catalog data | Survives three unrehearsed inputs and one hostile input |
| **ADM** (FR-ADM-1…6) | Session auth · RBAC (admin/approver/reviewer/viewer) · tenant isolation in the model · config without redeploy · job orchestration | Per-role authorization tests pass |

---

## 3. Non-functional requirements

### Performance
| ID | Target |
|---|---|
| NFR-PERF-1/2 | Single SKU: p50 ≤20s / p95 ≤45s cached; p50 ≤60s / p95 ≤120s cold |
| NFR-PERF-3/4 | Parse ≤20pp: p95 ≤15s native, ≤60s OCR |
| NFR-PERF-5/6 | ≥400 SKU/hr single worker; ≥1,500 SKU/hr with four |
| NFR-PERF-7/8 | Review item p95 ≤1.5s; keystroke feedback ≤100ms |
| NFR-PERF-9/10 | Dashboard p95 ≤1s at 100k records; full eval ≤10 min |
| **NFR-PERF-11** | **Every long operation streams stage progress within 2s** |

> NFR-PERF-11 matters more than raw latency for the demo. A 40-second run that narrates
> classify→bind→parse→extract→verify is compelling; a 15-second spinner is dead air.

### Security (full detail in `08-security.md`)
NFR-SEC-1 **prompt injection defence (INV-7)** · SEC-2 upload hardening (magic bytes, sandboxed parse,
size/page caps) · SEC-3 SSRF guard · SEC-4 boundary validation · SEC-5 secret management + scanning ·
SEC-6 app-layer authz · SEC-7 rate limiting · SEC-8 immutable audit · **SEC-9 documented data-egress
statement + per-tenant external-model toggle** · SEC-10 dependency auditing · SEC-11 TLS, no secrets
or document content in logs · SEC-12 OWASP checklist evidenced.

### Reliability / Availability / Scalability
| ID | Target |
|---|---|
| NFR-REL-1…7 | Resumable stages · idempotent jobs · **partial failure ⇒ `Unknown`, never a failed batch** · backoff ×3 then DLQ · provider fallback · no loss on shutdown · ≤1% `SYSTEM_ERROR` |
| NFR-AVL-1…3 | MVP single-region, 99% in the demo window · **demo path 100% (local, cached, offline-capable)** · HA-capable architecture, not deployed |
| NFR-SCL-1…5 | Design 1M SKU / 250k docs, **proven at 5k / 400** · stateless workers · paginated everything · content-hash parse cache · sub-linear cost on shared family documents |

> **Be honest about availability.** "Single-region MVP; stateless behind a queue, so HA is a
> deployment topology change, not a rewrite" reads as senior. An inflated uptime claim does not.

### Maintainability / Accessibility / Observability / Cost
| ID | Target |
|---|---|
| NFR-MNT-1…8 | Ports-and-adapters · every module replaceable · ≥90% domain / ≥70% overall coverage · **100% branch on `nrm/`** · strict typing · ADR per significant decision · **prompts as versioned files** · clone-to-running ≤15 min |
| NFR-ACC-1…5 | **WCAG 2.2 AA** · full keyboard operability · **never colour-only encoding** · ≥4.5:1 contrast · screen-reader labels for confidence, provenance, reason codes |
| NFR-OBS-1…5 | Structured logs with correlation IDs · per-stage traces · latency/token/cost/error/abstention metrics · **`llm_call` ledger** · cost attributable per record |
| NFR-CST-1…4 | ≤$0.12/SKU (stretch ≤$0.05) · deterministic pre-passes cut ≥30% of LLM calls · prompt caching on document context · **cost displayed live** |

---

## 4. Quality requirements (gold set, real slice)

| ID | Metric | Target | Stretch |
|---|---|---|---|
| QR-1 | Precision, auto-accepted Tier 1 | ≥98% | ≥99% |
| QR-2 | Precision, auto-accepted Tier 2/3 | ≥95% | ≥97% |
| QR-3 | STP rate (all mandatory) | ≥55% | ≥70% |
| QR-4 | STP rate (auto-eligible only) | ≥75% | ≥90% |
| QR-5 | Coverage (auto + reviewed) | ≥85% | ≥92% |
| QR-6 / QR-7 | Correct abstention ≥90% / over-abstention ≤18% | | ≥95% / ≤12% |
| **QR-8** | **Citation validity** | **100%** | — |
| **QR-9** | **Unsourced assertion rate** | **0 (structural)** | — |
| QR-10 / QR-11 | Binding accuracy ≥95% / adversarial rejection ≥90% | | ≥98% / ≥95% |
| QR-12 | Prompt injection resistance | ≥98% | 100% |
| QR-13 | Expected Calibration Error | ≤0.05 | ≤0.03 |
| QR-14 | Classification top-1 | ≥95% | ≥97% |
| QR-15 | Verification error-reduction delta vs extraction-only | ≥40% rel. | ≥60% |
| **QR-16** | **SKU-level fully-correct rate** | **≥75%** | ≥85% |

> ⚠ **QR-16 exists because a sharp judge will derive it.** Per-attribute precision of 98% across 13
> auto-accepted attributes gives P(SKU fully correct) ≈ 0.98¹³ ≈ **77%**. Report both, and explain
> that the Tier-0 human gate is precisely what protects the SKU-level outcome where it matters.
> All rates are reported with **Wilson confidence intervals** (ASM-7) — never bare point estimates.

---

## 5. Compliance

| Area | Position |
|---|---|
| Manufacturer document IP | Extract atomic facts, not prose or images; retain spans internally; counsel review before commercial launch |
| Acquisition ethics | robots.txt, rate limits, attribution, no auth circumvention |
| GDPR / privacy | Minimal PII by design; **no personal data ever enters a prompt** |
| Data egress | Documented provider map; per-tenant toggle; self-hosted path via the provider port |
| EU AI Act | Low-risk — no automated decisions about persons; human oversight (INV-9) is already core |
| Accessibility | WCAG 2.2 AA; short VPAT-style statement |
| SOC 2 | **"SOC 2-ready architecture, not certified"** — controls built, gaps named |

---

## 6. Constraints, assumptions, out-of-scope

**Constraints:** 4 weeks / 3 devs (CON-1) · no source data at start (CON-2) · CX1 schema unknown
(CON-3) · third-party LLM dependency (CON-4) · public documents only (CON-5) · unknown demo network
(CON-6) · no production users, so throughput claims come from a controlled experiment (CON-7).

**Assumptions:** A1 UniHack = Unilog (positioning only) · ASM-2 sufficient public PVF PDFs ·
ASM-3 hand-authored taxonomy suffices · ASM-4 LLMs handle table-grounded extraction ·
ASM-5 AI-assisted throughput ≈3–5× · ASM-6 judges value rigour over feature count ·
**ASM-7 n≈500 gives ±~2% CI — report intervals, not point estimates.**

**Out of scope (with reasons):** live ERP/PIM connectors · image/CAD extraction ·
**description generation (contradicts the thesis — refusing it is a positioning statement)** ·
cross-reference/interchange · lifecycle tracking · multi-language · fine-tuning · SSO/billing ·
mobile-native · real-time collaboration · vector search.

---

## 7. Definitions

**Ready:** requirement ID · acceptance criteria written · verification method chosen · dependencies
available · fits one milestone · no unresolved design question.

**Done:** implemented · unit + integration tested · eval slice passing (if pipeline-touching) ·
architecture tests green · documented in `/docs` · demoable on `main` · no new lint/type/security
findings · reviewed and squashed.

---

## ✔ Summary

- Requirements anchor on **10 machine-checkable invariants**; INV-1 and INV-6 are enforced
  structurally (type system + import graph), and INV-2/4/9 are database constraints.
- **Risk tiers** mean safety attributes can never auto-publish, capping STP at ~73% — a ceiling we
  advertise rather than hide.
- A **closed `Unknown` reason-code taxonomy** where each code routes to a different fix turns a
  scoring function into an operations product.
- ~150 functional requirements across 18 modules, each with priority, verification method, and
  acceptance criteria; NFRs carry numeric targets throughout.
- **QR-16 (SKU-level correctness) is volunteered** before a judge derives it, and every rate carries
  a confidence interval.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| R19 | Invariants enforced procedurally, then bypassed under deadline | Type constructor + import-graph test + DB constraints; all three fail the build |
| R20 | Tier-0 review reads as "your automation doesn't work" | Reframe as the deployability guarantee and lead with it |
| R22 | QR targets unachievable on real data | Measure at M3; **re-baseline publicly with reasons, never silently** |
| R23 | Gold set too small for stated precision | Report Wilson intervals; grow the set if intervals are too wide |

## 💡 Recommendations

1. Write the INV database constraints in **migration #1**, before any pipeline code exists.
2. Treat QR-16 as a first-class reported metric from M3 — deriving it publicly is far better than
   having it derived for you.
3. Keep the priority column binding: only `M` items gate milestones, and Track A is frozen after M0.
