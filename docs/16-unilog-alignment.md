# Phase 16 — Unilog Challenge Alignment

> **Audience:** whoever picks up work next (human or agent). **Purpose:** the brief for the actual
> competition (`Unihack_ Expected Output - Delivery Format.csv`, `Unihack_ Sample Dataset -
> Input.csv`, and the reference pack described in the challenge doc) landed after `00`–`15` were
> written. This phase reconciles the two: what in the existing design already matches, what's
> missing, and the build order to close the gap. Read this **before** `10-roadmap.md` when deciding
> what to build next — it supersedes that file's execution order without discarding its content.
> **Update when:** a milestone below completes or the gap analysis changes.

---

## 1. The verdict

The architecture, invariants, and trust story (`CLAUDE.md`, `00-discovery.md`–`09-testing.md`) are
not wrong for this competition — they are, if anything, unusually well matched to it. The brief asks
for exactly what this project already treats as non-negotiable: grounded values over fluent guesses,
a visible confidence/abstention signal, traceable reasoning, and honest reporting of gaps. Nothing in
§2 below asks for a different product philosophy.

What's missing is the **last mile**: a projection from "a verified `AttributeValue` in our store" to
"a cell in the 252-column Delivery Format the client actually scores." That projection — and the
category/vocabulary scope it should run against — did not exist when `01`–`15` were written, because
the competition's own ground-truth files weren't available yet.

**Net effect:** widen, don't rebuild. See §3 for what actually changes.

---

## 2. Gap analysis

| # | Gap | Why it matters | Resolution |
|---|---|---|---|
| G1 | `Evidence` (`domain/model/attribute.py`) can only cite a PDF span | Most ground-truth values in this dataset come from the input row itself or a reference table, not a manufacturer PDF the demo corpus doesn't have | Widen to a tagged union: `DocumentSpan` (existing) \| `SourceRowSpan` \| `ReferenceTableRow`. INV-1/INV-3 apply to all three — "the cited row of the approved manufacturer list contains this exact string" is just as checkable as a PDF span |
| G2 | Taxonomy is a hand-authored 5-class YAML (ADR-0011) | The client scores against **their** vocabulary (`Unicat_Lov_v1_0`, `Fittings_LOV`, `FAUCETS_LOV`), not ours | ADR-0014: adopt the client's Classpath/LOV as the taxonomy source for the demo classes, `external_ref` seam preserved |
| G3 | No manufacturer/brand resolution module | 27k-row approved list, exact casing and ®/™; supplier strings arrive as `Freud Inc (2435)`, `-- Unbranded --` | New module `RES` — deterministic exact→normalised→fuzzy match, no LLM, per `CLAUDE.md`'s existing "candidate search is banned for AI" rule |
| G4 | No description-construction module | Five rewrites of the same product (`INVOICE_DESC`, `MOBILE_DESC`, `SHORT_DESC`, `LONG_DESC1`, `ITEM_FEATURES_1..20`) per the guidelines' formulas — the brief calls this "most of the task" | ADR-0013: new module `DSC`, templated from accepted `AttributeValue`s and versioned formula config, never free generation |
| G5 | No fraction/UOM normalisation resources loaded | `1/2`, `1-1/4`, `1¼`, `1.25` must resolve to one value; units must use one of ~500 approved abbreviations | Load `Decimal_Fraction.xlsx` and `Unilog_Master_UOM_Standards...xlsx` as `NRM` lookup tables — this is exactly what `domain/nrm/` was designed to be pure for |
| G6 | Wrong category depth | PVF/ball-valve demo classes have no client-supplied ground truth; Fittings and Faucets are specified end-to-end with worked examples | Re-scope the demo classes to **Fittings** first, **Faucets** second (§4) |
| G7 | No gold set from the client's data | `09-testing.md`'s gold-set plan assumed a hand-labelled corpus; the client handed us one for free (200 rows, Input vs Delivery Format) | Point the eval harness at it directly — no labelling work needed to get a first number |
| G8 | `ExportTarget`/CX1 adapter targets an unconfirmed schema (ADR-0010, OD-2) | OD-2 ("obtain the real CX1 schema") is still open, but the Delivery Format CSV *is* a confirmed 252-column target schema | Build the generic export adapter against the Delivery Format shape now; keep the CX1-specific mapping as a stretch, not a blocker |
| G9 | No live backend deployment | "Live Prototype Link" is a mandatory submission field; `15-backend-implementation-status.md` blocks Postgres on "no Docker in this sandbox" | Point `infrastructure/db` at a free hosted Postgres (Neon/Supabase) instead of local Docker — satisfies ADR-0003, doesn't violate it |

**Found in the ground truth while reading it, worth building toward as a demo beat:** Delivery
Format row 2 pairs `MANUFACTURER_NAME = Rheem Manufacturing` with `BRAND_NAME = FRIGIDAIRE®` and
`MFR URL = frigidaire.com`. Frigidaire is an Electrolux brand; Rheem makes water heaters, not
dishwashers. This mismatch propagates uncorrected into that row's `MOBILE_DESC`. It's a live instance
of exactly the kind of error INV-3/verification exists to catch — in the client's own reference data.
Surfacing it (not "fixing" it silently) is the strongest possible demonstration of `VER` working.

---

## 3. What does **not** change

- All ten invariants (`CLAUDE.md`) — none of G1–G9 requires relaxing any of them. G1 widens what
  `Evidence` can point at; it does not weaken INV-1/INV-3.
- The layered architecture (`domain → application → infrastructure/api`) and the "modular monolith,
  persisted state machine" decisions (ADR-0001, ADR-0002).
- Risk tiers and the Tier-0 human gate (ADR-0009) — Fittings and Faucets both have Tier-0-shaped
  attributes (pressure class, material/compliance, connection type on the fitment side); the gate
  logic transfers directly, only the attribute list changes.
- The independent-verifier design (ADR-0007) and composite confidence (ADR-0008).
- `Evidence`/`Verification`/provenance-kind ranking in `attribute.py` — extended, not rewritten.

---

## 4. Category re-scope

**Fittings first, Faucets second.** Both are specified end-to-end by the client (worked attribute
order, canonical value mappings, source URLs); the bronze-ball-valve classes from ADR-0011 have no
client-supplied ground truth to score against and are demoted to an internal architecture-test
fixture (kept exactly where they already live: `tests/architecture/`,
`infrastructure/memory/repositories.py`'s demo dataset).

Fittings is the better *first* target specifically because `Fittings_LOV.xlsx` supplies a labelled
many-to-one mapping (1,472 manufacturer connection-type variants → 515 canonical values; 464 Material
Construction → 113 canonical) — a ready-made, scoreable entity-resolution eval set that requires no
extraction pipeline to exercise. It lets `RES`-shaped normalisation logic get a real accuracy number
before `EXT`/`VER` exist at all.

---

## 5. Milestone plan — UH-track

This track slots ahead of `10-roadmap.md`'s M1–M6 (M0's architectural deliverables are already
substantially done — see `15-backend-implementation-status.md` §2 — and are not repeated here). Each
milestone ends with a concrete, checkable artifact, following the existing "Definition of Done"
(`10-roadmap.md` §5): tested, documented, demoable on `main`.

### UH0 — Ground truth loaded, nothing built yet
**Goal:** every reference file is a queryable resource; placeholders are gone; the eval harness has
something to score against, even at zero pipeline coverage.
- Load `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` scoped to Fittings + Faucets classpaths
- Load `UniCat_Manufacturer_and_Brand_List.xlsx`
- Load `Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx` (both sheets) and
  `Decimal_Fraction.xlsx`
- Load `Fittings_LOV.xlsx` and `FAUCETS_LOV.xlsx` in full (all four sheets each)
- Strip placeholder values (`-- Unbranded --`, `-- No Unilog Brand --`, `-- No DIB Brand --`) at load
  time, not scattered through downstream code
- Import the 200-row Input/Delivery-Format pair as the gold set; import the 1,000-row file as the
  volume/stress set (not scored, used for throughput only)
- **Done when:** every reference file has a loader with a unit test asserting row counts and a spot
  check against 3 manually verified rows; `make eval` runs and reports 0% coverage against real
  targets (correct — nothing is built yet) rather than erroring

> **UH0 addendum (2026-08-13) — PARTIAL, blocked on missing files.** Of the bullets above, only the
> Delivery Format schema and the 1,000-row Input file were actually found in this environment and
> loaded (`backend/infrastructure/reference_data/`). `Unicat_Lov_v1_0...xlsx`,
> `UniCat_Manufacturer_and_Brand_List.xlsx`, `Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx`, the UOM
> standards workbook, and `Decimal_Fraction.xlsx` were not found anywhere on the machine this ran
> on — a gap between this doc and what's actually been supplied, not a decision made while
> implementing UH0. There is also no separate 200-row gold set: the Delivery Format file itself
> contains 2 example rows (both Dishwashers, not Fittings/Faucets). Full write-up, including what
> *was* verified, in `15-backend-implementation-status.md` §7 and
> `backend/resources/reference/unihack/README.md`. **UH1–UH7 as scoped below assume the missing
> files will be supplied** — until then, UH2–UH6 specifically cannot start against real data.
>
> **UH0 re-verification (2026-08-13, same day, follow-up session) — still PARTIAL, gap unchanged.**
> Re-searched the full environment this session ran on (user home directory including Desktop/
> Downloads/Documents, and a second mapped drive) for all seven files named above. Found nothing
> new: the same two CSVs as before, byte-identical (`md5sum` match) to the copies already loaded
> under `backend/resources/reference/unihack/`. None of the six missing `.xlsx`/`.docx` files exist
> anywhere on this machine. This session's brief asserted the missing reference pack "is now
> available" — that did not hold up under inspection, so UH0 remains PARTIAL for the same
> documented reason, not a new one. No substitute or fabricated data was created. See
> `15-backend-implementation-status.md` §7 for the re-verification method.

### UH1 — Evidence widened, resources wired to the domain layer
**Goal:** ADR-0011's blocker is gone; a value sourced from a lookup table is constructible under INV-1.
- Implement the `Evidence` tagged union from G1 (`DocumentSpan | SourceRowSpan | ReferenceTableRow`)
- Update `tests/architecture/test_evidence_required.py` to cover all three variants
- `AttributeValueFactory` gains no new bypass — same constructor discipline, wider input shape
- **Done when:** a value citing "row 12,443 of the approved manufacturer list, column BRAND_NAME" is
  constructible and a value with an empty snippet on any variant still raises `InvariantViolation`

> **UH1 addendum (2026-08-13) — COMPLETE.** `Evidence` in `domain/model/attribute.py` is now
> `DocumentSpan | SourceRowSpan | ReferenceTableRow`, each with its own `EvidenceKind` discriminator
> and constructor-level INV-1/INV-3 validation (empty identity fields or an empty `snippet_text`
> raise `InvariantViolation` immediately — fabrication is unrepresentable for all three, not just
> `DocumentSpan`). `AttributeValueAsserted` accepts any mix of the three in its `evidence` tuple
> unchanged. Field names: `SourceRowSpan(source_dataset, row_identifier, source_column,
> snippet_text)`, `ReferenceTableRow(reference_dataset, row_key, reference_field, snippet_text)` —
> `source_column`/`reference_field` rather than bare `column`/`field` because the latter collides
> with the `dataclasses.field` helper under `mypy --strict` (a real type error, not a style choice).
> API (`api/schemas/attribute_value.py`): `evidence[]` is now a `kind`-discriminated union on the
> wire, documented in `api.md` §Attribute values as additive/non-breaking — the `DOCUMENT_SPAN`
> shape the frontend already parses is unchanged field-for-field, `kind` is the only addition, and
> the frontend's non-strict `zod` schema silently drops it. Persistence: `infrastructure/db/models.py`'s
> `EvidenceRow` gained a `kind` column, two new nullable column groups, and a
> `ck_evidence_kind_field_shape` CHECK constraint enforcing exactly one group populated per `kind` —
> not run against a live Postgres (none available in this environment, unchanged from §3 of
> `15-backend-implementation-status.md`), but `tests/unit/test_db_schema.py` compiles the DDL
> against the Postgres dialect and asserts the constraint/column shape, making permanent what was
> previously verified ad hoc. Tests: `tests/unit/test_evidence_variants.py` (construction/validation
> per variant, mixed-evidence tuples, INV-1 still rejects empty evidence regardless of kind),
> `tests/unit/test_attribute_value_wire_schema.py` (wire serialisation + backward-compatibility
> proof), `tests/architecture/test_evidence_required.py` (extended per the done-criteria above).
> No pipeline stage produces `SOURCE_ROW_SPAN`/`REFERENCE_TABLE_ROW` evidence yet — that starts at
> UH2 — so today's actual `GET /records` responses are unaffected beyond the additive `kind` field.

### UH2 — Manufacturer/brand resolution (`RES`)
**Goal:** every `Part_Manuf` / brand field resolves to an approved manufacturer+brand pair or an
explicit `Unknown`.
- Deterministic exact → normalised (case/punctuation/suffix-insensitive) → fuzzy match against the
  27k-row list
- Fuzzy tier logs its match score as a signal, feeding `CNF` later — never auto-accepted at fuzzy tier
  alone
- **Done when:** eval harness reports resolution accuracy against the 200-row gold set's
  `MANUFACTURER_NAME`/`BRAND_NAME` columns, with a confidence interval, per `09-testing.md`'s existing
  reporting convention

> **UH2 addendum (2026-08-13) — PARTIAL, architecture complete, real resolution blocked.**
> `UniCat_Manufacturer_and_Brand_List.xlsx` was searched for again at the start of this session
> (machine-wide, plus the `Z:\` drive) and confirmed still absent — the third independent
> verification pass to reach this conclusion (`15-backend-implementation-status.md` §7, §9). No
> substitute or fabricated workbook was created. The full deterministic pipeline this section
> describes — exact → normalized-exact → alias → fuzzy, in that order, never auto-accepting fuzzy —
> is implemented and unit-tested against a small, explicitly-labelled test fixture:
> `domain/model/manufacturer.py`, `domain/nrm/manufacturer_brand.py` (pure normalisation — ®/™/©
> strip, legal-suffix folding, trailing-parenthetical-code extraction, all verified against real
> `Part_Manuf` values), `application/ports/manufacturer_brand.py`,
> `application/usecases/resolve_manufacturer_brand.py`,
> `infrastructure/reference_data/manufacturer_brand_list.py` (indexed adapter, fully working; its
> `load_manufacturer_brand_reference()` raises `ReferenceDataMissing` rather than guessing at a
> column layout no one has seen). Manufacturer and brand stay distinct throughout
> (`ManufacturerBrandField`, never conflated). Resolution output is represented as `AttributeValue`
> (`MANUFACTURER_NAME`/`BRAND_NAME`, risk_tier=1) rather than a bespoke type — the existing
> ACCEPTED/NEEDS_REVIEW/UNKNOWN states already cover what RES needs. Three `UnknownReason` codes
> added: `NO_BRAND_DECLARED` (a placeholder — declared absence, not a resolver failure),
> `NO_CANDIDATE_MATCH`, `REFERENCE_DATA_UNAVAILABLE` — the state every real `sample_input.csv` row
> is actually in today, since the resolver never gets to look. The formal done-criterion above
> cannot be met in this environment (needs the missing workbook, the still-missing 200-row gold set
> per UH0's addendum, and an `EVL` harness that doesn't exist yet) — none of the three gaps are new.
> Instead: descriptive corpus statistics computed from the real `sample_input.csv` (normalisation
> clusters, embedded-code extraction, a general — not hardcoded — cross-field near-miss conflict
> scan that independently found `DIB_Brand="Philips"` vs `Part_Manuf="Phillips Lighting"` on 109
> rows, the same class of finding this doc's §2 describes for Rheem/Frigidaire, found by the scan
> itself, not special-cased). Also surfaced: `Part_Manuf` is not reliably "the manufacturer"
> semantically — some rows hold a distributor identity instead (e.g. `Jam Industrial Supply LLC` for
> a 3M-branded product), a real domain trap worth UH4 inheriting. No API endpoint added (nothing
> downstream consumes RES output yet — no write path exists, per `15-backend-implementation-status.md`
> §4) and the frontend is untouched. Full write-up: `15-backend-implementation-status.md` §9.

### UH3 — Taxonomy cutover (ADR-0014)
**Goal:** `SCH` serves Fittings and Faucets from the client's Classpath/LOV, not the hand-authored YAML.
- `taxonomy_loader.py` reads Classpath → attribute schema for the two categories, `external_ref`
  populated from the source Classpath string
- Fittings' 515 canonical connection types + 113 canonical materials loaded as enum constraints
- **Done when:** `GET /records/{id}` for a Fittings item returns a schema-conformant attribute list
  sourced from the LOV, verified against 5 hand-traced Fittings rows from the gold set

> **UH3 addendum (2026-08-14) — PARTIAL, architecture complete, real cutover blocked.**
> `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `Fittings_LOV.xlsx`, and `FAUCETS_LOV.xlsx` were
> re-searched at the start of this session (at least the fourth independent pass across UH0/UH2/UH3) —
> still not present anywhere in this environment. `sample_input.csv` also has no `Classpath` column,
> so real rows cannot even be *classified* into Fittings/Faucets scope from anything supplied here —
> a strictly harder gap than UH2's. The full deterministic architecture this section describes —
> `LovClasspath`/`ProductCategory` scope typing, `LovRow`/`LovAttributeDefinition`
> parsing-and-grouping shape, category-scope boundary as declarative config, risk-tier assignment by
> keyword policy, indexed lookup adapters for all three missing workbooks, and the
> `resolve_schema_for_classpath` use case tying them together — is implemented and unit-tested against
> small, explicitly-labelled fixtures (never real Unicat/Fittings/Faucets data). `ADR-0011`'s
> hand-authored fixture taxonomy is untouched, per ADR-0014. `resources/policy/category_scope.yaml`
> ships with an empty rule list — inventing plausible Classpath prefixes without the source file would
> be fabricated reference data, not architecture. `make check` (backend): 211 tests (up from 150).
> Full write-up: `docs/15-backend-implementation-status.md` §10.

### UH4 — Extraction + verification against Fittings
**Goal:** first end-to-end enrichment on the real dataset, mirroring M3's original goal but against
the correct vocabulary.
- `EXT` candidate generation scoped to input row + resolved manufacturer/brand + bound reference
  tables (no manufacturer PDFs in this dataset — `NO_DOCUMENT_FOUND` is the honest default, not a bug)
- `VER` — independent pass, LOV-membership check as the deterministic pre-check (this is a strictly
  easier deterministic check than PDF-span entailment: "is this value in the Normalized Values set")
- `NRM` — fraction/UOM normalisation from UH0's lookups; NPS/WOG non-derivation rules ported unchanged
  from the existing PVF domain reference
- **Done when:** eval harness reports per-attribute accuracy + `Unknown` rate with reason-code
  breakdown against the Fittings subset of the 200-row gold set

> **UH4 addendum (2026-08-14) — PARTIAL, real verbatim extraction; class-specific extraction
> architecture-only and blocked.** Two of four attributes `enrich_catalog_row` produces
> (`MFG_PART_NUM`, `ITEM_DESCRIPTION`) are genuinely `ACCEPTED`, evidenced, and exact-match-verified
> for all 1,000 real `sample_input.csv` rows — real end-to-end enrichment, not a fixture. The other
> two (`MANUFACTURER_NAME`/`BRAND_NAME`, via UH2's `RES`) remain honestly `Unknown` pending the same
> missing manufacturer/brand workbook UH2 already documented. Class-specific Fittings/Faucets
> attribute extraction (connection type, material, pressure rating) was **not** attempted against real
> data — `SCH` (UH3) cannot resolve a real schema without the missing Unicat LOV, so there is no
> approved vocabulary to extract or verify a value against; asserting one anyway would violate INV-2.
> `domain/nrm/fractions.py` (exact fraction parsing), `nominal_size.py`, `pressure.py`, and
> `connections.py` (end-connection synonyms, transcribed from `docs/domain/pvf-reference.md` §5, not
> client data) are built and unit-tested regardless — they don't depend on the missing workbooks.
> `domain/val/`'s rule engine was deliberately deferred: PRS-*/SIZ-*/END-* rules need real Fittings
> value ranges this environment doesn't have. Coverage (not accuracy) reported per attribute; no gold
> set exists to score correctness against. `make check`: 289 tests (up from 211). Full write-up:
> `docs/15-backend-implementation-status.md` §11.

### UH5 — Description construction (`DSC`, ADR-0013)
**Goal:** the five description formats and `ITEM_FEATURES_n` build from accepted attribute values.
- Formula config per class per field, sourced from `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx`
- Character-limit/casing rules enforced as `VAL`-style rules with pass/fail tests
- **Done when:** eval harness reports field-level match rate against `INVOICE_DESC`, `MOBILE_DESC`,
  `SHORT_DESC`, `LONG_DESC1` for the Fittings gold subset, plus 100% character-limit compliance

> **UH5 addendum (2026-08-14) — PARTIAL, architecture complete, real formulas blocked.**
> `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` still not present (fifth verification pass). The formula
> engine (`domain/dsc/formula_engine.py`), its declarative YAML shape (`domain/model/description.py`,
> `infrastructure/reference_data/description_formulas.py`), and the two confirmed field constraints
> ADR-0013's own worked example documents a number for (`INVOICE_DESC` ≤40 char CAPS, `MOBILE_DESC`
> 60–80 char — `domain/dsc/validation.py`) are built and unit-tested, including a cross-check against
> the two real example rows in `delivery_format.csv`. `resources/description-formulas/` ships with no
> class formula files — writing one without the content guidelines would mean inventing the actual
> construction rule, not implementing a documented one. `build_field_description` returns
> `DescriptionBlocked(reason="NO_FORMULA_CONFIGURED")` honestly for every field+class today.
> `SHORT_DESC`/`LONG_DESC1`/`ITEM_FEATURES_n` have no documented constraint at all in this environment
> and are left unconstrained rather than guessed. `make check`: 331 tests (up from 289). Full
> write-up: `docs/15-backend-implementation-status.md` §12.

### UH6 — Faucets added; confidence + review queue wired to the real backend
**Goal:** second category proves "adding a class is data, not code" under the new taxonomy source;
the already-built frontend (review queue, judge mode, why-panel) is pointed at real pipeline output
instead of the mock fixture universe.
- Repeat UH3–UH5 for Faucets using `FAUCETS_LOV.xlsx`'s fixed attribute/title order
- `CNF` composite scoring calibrated on the combined gold set
- Frontend `NEXT_PUBLIC_API_BASE_URL` pointed at the real backend; contract tests
  (`tests/contract/test_records_api.py` vs `frontend/lib/contracts/*.ts`) re-run against live
  responses, not just shape
- **Done when:** the review queue, Judge Mode, and Why panel all operate on live Fittings + Faucets
  records with no mock-data fallback required

> **UH6 addendum (2026-08-14) — PARTIAL, Faucets parity + `CNF` architecture built; frontend
> deliberately left on mock data.** `FAUCETS_LOV.xlsx` still not present (5th+ verification pass).
> `tests/unit/test_faucets_parity.py` proves Fittings and Faucets run through the exact same
> `resolve_schema_for_classpath`/`CanonicalValueLovAdapter` code, differing only by
> `category_scope.yaml` config — ADR-0014's "a class is a YAML file, zero code changes" claim, proven
> for a second category. `CNF` (composite scoring, calibration, INV-9 routing —
> `domain/cnf/scoring.py`/`calibration.py`/`routing.py`) is new, real, and unit-tested; calibration
> ships as the identity function because no gold set exists to fit a real curve against, and `EXT`/`RES`
> were not retrofitted to route through it (no measurable benefit without real signals to composite).
> Frontend/backend contract compatibility was reviewed (no drift; `tests/contract/test_records_api.py`
> already runs against a live in-process `TestClient`) but the frontend's default was **not** switched
> to the real backend — it serves only 2 unrelated demo records with no write path for any real UH2–UH6
> pipeline output to reach yet, so switching would replace the mock's ~240-record fixture universe with
> something strictly worse for a demo. No frontend file changed. `make check`: 362 tests (up from 331).
> Full write-up: `docs/15-backend-implementation-status.md` §13.

### UH7 — Export, deployment, submission packaging
**Goal:** everything the submission form requires exists and is real.
- `ExportTarget` generic adapter emits the exact 252-column Delivery Format shape (G8); CX1-specific
  mapping remains a stretch behind the same port, not a blocker
- Backend deployed against hosted Postgres (G9); "Live Prototype Link" resolves to a working URL for
  both frontend and backend
- Dashboard numbers regenerated from the real eval run (per `12-hackathon-strategy.md`'s existing
  "never let the deck and the demo disagree" rule)
- Demo script re-validated against §2's Rheem/Frigidaire finding as an added beat
- **Done when:** a clean-machine walkthrough of the submission checklist (deck, brief, live link,
  repo link, demo video) passes end to end

> **UH7 addendum (2026-08-14) — PARTIAL, export architecture real and run against real data;
> deployment is an environment blocker.** `ExportTarget` (`application/ports/export.py`),
> `CsvExportTarget`, and the Delivery Format projection/validation/eval modules
> (`infrastructure/export/`) are built and tested against the real, live-loaded 252-column schema —
> not a second hand-typed one. Run against all 1,000 real `sample_input.csv` rows: 252/252 columns every
> row, `Mfg_Part_Num`/`Part_Desc` 100% populated, `MANUFACTURER_NAME`/`BRAND_NAME` honestly 0% (UH2's
> still-missing workbook), zero structural validation failures. No accuracy or LOV-membership number is
> reported — no gold set, no LOV data. Hosted-Postgres deployment and a live prototype link were **not
> attempted** — provisioning external hosted infrastructure needs account creation/credentials this
> session has neither the access nor standing authorization to create unilaterally; recorded as a
> genuine environment blocker, not faked with a placeholder URL. No fabricated dashboard numbers were
> found to regenerate; no frontend change made. `make check`: 395 tests (up from 362). Full write-up:
> `docs/15-backend-implementation-status.md` §14.

---

## 6. Sequencing notes

- UH0–UH1 are prerequisites for everything else and touch no pipeline logic — safe to start
  immediately regardless of any other open question.
- UH2 (manufacturer resolution) is deliberately sequenced before taxonomy/extraction work because it
  is fully deterministic, scoreable on day one, and de-risks the fuzzy-matching approach early.
- UH3 blocks UH4 and UH6 (schema must exist before extraction can target it).
- UH5 depends on UH4 only for *coverage*, not architecture — the formula engine can be built and unit
  tested against synthetic `AttributeValue`s in parallel with UH4, then pointed at real output once
  UH4 lands.
- UH7's export and deployment work has no logical dependency on UH2–UH6 and can start in parallel —
  it only needs *a* schema-conformant record to serialise, which UH1's widened `Evidence` plus even a
  partially-filled UH4 output already provides.

---

## 7. Cross-references

- Supersedes the description-generation exclusion: see [ADR-0013](adr/ADR-0013-templated-description-generation.md)
- Supersedes the hand-authored taxonomy for scored classes: see [ADR-0014](adr/ADR-0014-unilog-vocabulary-adoption.md)
  (ADR-0011 remains Accepted for the retained architecture-test fixture)
- Resolves OD-2 in practice (`decisions.md`): the Delivery Format CSV is a confirmed export target
  shape even though the live CX1 API schema is still unconfirmed
- Backend readiness baseline: `15-backend-implementation-status.md`
- Original milestone track this amends: `10-roadmap.md` M0–M6
