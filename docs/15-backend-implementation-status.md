# Phase 15 — Backend Implementation Status

> **Audience:** whoever picks up backend work next (human or agent).
> **Purpose:** this is the bridge doc `13-implementation-blueprint.md` §8 asks a fresh session to
> load when resuming backend work — "what actually exists" vs. "what `05-backend.md` /
> `04-data-model.md` design", so the next session doesn't have to re-derive it from the diff.
> **Update when:** the backend milestone boundary moves — not every commit.

---

## 1. What this is

A **foundation slice** — roughly the pure-domain and first-vertical-slice portions of M0
(`10-roadmap.md`), built in a sandbox with no Docker and no local Postgres available. That
environment constraint, not a design decision, is why the persistence layer is designed but not
exercised — see §3.

**Everything in §2 is real, tested, and passing today** (`cd backend && make check`: 29 tests,
`ruff` clean, `mypy --strict` clean on `domain/`, `application/`, `infrastructure/`, `api/`).

---

## 2. What exists

| Layer | File(s) | Status |
|---|---|---|
| Domain — `AttributeValue` | `domain/model/attribute.py` | INV-1, INV-4, INV-5, INV-9 structural (constructor-level, not just validated) |
| Domain — pipeline state machine | `domain/model/states.py` | Full graph from `02-architecture.md` §4, transcribed 1:1 |
| Domain — `CatalogRecord`, `Mpn` | `domain/model/record.py` | Value objects only; no mutation methods (record is immutable per `04-data-model.md` §3.1) |
| Domain errors | `domain/errors.py` | `DomainAbstention` / `TransientError` / `InvariantViolation` (`02-architecture.md` §10's three classes) |
| Architecture tests | `tests/architecture/*.py` | Import-graph layering, INV-1 no-omit-evidence shape test, no `eval`/`exec`, no hard delete |
| Application port | `application/ports/repositories.py` | `RecordRepository` Protocol — read side only (no ingest/review mutation yet) |
| In-memory adapter | `infrastructure/memory/repositories.py` | Deterministic 2-record demo dataset, built from `resources/taxonomy/classes.yaml`. **Dev/test adapter, not a production substitute** — see §3 |
| Taxonomy loading | `infrastructure/taxonomy_loader.py`, `resources/taxonomy/classes.yaml` | One class (`BALL_VALVE_BRONZE`), 11 of the reference's 22 attributes — enough to exercise all 4 risk tiers |
| API | `api/main.py`, `api/routers/records.py`, `api/schemas/*.py` | `GET /health`, `GET /api/v1/records`, `GET /api/v1/records/{id}` — verified byte-for-field against `frontend/lib/contracts/{record,attribute-value}.ts` |
| Postgres schema (designed) | `infrastructure/db/models.py` | 20 tables, all INV `CHECK` constraints from `04-data-model.md` §3 transcribed. DDL **compiles** against the Postgres dialect (verified via `CreateTable(...).compile(dialect=postgresql.dialect())`); **no live Postgres has run it** |
| Scaffolding | `docker-compose.yml`, `Makefile`, `.env.example` | `docker compose up` starts Postgres only — `api`/`worker` services are commented out rather than pointing at Dockerfiles that don't exist yet |

Demo data deliberately encodes two domain traps from `CLAUDE.md` as executable proof, not just
comment: `pressure_rating_wog` (Tier 0) always comes back `NEEDS_APPROVAL`, never `ACCEPTED`
(INV-9), and `ansi_class` comes back `Unknown(ATTRIBUTE_NOT_IN_DOCUMENT)` rather than derived from
the WOG rating on the same record ("600 WOG ≠ Class 150 — never derive one from the other").
Both are asserted in `tests/contract/test_records_api.py`.

---

## 3. Why Postgres isn't wired yet — and what "wired" means

`02-architecture.md` §14 explicitly evaluates and rejects SQLite ("no concurrency") as the
database. This sandbox has no Docker and no local Postgres install, and installing one system-wide
wasn't something to do unilaterally mid-session. Substituting SQLite to get *something* running
would have contradicted that explicit, reasoned decision rather than filled a genuine gap — so
instead:

- The schema (`infrastructure/db/models.py`) was written to the full design and its DDL was
  verified to compile against the Postgres dialect (constraints, indexes, partial-index `WHERE`
  clauses and all) — but never run against a live database.
- The read path (`GET /records`, `GET /records/{id}`) runs today against
  `infrastructure/memory/repositories.py`, an in-memory implementation of the same
  `RecordRepository` port a Postgres-backed implementation would satisfy — the same "fast, free,
  deterministic dev/test adapter" role `05-backend.md` §10 recommends `CachedProvider` play for the
  LLM port, applied to persistence instead.
- Swapping to Postgres is a **composition-root change only** (`api/deps.py`) once a
  `infrastructure/db/repositories.py` exists — nothing in `application/` or `api/` needs to change,
  because both adapters satisfy the same `Protocol`.

**Concrete next step, in order:**

1. `docker compose up -d` (starts Postgres 16; this alone requires Docker, unlike everything in §2).
2. `pip install alembic psycopg[binary]`, `alembic init alembic`, point `env.py` at
   `openspec.infrastructure.db.models.Base.metadata`.
3. `alembic revision --autogenerate -m "initial schema"` — this is the first time the schema in
   §2's table gets checked against a real database; expect to fix a handful of autogenerate quirks
   (Alembic doesn't always get `postgresql_where` partial indexes exactly right on the first try).
4. `tests/integration/test_constraints.py` — one test per `CHECK` constraint in
   `infrastructure/db/models.py`, each attempting the violation and asserting Postgres rejects it
   (`05-backend.md` §9: "test the constraints, not just the code").
5. `infrastructure/db/repositories.py` implementing `RecordRepository` against these models.
6. `api/deps.py`: wire `repository_backend=postgres` to the new implementation instead of raising.

**INV-1's deferred constraint** (every current non-`UNKNOWN` `attribute_value` has ≥1 `evidence`
row) is flagged with a comment in `models.py` rather than guessed at — a plain column `CHECK` can't
express a cross-table constraint; it needs either a trigger or is enforced at the transaction
boundary in the repository's write path. Decide which when the write path is built (step 5 needs
one anyway, for `INSERT`s).

---

## 4. What's deliberately not built yet

Everything below is a **gap**, not a decision — it follows the dependency order in
`13-implementation-blueprint.md` §2, next after §3's steps:

| Not built | Needed for | Blueprint step |
|---|---|---|
| Write path (`POST /records`, `POST /records/{id}/enrich`) | Ingest, re-enrichment | 8 |
| `ING`/`CLS`/`SCH`/`DOC`/`PRS`/`EXT`/`VER`/`VAL`/`NRM`/`CNF` stages | The actual pipeline | 9–13 |
| Job queue (`infrastructure/queue/postgres_queue.py`) + worker loop | Any async/background work | 7 |
| `RVW` — review task generation + decision endpoints | `/review/*` | 14 |
| `PRV` — audit event writes | INV-8 in practice (the table exists; nothing writes to it) | throughout |
| `LLMProvider` port + adapters (`cached`/`offline`/real) | `EXT`, `VER`, residual `CLS` | 6, 9 |
| `DocumentParser`, `BlobStore` ports + adapters | `PRS`, document upload | 6, 11 |
| SSE run events (`GET /runs/{id}/events`) | Live pipeline narration, Judge Mode | 15 |
| Auth / `ActorContext` / RBAC | Anything beyond a single implicit demo tenant | throughout (`02-architecture.md` §8) |
| `EVL` — evaluation harness | `/eval/*`, `/evaluation` page | 9 (**before the extractor**, per the roadmap's own warning) |

None of these were skipped by oversight — each is a documented, larger unit of work than fits
alongside standing up the foundation, and building any of them before the queue/worker framework
(step 7) would mean rebuilding it once that framework exists (`02-architecture.md`'s own warning
against the "one big `enrich()` function" trap).

---

## 5. Frontend compatibility

The frontend's transport is already swap-ready: `frontend/lib/api/client.ts` builds every request
from a single `NEXT_PUBLIC_API_BASE_URL` (default `/api/mock/v1`). Pointing it at
`http://localhost:8000/api/v1` (this backend, `make run`) requires **no frontend code change** —
only confirming response shapes match, which `tests/contract/test_records_api.py` on the backend
side and `frontend/lib/contracts/*.ts`'s Zod schemas on the frontend side both already assert
independently. That said, the backend today only serves 2 demo records and 2 read endpoints; it is
not a drop-in replacement for the mock's ~240-record fixture universe yet, and shouldn't be pointed
at from a real frontend session until at least the list/detail shape is exercised against it
end-to-end once.

---

## 6. Running it today

```bash
cd backend
make install   # venv + deps
make check     # ruff + mypy --strict + pytest — 150 tests, all green (see §9 for the UH2 delta)
make run       # uvicorn :8000, repository_backend=memory (the default)
```

No Docker, no Postgres, no network access beyond the initial `pip install`, no LLM API key.

---

## 7. UH0 — reference-data foundation (2026-08-13)

**Status: PARTIAL.** Everything below is real, tested, and passing (`make check`: 59 tests, up
from 29 — the +30 are all `tests/unit/test_reference_data_*.py`). It is "partial" because most of
the reference pack `docs/16-unilog-alignment.md` and `ADR-0014` describe **was not found anywhere
in this environment** — see the discrepancy write-up below before assuming UH1+ can proceed as
those docs describe.

### What was found and loaded

Only two files, both in the user's Downloads folder, not previously in the repo:
`Unihack_ Expected Output - Delivery Format.csv` and `Unihack_ Sample Dataset - Input.csv`. Copied
verbatim into `backend/resources/reference/unihack/` (`delivery_format.csv`, `sample_input.csv`) —
see that directory's `README.md` for full provenance notes and every discrepancy found while
inspecting them.

| Dataset | Loader | Rows | Columns | Validated |
|---|---|---|---|---|
| Delivery Format schema | `infrastructure/reference_data/delivery_format.py` | 252 columns, 2 example rows | 252 | Schema derived from the live CSV header (never hand-typed); frozen snapshot (`delivery_format.schema.json`, regenerated by `scripts/generate_delivery_format_snapshot.py`) makes drift a failing test; 50 `ATTRIBUTE_LABEL/VALUE/UOM` triples and 20 `ITEM_FEATURES_n` columns verified contiguous |
| Sample Input corpus | `infrastructure/reference_data/sample_input.py` | 1,000 | 6 (`Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf`) | Header pinned exactly; malformed row (wrong field count, empty `Mfg_Part_Num`) is a hard failure; `Mfg_Part_Num` duplicates (1 found: `AVM6EV`) are a reported statistic, not a hard failure — uniqueness isn't documented as guaranteed |

`infrastructure/reference_data/stats.py` computes deterministic row/column/duplicate/placeholder
counts for both (UH0 §10); `infrastructure/reference_data/errors.py` defines the
`ReferenceDataMissing` / `ReferenceDataSchemaDrift` / `ReferenceDataMalformedRow` taxonomy so a bad
or absent file fails loudly rather than loading silently-wrong data.

**Placeholder handling:** `docs/16-unilog-alignment.md` UH0's one-line summary says to strip
placeholder brand values (`-- Unbranded --`, `-- No Unilog Brand --`, `-- No DIB Brand --`) at load
time. This session's fuller UH0 brief (§6) is more specific and was followed instead: the raw
source value is always retained; each row exposes `*_is_placeholder` boolean properties as
metadata. Verified against the actual file: `Part_Manuf` uses a different placeholder token (`-`,
41 rows) than the three brand columns, and `Unilog_Brand` is the placeholder on **all 1,000 rows**
— it carries no signal in this dataset. Excluding placeholders from candidate lists is left to
`RES` (UH2), per this session's instruction not to make resolution decisions in UH0.

### What was not found — the actual gap

`ADR-0014` and `docs/16-unilog-alignment.md` describe a reference pack of seven files beyond the
two above: `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` (~161k rows), the 27k-row
`UniCat_Manufacturer_and_Brand_List.xlsx`, `Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx`,
`Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx`, `Decimal_Fraction.xlsx`, and
`UNILOG_INTERNAL_CONTENT_GUIDELINES.docx`. A machine-wide search of this environment (Desktop,
Downloads, Documents, home directory) found none of them. **No substitute or synthetic data was
created for any of them** — per this session's explicit instruction that the supplied files are
the sole source of truth for reference data and that inventing vocabulary/mappings is out of
scope. `infrastructure/reference_data/missing_datasets.py` registers each one by name, expected
filename, and the milestone that needs it, so a later loader stub can call `require("fittings_lov")`
and fail with an actionable message instead of silently returning nothing.

**Consequence for the milestone plan:** UH2 (manufacturer/brand resolution), UH3 (taxonomy
cutover), UH4's `NRM` fraction/UOM tables, and UH5 (description formulas) all name one of these
missing files as a direct input. None of that work can start against real data until the
corresponding file is supplied — this is a blocking input gap, not an architecture gap.

### Also discovered while inspecting the two files that do exist

- The Delivery Format file has **2 example rows**, not the 200-row gold set
  `docs/16-unilog-alignment.md` UH0 describes. Both rows' `Classpath` is
  `Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers` — not Fittings or
  Faucets, the two categories the whole UH track (§4 of that doc) is scoped around. Both MPNs do
  appear in `sample_input.csv`, so the Input/Delivery-Format pairing mechanism itself is real and
  loadable; there just isn't a 200-row gold set to point it at yet.
- The Rheem/Frigidaire mismatch `docs/16-unilog-alignment.md` §2 names is confirmed present in row
  1 (`MANUFACTURER_NAME=Rheem Manufacturing`, `BRAND_NAME=FRIGIDAIRE®`) — still a good demo beat
  for `VER`, just not evidence that a Fittings/Faucets gold set exists.
- `decisions.md`'s 2026-08-13 entry describes the ground-truth files as if the full "LOV/manufacturer/UOM
  reference pack" arrived together with the two CSVs. It didn't, in this environment. Not corrected
  silently — flagged here per this session's "investigate and document the conflict" instruction.

### Not touched in UH0 (by design)

No taxonomy cutover, no manufacturer/brand resolution, no extraction, no description generation, no
frontend change. `infrastructure/taxonomy_loader.py` and `infrastructure/memory/repositories.py`'s
bronze-ball-valve demo dataset are untouched — they remain the architecture-test fixture ADR-0014
already scoped them to.

### UH0 re-verification (2026-08-13, follow-up session)

A later session on the same day was briefed that "the missing reference pack is now available."
That claim was checked, not assumed:

- Searched the full environment this session ran on: the user's home directory (Desktop, Downloads,
  Documents, and everything else under it) plus a second mapped drive (`Z:\`) that turned out to
  hold hackathon-adjacent files (a UniHack prototype slide template, a personal hackathon-tracking
  doc) but none of the seven reference files.
- `md5sum` on the two CSVs found in Downloads matched the two already committed under
  `backend/resources/reference/unihack/` exactly — same bytes, not just same filenames. Nothing
  new arrived.
- None of `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `UniCat_Manufacturer_and_Brand_List.xlsx`,
  `Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx`, `Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx`,
  `Decimal_Fraction.xlsx`, or `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` were found anywhere.

**Conclusion: UH0 remains PARTIAL, for the same reason as before — not a new gap, and not one this
session invented.** No fabricated or substitute data was created. `missing_datasets.py`'s registry
is unchanged and still accurate. This is reported here rather than silently treated as "already
covered" because the brief for this session explicitly asked for the claim to be verified against
the actual filesystem, not taken on faith.

**This gap does not block UH1** (below) — UH1 widens the `Evidence` *type*, which needs no reference
file content, only the shape decision already recorded in `docs/16-unilog-alignment.md` G1 and
`docs/decisions.md`'s 2026-08-13 entry.

---

## 8. UH1 — Evidence model expansion (2026-08-13)

**Status: COMPLETE.** `make check` (backend): 90 tests (up from 59 after UH0), `ruff check`/`ruff
format --check` clean, `mypy --strict` clean on `domain/`, `application/`, `infrastructure/`, `api/`.

### What changed

**Domain (`domain/model/attribute.py`).** `Evidence` was a single dataclass assuming every value
traces to a PDF span. It is now a tagged union: `Evidence = DocumentSpan | SourceRowSpan |
ReferenceTableRow`, each carrying its own `EvidenceKind` discriminator (`init=False`, fixed per
class — the same pattern `AttributeValueUnknown.status` already used) and its own
`__post_init__` validation:

| Variant | Identity fields | INV-3 check |
|---|---|---|
| `DocumentSpan` (unchanged) | `document_version_id`, `page`, `region_id`, `char_start`, `char_end`, `bbox` | `snippet_text` non-empty, `page >= 1`, `char_start <= char_end` |
| `SourceRowSpan` (new) | `source_dataset`, `row_identifier`, `source_column` | all four identity fields (incl. `snippet_text`) non-empty |
| `ReferenceTableRow` (new) | `reference_dataset`, `row_key`, `reference_field` | all four identity fields (incl. `snippet_text`) non-empty |

`source_column`/`reference_field`, not the bare `column`/`field` the alignment doc's conceptual
sketch suggested, because a dataclass attribute literally named `field` shadows the
`dataclasses.field` helper used on the very next line for `kind` — `mypy --strict` catches this as
`"str" not callable`, not a style nitpick. `AttributeValueAsserted.evidence: tuple[Evidence, ...]`
is unchanged in signature; INV-1 ("no unsourced assertion") still checks tuple non-emptiness
regardless of which kind(s) it holds, and a value may carry a heterogeneous mix (e.g. one
`SourceRowSpan` plus one `DocumentSpan` corroborating each other).

**API (`api/schemas/attribute_value.py`).** `EvidenceOut` is now `DocumentSpanOut | SourceRowSpanOut
| ReferenceTableRowOut`, each a separate Pydantic model with its own `kind: Literal[...]` field;
`_evidence_out` dispatches on the domain type via `match`/`case`. This is additive on the wire, not
breaking: the `DOCUMENT_SPAN` shape is byte-for-field identical to before UH1 except for the added
`kind` key, and `frontend/lib/contracts/attribute-value.ts`'s `evidenceWireSchema` is a non-`strict`
`zod` object, which silently drops fields it doesn't recognise rather than rejecting the payload —
checked by reading that file, not assumed. `docs/api.md` §Attribute values documents the full union
and states plainly that no endpoint emits the two new kinds yet. The frontend itself was not
touched (frozen for this track); a future session that starts serving non-document evidence to the
UI will need `evidenceWireSchema` widened client-side first.

**Persistence (`infrastructure/db/models.py`).** `EvidenceRow`'s `document_version_id`, `region_id`,
`page`, `char_start`, `char_end`, `bbox` columns became nullable; two new nullable column groups
were added (`source_dataset`/`row_identifier`/`source_column` and
`reference_dataset`/`row_key`/`reference_field`); a `kind` column plus two new `CHECK` constraints
(`ck_evidence_kind_enum`, `ck_evidence_kind_field_shape`) were added — the latter enforces that
exactly the column group matching a row's `kind` is non-null, the DB-level mirror of each variant's
`__post_init__`. This is the smallest schema change consistent with the existing design (widen
nullability + add columns + add a shape constraint) rather than a second parallel evidence table.
Still not run against a live Postgres — same environment constraint as §3 — but
`tests/unit/test_db_schema.py` is new: it compiles the DDL against the Postgres dialect
(`CreateTable(...).compile(dialect=postgresql.dialect())`) and asserts the constraint names and
column nullability directly, making permanent what was previously verified ad hoc and never
captured as a test.

**Tests added:** `tests/unit/test_evidence_variants.py` (13 tests — construction, INV-1/INV-3
rejection per variant, mixed-evidence tuples, empty-evidence still rejected regardless of kind),
`tests/unit/test_attribute_value_wire_schema.py` (6 tests — wire shape per kind, the
backward-compatibility proof for `DOCUMENT_SPAN`, a full domain→wire→JSON round trip for
`ReferenceTableRow`), `tests/unit/test_db_schema.py` (6 tests — DDL compiles, constraint names
present, nullability matches the design). `tests/architecture/test_evidence_required.py` extended
per the UH1 done-criteria: each variant's identity fields have no default (fabrication is
unrepresentable, not just rejected) and each variant's `kind` is `init=False` (a caller cannot
construct a `DocumentSpan` mistagged as `SOURCE_ROW_SPAN`).

**Documentation updated:** `docs/api.md` (`evidence[]` union documented), `docs/04-data-model.md`
§3.4 (`evidence` table entry widened to describe the three column groups and the shape constraint),
`docs/16-unilog-alignment.md` (UH0 re-verification note; UH1 marked COMPLETE with an addendum).
`docs/decisions.md` already carried a 2026-08-13 entry anticipating this exact widening
(`Evidence` → tagged union) — it was written ahead of the implementation and needed no correction,
so it was left as-is. No new ADR: this executes a decision G1/that log entry already made, not a
new architectural decision.

### Invariant preservation, checked explicitly

- **INV-1** — every `Evidence` variant still requires non-empty `snippet_text`; `AttributeValueAsserted`
  still rejects an empty evidence tuple regardless of which kind(s) would have been in it
  (`test_empty_evidence_still_rejected_regardless_of_kind`).
- **INV-3** — "the cited span must deterministically contain/entail the value" now applies to a
  document region, an input-row cell, or a reference-table cell alike; each variant's constructor
  still only checks structural non-emptiness (entailment itself is `VER`'s job, not built yet,
  unchanged from before UH1).
- **INV-4** — untouched; `AttributeValueUnknown` has no evidence field at all, in any kind.
- **INV-5** — untouched; provenance ranking doesn't look at evidence kind.
- **INV-9** — untouched; Tier-0 auto-accept rejection doesn't look at evidence kind.
- **Existing `DocumentSpan` behaviour** — `tests/contract/test_records_api.py`'s existing INV-1/INV-4
  wire-level assertions against the demo record still pass unmodified; the in-memory repository's
  demo dataset (document-sourced only) serialises identically apart from the additive `kind` field.

### What UH1 deliberately does not do

No pipeline stage constructs `SourceRowSpan`/`ReferenceTableRow` evidence from real data yet — the
in-memory demo repository is unchanged and still document-sourced only. That's UH2's job
(manufacturer/brand resolution against `UniCat_Manufacturer_and_Brand_List.xlsx`, which is still
one of the missing files per §7 above) and UH4's (extraction against `sample_input.csv` rows, which
*is* available). UH1 only proves the type system and persistence design can hold values sourced
either way — exactly the done-criteria `docs/16-unilog-alignment.md` UH1 states.

---

## 9. UH2 — Manufacturer/brand resolution, `RES` (2026-08-13)

**Status: PARTIAL — architecture complete and fully tested; real resolution blocked on missing
reference data.** `make check` (backend): 150 tests (up from 90 after UH1 — +60 new), `ruff
check`/`ruff format --check` clean, `mypy --strict` clean on `domain/`, `application/`,
`infrastructure/`, `api/`.

### Source data — re-verified before writing any code

`UniCat_Manufacturer_and_Brand_List.xlsx` — the file UH2 needs as its authoritative source — was
searched for again at the start of this session, not assumed absent from the prior UH0 write-up.
Searched: the user's Desktop, Downloads, Documents, the rest of the home directory (`.xlsx`/`.docx`
machine-wide), and the second mapped drive (`Z:\`) including its `Docs`/`Projects` subfolders. Found
nothing new — the same two files as UH0 (`delivery_format.csv`, `sample_input.csv`), and none of the
other six files `missing_datasets.py` registers. This is the **third** independent verification pass
across three sessions (UH0's original pass, UH0's follow-up re-verification, this one) to reach the
same conclusion. No substitute or fabricated workbook was created — per this session's explicit
instruction and CLAUDE.md's domain-trap discipline.

What *is* real and used: `sample_input.csv`'s 1,000 rows (`Part_Manuf`, `E1_Brand`, `Unilog_Brand`,
`DIB_Brand`) — the only genuine manufacturer/brand-shaped data available anywhere in this
environment.

### Resolution architecture — built and tested, independent of the missing workbook

The full deterministic pipeline `docs/16-unilog-alignment.md` G3/UH2 describes is implemented and
unit-tested; only the *final tier's real data* is missing, not the tiers themselves.

| Layer | File | What it does |
|---|---|---|
| Domain — value objects | `domain/model/manufacturer.py` | `ManufacturerBrandField` (MANUFACTURER ≠ BRAND, never conflated), `ManufacturerBrandCandidate` (one approved reference row), `ResolutionMethod`, `ScoredCandidate` |
| Domain — normalisation (pure, INV-6) | `domain/nrm/manufacturer_brand.py` | Deterministic, explainable, reversible: whitespace, ®/™/© strip, trailing-parenthetical-code **extraction** (never discarded — `Freud Inc (2435)` → name `Freud Inc` + code `2435`), casefold, punctuation strip, legal/regional-suffix fold (`Inc`, `LLC`, `Corp`, `USA`, …, every token verified against real `Part_Manuf` values, not a generic list). `fuzzy_similarity` — stdlib `difflib`, deterministic, no randomness |
| Application — port | `application/ports/manufacturer_brand.py` | `ManufacturerBrandReference` Protocol: indexed `exact_matches`/`normalized_exact_matches`/`normalized_alias_matches` (O(1)), `all_candidates` (full scan, FUZZY tier only) |
| Application — use case | `application/usecases/resolve_manufacturer_brand.py` | `resolve_manufacturer_brand`: placeholder → reference-unavailable → exact → normalized-exact → alias → fuzzy, in that fixed order. `ResolutionPolicy` (confidences + fuzzy floor/ambiguity-delta) is config, loaded from YAML, never a literal in code |
| Infrastructure — adapter | `infrastructure/reference_data/manufacturer_brand_list.py` | `ManufacturerBrandListAdapter` — indexed, fully implemented and tested against a fixture. `load_manufacturer_brand_reference()` raises `ReferenceDataMissing` via `missing_datasets.require("manufacturer_brand_list")` — deliberately **not** a best-guess `openpyxl` parser against an invented column layout (this project has never seen the file's real header) |
| Infrastructure — policy | `resources/policy/manufacturer_brand_resolution.yaml`, `infrastructure/resolution_policy.py` | Thresholds as declarative config, mirroring `taxonomy_loader.py`'s pattern |
| Infrastructure — stats | `infrastructure/reference_data/manufacturer_brand_stats.py` | Descriptive corpus statistics over the real `sample_input.csv` — see below |

**Manufacturer and brand are kept distinct throughout** (UH2 brief §3): `ManufacturerBrandField` is
a required parameter on every port/use-case call, candidates are scoped to one field each, and
`MANUFACTURER_NAME`/`BRAND_NAME` are two separate `AttributeRef`s.

**Resolution result representation** (UH2 brief §9): reuses `AttributeValue`
(`domain/model/attribute.py`) rather than a bespoke type — `MANUFACTURER_NAME`/`BRAND_NAME`,
risk_tier=1 (not Tier-0: manufacturer/brand aren't in INV-9's pressure/temperature/class/compliance
list), `ACCEPTED` reachable only at a deterministic tier (EXACT/NORMALIZED_EXACT/ALIAS — the
string-equality check against an approved row **is** the INV-2 independent verification pass, the
same "LOV membership check" `docs/16-unilog-alignment.md` UH4 describes for `VER`), `NEEDS_REVIEW`
for FUZZY (never auto-accepted, per brief §4), `UNKNOWN` with one of three new reason codes added to
`UnknownReason` this session — `NO_BRAND_DECLARED` (a placeholder token — declared absence, not a
resolver failure), `NO_CANDIDATE_MATCH` (reference data present, nothing cleared the fuzzy floor),
`REFERENCE_DATA_UNAVAILABLE` (the honest state every real `sample_input.csv` row is in today).
`provenance_kind` is always `DERIVED`, never `EXTRACTED` — even an EXACT-tier match is the outcome of
a matching rule *selecting* an approved candidate, not a verbatim quote of one (INV-5). Evidence is
always a `(SourceRowSpan, ReferenceTableRow)` pair (UH1's widened `Evidence` union, exercised for
real for the first time by this milestone) — every asserted value cites both the raw input cell and
the approved reference row it matched, and `AttributeValueUnknown` correctly carries neither (INV-4).
Ambiguity is never resolved arbitrarily: a fuzzy tie inside `fuzzy_ambiguity_delta`, or two distinct
approved rows colliding on the same alias, both route to `UNKNOWN(AMBIGUOUS_CANDIDATES)` rather than
picking one side.

**Vocabulary boundary** (UH2 brief §7): every `value_display` on an asserted result is copied
verbatim from a `ManufacturerBrandCandidate` the port itself returned — there is no code path that
constructs or guesses a canonical string, checked explicitly in
`TestVocabularyBoundary` (`tests/unit/test_manufacturer_brand_resolver.py`).

**No LLM anywhere in this module** — every branch in `resolve_manufacturer_brand` is a real
`if`/comparison, per CLAUDE.md's "Where AI is allowed" table (candidate search is banned from AI).

### What is genuinely blocked, and what isn't

Because `UniCat_Manufacturer_and_Brand_List.xlsx` doesn't exist in this environment, every
non-placeholder value in the real `sample_input.csv` resolves to
`UNKNOWN(REFERENCE_DATA_UNAVAILABLE)` today — the resolver never even gets to look. This is the
correct, honest behaviour, not a bug: `docs/16-unilog-alignment.md` UH2's own done-criterion
("eval harness reports resolution accuracy against the 200-row gold set's
`MANUFACTURER_NAME`/`BRAND_NAME` columns") cannot be met in this environment — it needs both the
missing workbook *and* a gold set that UH0 already established doesn't exist either (§7 above), *and*
an `EVL` eval harness that hasn't been built yet (§4's "not built yet" table — still true). All three
gaps are pre-existing and documented, not new.

What the exact/normalized-exact/alias/fuzzy/ambiguous decision tree actually does is proven instead
against a small, explicitly-labelled **test fixture** (`_FIXTURE_CANDIDATES` in
`tests/unit/test_manufacturer_brand_resolver.py` and `test_manufacturer_brand_list_adapter.py`) —
every test and docstring that touches it says, in words, that it is not real UniCat data. This is
ordinary unit testing against a fake adapter satisfying a `Protocol`, the same pattern
`infrastructure/memory/repositories.py` already uses for `RecordRepository` — not a violation of
"don't fabricate reference data", which is about presenting invented data *as if* it were the real
UniCat pack.

### Descriptive statistics — real `sample_input.csv`, not accuracy

`infrastructure/reference_data/manufacturer_brand_stats.py`, run against the real file (see
`tests/unit/test_manufacturer_brand_stats.py`, whose asserted numbers were read off an actual run,
not chosen to make the test pass):

| Field | Raw distinct | Placeholder rows | Normalised clusters |
|---|---|---|---|
| `Part_Manuf` | 76 | 41 (`-`) | 75 |
| `E1_Brand` | 13 | 799 (`-- Unbranded --`) | 12 |
| `DIB_Brand` | 24 | 755 (`-- No DIB Brand --`) | 23 |

`Part_Manuf`'s 959 non-placeholder values all carry a trailing parenthetical code (e.g. `Freud Inc
(2435)`, `Jam Industrial Supply LLC (JAMIN)`) — 75 distinct codes, extracted by normalisation, never
discarded. **These are corpus-shape statistics, not accuracy** — no genuine approved-vocabulary match
has ever been checked in this environment, per UH2 brief §16's explicit "never call match rate =
accuracy" instruction.

**General conflict detection** (UH2 brief §12), run against real data with no hardcoded special
case (brief §11): comparing normalised `Part_Manuf` against normalised `DIB_Brand` on the same row
(the two brand-ish fields `sample_input.csv` actually has — it has no manufacturer↔brand↔URL
relationship table to check against, so that specific three-way check UH2 brief §12 describes stays
architecturally supported but empirically unexercised here) finds **9 near-miss candidates**
(similarity ≥ 0.5, not exact). The clearest: `DIB_Brand="Philips"` vs `Part_Manuf="Phillips Lighting
(5831)"` on 109 rows — a genuine spelling discrepancy in the supplied data, the same class of finding
`docs/16-unilog-alignment.md` §2 documents for Rheem/Frigidaire in the Delivery Format file, found
here by the general scan, not hardcoded. Also found: `Southwire/g Turner` vs `Southwire` (14 rows),
`Satco Prod Inc` vs `Satco` (15 rows), `Milwaukee Accessory` vs `Milwaukee` (9 rows), `Leviton Mfg
Co` vs `Leviton` (16 rows), and four single-row pairs — all descriptive-suffix differences except
Philips/Phillips, which is the one worth a reviewer's attention.

**A real domain trap surfaced while inspecting this column, worth flagging even though it wasn't
asked for by name:** `Part_Manuf` is not reliably "the manufacturer" semantically. Row 2's
`Part_Manuf` is `Jam Industrial Supply LLC (JAMIN)` for a product whose `Part_Desc` is `"3M 775L
Stikit Film..."` — `Jam Industrial Supply LLC` is a distributor/reseller, not 3M. Any pipeline that
resolves `Part_Manuf` and asserts it as `MANUFACTURER_NAME` without independent verification against
an approved list would silently launder distributor identity as manufacturer identity for an unknown
fraction of rows — exactly the failure mode CLAUDE.md's "prove every value against its source" thesis
exists to catch. Not fixed here (no approved list to verify against yet); documented so UH4's
extraction work inherits the warning instead of rediscovering it.

### API / frontend — deliberately untouched

No new endpoint. `docs/16-unilog-alignment.md` UH2's "done when" criterion is eval-harness-shaped, not
API-shaped, and no pipeline stage yet calls `resolve_manufacturer_brand` against live records — there
is no write path (`POST /records/*`) for it to feed (§4's "not built yet" table, unchanged by this
milestone). Per this session's brief §13 and §19: don't invent an endpoint UH2 doesn't genuinely need,
and the frontend stays frozen. The three new `UnknownReason` values are backend-domain-only for now;
`frontend/lib/contracts/attribute-value.ts`'s `UNKNOWN_REASONS` `zod` enum would need widening
*before* any endpoint ever serves a RES-produced value to the UI — the same caveat UH1 already
recorded for the two new evidence kinds, not yet exercised for the same reason (nothing emits them
over the wire today).

### Tests added

60 new tests across five files: `test_manufacturer_brand_normalization.py` (22 — whitespace, case,
®/™/©, legal-suffix folding, embedded-code extraction, source preservation, determinism/idempotency,
fuzzy-similarity properties), `test_manufacturer_brand_resolver.py` (23 — exact/normalized/alias/fuzzy
tiers, fuzzy-never-accepts, ambiguous ties at both the fuzzy and deterministic-collision level, no-match,
both placeholder and reference-unavailable `Unknown` paths and their ordering, vocabulary-boundary,
evidence shape, source preservation, determinism), `test_manufacturer_brand_list_adapter.py` (9 —
indexed lookup correctness, field-scoping, the missing-workbook failure), `test_resolution_policy.py`
(4 — real YAML loads, out-of-range rejection), `test_manufacturer_brand_stats.py` (9 — every number
read off a real run against `sample_input.csv`, including the Philips/Phillips finding). All prior
UH0/UH1 tests (90) still pass unmodified — regression is green.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH2
addendum below), `docs/decisions.md` (two new entries + OD-6 tracking the missing reference pack as a
standing open item), `CLAUDE.md` (added `RES` to the module-code table — the only edit; still under
250 lines), `resources/reference/unihack/README.md` (third re-verification note). No new ADR: this
implements decisions ADR-0014 and the 2026-08-13 `Evidence`-widening entry already made, rather than
introducing a new one.

---

## 10. UH3 — Taxonomy/LOV cutover, `SCH` (2026-08-14)

**Status: PARTIAL — architecture complete and fully tested; real cutover blocked on missing
reference data.** `make check` (backend): 211 tests (up from 150 after UH2 — +61 new), `ruff
check`/`ruff format --check` clean, `mypy --strict` clean on `domain/`, `application/`,
`infrastructure/`, `api/`.

### Source data — re-verified before writing any code

`Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `Fittings_LOV.xlsx`, and `FAUCETS_LOV.xlsx` were
searched for again at the start of this UH3 session — the user's home directory (Desktop, Downloads,
Documents) machine-wide by filename pattern, plus a broader `.xlsx`/`.docx` sweep of Desktop/
Downloads/Documents. This is at least the fourth independent verification pass across sessions
(UH0 ×2, UH2, this one) to reach the same conclusion: **none of the three files exist anywhere in
this environment.** No substitute or fabricated workbook was created. What is real and unchanged:
`sample_input.csv` has no `Classpath` column at all — real rows cannot be classified into
Fittings/Faucets scope from anything this environment actually holds, a stronger gap than UH2's
(RES at least had `Part_Manuf` to resolve against).

### What was built — the LOV/taxonomy architecture, independent of the missing workbooks

The same "architecture now, data later" shape UH2 established for `RES`, applied to `SCH`:

| Layer | File | What it does |
|---|---|---|
| Domain — value objects | `domain/model/taxonomy.py` | `LovClasspath` (segment-wise, not string-prefix, hierarchy — `is_under`), `ProductCategory` (`FITTINGS`/`FAUCETS`, closed), `CategoryScopeRule` + `classify_category` (pure scope boundary), `LovRow` (one row of the ~161k-row Unicat sheet), `LovAttributeDefinition` + `build_attribute_definitions` (pure grouping), `CanonicalValueMapping` + `index_canonical_values` (the Fittings/Faucets many-to-one variant→canonical shape) |
| Domain — schema engine (pure, INV-6) | `domain/sch/schema_engine.py` | `RiskTierPolicy`, `assign_risk_tier` (keyword match against `normalized_label`, never a per-attribute hardcoded table), `to_attribute_ref`/`build_schema` (LOV attribute definitions → the existing `AttributeRef` shape `EXT`/`VER`/`VAL` already consume) |
| Application — ports | `application/ports/taxonomy.py` | `TaxonomyReference`, `CanonicalValueReference` — `application/` depends on these only, never a concrete adapter |
| Application — use case | `application/usecases/resolve_schema.py` | `resolve_schema_for_classpath`: scope check → reference-availability check → attribute-definitions-present check → `SchemaResolved`/`SchemaBlocked` (sealed result, mirrors `AttributeValueAsserted`/`AttributeValueUnknown`'s two-shape pattern) |
| Infrastructure — adapters | `infrastructure/reference_data/taxonomy_lov.py`, `canonical_value_lov.py`, `fittings_lov.py`, `faucets_lov.py` | Indexed, fully implemented and tested against small fixtures. Each `load_*_reference()` calls `missing_datasets.require(...)` rather than guessing at a column layout no one has seen — same discipline as UH2's `manufacturer_brand_list.py` |
| Infrastructure — policy | `resources/policy/attribute_risk_tiers.yaml`, `resources/policy/category_scope.yaml`, `infrastructure/attribute_risk_policy.py`, `infrastructure/category_scope_policy.py` | Thresholds/boundaries as declarative config, mirroring `resolution_policy.py`'s pattern |

`ADR-0011`'s hand-authored `classes.yaml`/`taxonomy_loader.py` (the bronze-ball-valve fixture) is
**untouched** — ADR-0014 already scoped it to stay as the architecture-test fixture it already is;
UH3 adds the replacement schema source for Fittings/Faucets alongside it, not instead of it.

**The `category_scope.yaml` config is deliberately shipped empty.** The only source that would supply
real `Classpath` prefixes for Fittings/Faucets is the missing Unicat LOV workbook; inventing
plausible-looking prefixes would be exactly the fabricated-reference-data failure mode CLAUDE.md and
this track's brief forbid. `classify_category` returns `None` (out of scope) for every real classpath
today — an honest "cannot classify yet", proven by `test_category_scope_policy.py`'s
`test_real_shipped_config_is_empty`, not a silently wrong answer.

**`is_mandatory` on every LOV-sourced `AttributeRef` defaults to `False`.** The LOV columns ADR-0014
documents (`Filtering Y/N`) describe a faceted-search flag, not attribute mandatoriness; reusing it
for that would be guessing at a semantic the real file has never been inspected to confirm. This is a
known gap, not an oversight — flagged in `domain/sch/schema_engine.py`'s docstring for whoever adds
real mandatory-attribute handling once the file (or client clarification) arrives.

### What is genuinely blocked, and what isn't

Because none of the three LOV workbooks exist in this environment, `resolve_schema_for_classpath`
returns `SchemaBlocked(reason="CLASSPATH_OUT_OF_SCOPE...")` for every real classpath today — there is
no configured scope rule to match, so resolution never even reaches the reference-availability check.
Once a scope rule exists, the next honest outcome is `REFERENCE_DATA_UNAVAILABLE` (no taxonomy adapter
loaded) or `NO_ATTRIBUTE_DEFINITIONS` (adapter loaded but empty for that classpath) — both paths are
implemented and unit-tested even though neither is reachable with real data yet.
`docs/16-unilog-alignment.md` UH3's own done-criterion ("`GET /records/{id}` for a Fittings item
returns a schema-conformant attribute list... verified against 5 hand-traced Fittings rows from the
gold set") cannot be met in this environment — it needs the missing workbook, the still-missing gold
set (UH0), and a `POST`/write path that doesn't exist yet (§4's "not built yet" table, unchanged). None
of these three gaps are new.

What the classpath/scope/schema-resolution decision tree actually does is proven instead against
small, explicitly-labelled **test fixtures** (`tests/unit/test_taxonomy_lov_adapter.py`,
`test_fittings_lov_adapter.py`, `test_faucets_lov_adapter.py`, `test_resolve_schema.py`) — every
fixture and docstring that touches them says, in words, that it is not real Unicat/Fittings/Faucets
data, the same discipline `tests/unit/test_manufacturer_brand_resolver.py` established for UH2.

### API / frontend — deliberately untouched

No new endpoint and no frontend change, for the same reason UH1/UH2 recorded: nothing downstream
consumes `SCH`'s output yet (no write path), and the frontend stays frozen per this session's brief.

### Tests added

61 new tests across seven files: `test_taxonomy_domain.py` (26 — `LovClasspath` parsing/hierarchy
incl. the "no substring false-positive" case, `classify_category`, `LovRow`/`CanonicalValueMapping`
validation, `build_attribute_definitions` grouping/ordering, `index_canonical_values`),
`test_schema_engine.py` (13 — risk-tier keyword matching, slugification, datatype inference,
`build_schema` ordering), `test_taxonomy_lov_adapter.py` (6), `test_fittings_lov_adapter.py` (5),
`test_faucets_lov_adapter.py` (2), `test_attribute_risk_policy.py` (2 — real YAML loads),
`test_category_scope_policy.py` (3 — real *empty* YAML loads, fixture non-empty YAML parses), and
`test_resolve_schema.py` (4 — out-of-scope, reference-unavailable, no-rows, and the fully-resolved
happy path against a fake port). All prior UH0/UH1/UH2 tests (150) still pass unmodified.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH3
addendum), `resources/reference/unihack/README.md` (fourth re-verification note, UH3 scope added to
the missing-file table's context). No new ADR: this implements ADR-0014, already accepted.

---

## 11. UH4 — Extraction + verification, `EXT`/`VER`/`NRM` (2026-08-14)

**Status: PARTIAL — real end-to-end enrichment against `sample_input.csv` for four attributes;
class-specific (Fittings LOV) extraction architecture-only and blocked on missing reference data.**
`make check` (backend): 289 tests (up from 211 after UH3 — +78 new), `ruff check`/`ruff format
--check` clean, `mypy --strict` clean.

### What's genuinely real here — not just architecture

Unlike UH2/UH3, this milestone produces **real `ACCEPTED` `AttributeValue`s against the actual
supplied dataset**, not only fixture-tested architecture. `application/usecases/enrich_catalog_row.py`
runs against every one of the 1,000 real `sample_input.csv` rows
(`tests/unit/test_enrichment_stats.py`) and, for two of its four attributes, produces a genuinely
verified, evidenced, `ACCEPTED` value every time:

| Attribute | Source | Evidence | Result on the real 1,000 rows |
|---|---|---|---|
| `MFG_PART_NUM` | `Mfg_Part_Num` cell, verbatim | `SourceRowSpan` | 1000/1000 `ACCEPTED` (the loader already guarantees this column is never blank) |
| `ITEM_DESCRIPTION` | `Part_Desc` cell, verbatim | `SourceRowSpan` | 1000/1000 `ACCEPTED` (verified against the real file: no row has a blank `Part_Desc`) |
| `MANUFACTURER_NAME` | `Part_Manuf`, resolved via UH2's `RES` | `SourceRowSpan` + `ReferenceTableRow` | 0 `ACCEPTED` — 41 `Unknown(NO_BRAND_DECLARED)`, 959 `Unknown(REFERENCE_DATA_UNAVAILABLE)` (unchanged from UH2: the approved workbook still doesn't exist) |
| `BRAND_NAME` | `DIB_Brand`, resolved via UH2's `RES` | `SourceRowSpan` + `ReferenceTableRow` | 0 `ACCEPTED` — 755 `Unknown(NO_BRAND_DECLARED)`, 245 `Unknown(REFERENCE_DATA_UNAVAILABLE)` |

The `MFG_PART_NUM`/`ITEM_DESCRIPTION` verification is the strongest possible INV-3 case — the cited
`SourceRowSpan.snippet_text` *is* the asserted `value_raw`, checked by exact string equality
(`domain/ver/entailment.py:verify_exact_match`) — genuinely `ProvenanceKind.EXTRACTED` (a verbatim
quote, not a match/selection like `RES`'s `DERIVED` outputs), `risk_tier=1` so `ACCEPTED` is reachable
under INV-9. This is the honest ceiling of what real end-to-end enrichment can reach in this
environment without a Fittings/Faucets LOV to extract *class-specific* attributes against.

### What's architecture-only, and why

Class-specific attribute extraction (connection type, material, pressure rating — the attributes UH3's
`SchemaResolved` would actually list) is **not attempted against real rows**: `SCH` cannot resolve a
real schema without the still-missing Unicat LOV workbook (UH3 addendum, §10 above), so there is no
approved vocabulary to extract *or verify* a class-specific value against. Building a parser that
guesses connection type from `Part_Desc` free text with no LOV to check the result against would
assert a value with no independent verification path — exactly what INV-2 exists to prevent. Instead:

| Layer | File | What it does |
|---|---|---|
| Domain — entailment (pure) | `domain/ver/entailment.py` | `verify_exact_match` (used for real, above), `verify_lov_membership` (the "is this value in the Normalized Values set" check the UH4 brief specifies — implemented and unit-tested against fixtures; unreachable with real data until `SCH` unblocks) |
| Domain — fractions (pure) | `domain/nrm/fractions.py` | `parse_fraction`/`render_mixed_fraction` — the general algorithm CLAUDE.md's domain trap documents (`1-1/4`, `1¼`, `1 1/4`, `1.25` → the same exact `Fraction`), independent of the still-missing `Decimal_Fraction.xlsx` because the parsing *rule* is project-documented knowledge, not client data |
| Domain — nominal size (pure) | `domain/nrm/nominal_size.py` | `NominalSize` (no `.to_mm()`, ever), cross-standard comparison returns `None`, `NPS_DN` equivalence table **ships empty** — OD-4 (`docs/decisions.md`) is still open, so no unverified NPS↔DN numbers were hardcoded |
| Domain — pressure (pure) | `domain/nrm/pressure.py` | `PressureRating` carries `media` in the type, no `.to_ansi_class()`/`.to_wog()`/`.to_wsp()` methods exist — NRM-17 enforced by absence, not a runtime guard |
| Domain — connections (pure) | `domain/nrm/connections.py`, `resources/nrm/connection_synonyms.yaml` | End-connection synonym matching transcribed verbatim from `docs/domain/pvf-reference.md` §5 (OpenSpec's own reviewed documentation, not client data) — `FIP ≈ FNPT ≈ NPT-F` all resolve to `NPT_FEMALE`; `resolve_ambiguous_socket` implements the documented "socket is ambiguous, resolve by material or abstain" rule |
| Application — stage | `application/stages/ext.py` | `extract_mfg_part_num`/`extract_item_description` — the real verbatim extraction above |
| Application — use case | `application/usecases/enrich_catalog_row.py` | Ties `EXT` + UH2's `RES` together per row; takes primitive row fields, not the infrastructure `SupplierInputRow` type directly (`application/` may never import `infrastructure/`) |
| Infrastructure — stats | `infrastructure/reference_data/enrichment_stats.py` | `compute_enrichment_coverage_stats` — the real numbers in the table above, run against the actual file, mirroring `manufacturer_brand_stats.py`'s "real numbers from a real run" discipline |

**A new `UnknownReason`, `SOURCE_FIELD_BLANK`**, was added (`domain/model/attribute.py`) for a
source-row cell that is empty — distinct from `NO_DOCUMENT_FOUND` (there is no document in play for a
source-row-derived attribute) and unreachable on the real file today (verified: neither
`Mfg_Part_Num` nor `Part_Desc` is ever blank) but exercised in `tests/unit/test_ext_stage.py`.

### Evaluation — coverage, not accuracy (per this session's explicit instruction)

`EnrichmentCoverageStats.evidence_coverage(attribute_code)` reports the fraction of the 1,000 real
rows that produced an evidenced value (`ACCEPTED` or `NEEDS_REVIEW`) for that attribute:
`MFG_PART_NUM`/`ITEM_DESCRIPTION` = 1.0, `MANUFACTURER_NAME`/`BRAND_NAME` = 0.0. **No accuracy number
is reported anywhere in this milestone** — there is no gold set in this environment (UH0's still-open
gap) to check a value against, only whether one was produced with evidence at all. This is coverage,
explicitly not correctness, per the UH4 brief's "keep 'coverage' and 'accuracy' separate" instruction.

### What is genuinely blocked, and what isn't

Blocked: any attribute that needs `Fittings_LOV.xlsx`/`FAUCETS_LOV.xlsx`/`Unicat_Lov_v1_0...xlsx`
(class-specific extraction, LOV-membership verification against real data), `Decimal_Fraction.xlsx`
(a verified fraction lookup beyond the general parsing algorithm already built), `Unilog_Master_UOM_Standards...xlsx`
(canonical unit abbreviations — `PressureRating.unit` stays a plain string until then), and a verified
primary source for NPS↔DN equivalence (OD-4). Not blocked, and real today: verbatim source-row
extraction and its exact-match verification, and the manufacturer/brand resolution architecture from
UH2 (still returning honest `Unknown`s pending its own missing workbook).

`domain/val/` (a declarative validation-rule engine per PRS-*/SIZ-*/END-*/TMP-*/MAT-* in
`docs/domain/pvf-reference.md` §10) was **not built this milestone** — those rules need real
Fittings-specific value ranges (e.g. an approved WOG range) that don't exist without the LOV; building
a rules engine now with no real rule to load would be scaffolding without a test that proves anything
beyond "the engine runs." Deferred, not forgotten.

### Tests added

78 new tests across nine files: `test_fractions.py` (14), `test_nominal_size.py` (11),
`test_pressure.py` (11), `test_connections.py` (11), `test_nrm_resources.py` (3 — real YAML loads),
`test_entailment.py` (9), `test_ext_stage.py` (6), `test_enrich_catalog_row.py` (4),
`test_enrichment_stats.py` (7 — every number read off a real run against the real 1,000-row file, same
discipline as `test_manufacturer_brand_stats.py`). All prior 211 tests still pass unmodified.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH4
addendum), `docs/decisions.md` (one new entry). No new ADR.

---

## 12. UH5 — Description construction, `DSC` (2026-08-14)

**Status: PARTIAL — formula engine and validation architecture complete and fully tested; real class
formulas blocked on the missing content-guidelines document.** `make check` (backend): 331 tests (up
from 289 after UH4 — +42 new), `ruff check`/`ruff format --check` clean, `mypy --strict` clean.

### Source data

`UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` — the document ADR-0013 names as the source of the real
per-field construction formulas — was searched for again at the start of this UH5 session; still not
present (fifth independent verification pass across UH0/UH2/UH3/UH4/UH5). What *is* real: the two
example rows in `resources/reference/unihack/delivery_format.csv`, which give one confirmed,
cross-checkable data point each for two of the five description fields — used to validate, not to
reverse-engineer a formula from (n=2 examples of a different category, Dishwashers, is not a
documented formula; treating it as one would be exactly the fabrication this track forbids).

### What was built

| Layer | File | What it does |
|---|---|---|
| Domain — value objects (pure) | `domain/model/description.py` | `DescriptionFormula`, `AttributeSlot`/`LiteralSlot` (sealed `FormulaSlot` union), `Casing`, `DescriptionFieldConstraint` |
| Domain — formula engine (pure, INV-6) | `domain/dsc/formula_engine.py` | `build_description`: composes only `ACCEPTED` attribute values (`NEEDS_REVIEW` is *not* approved yet, so it's omitted like a missing attribute — ADR-0013's "never inferred to fill a template gap", extended to "never composed from an unapproved value" too), full traceability back to the source `AttributeValueAsserted`s used |
| Domain — validation (pure) | `domain/dsc/validation.py` | `CONFIRMED_FIELD_CONSTRAINTS` — **only** `INVOICE_DESC` (≤40 char, CAPS) and `MOBILE_DESC` (60–80 char), the two fields ADR-0013's own worked example gives a number for; every other field gets only the universal non-empty check, never an invented limit |
| Application — port | `application/ports/description_formulas.py` | `DescriptionFormulaReference` |
| Application — use case | `application/usecases/build_description.py` | `build_field_description`: resolve formula → build → validate → `DescriptionBuilt`/`DescriptionBlocked` |
| Infrastructure — loader/adapter | `infrastructure/reference_data/description_formulas.py` | `load_class_formulas`, `DescriptionFormulaAdapter` — fully implemented, tested against fixture YAML, **not** against `resources/description-formulas/` (which ships empty) |
| Resources | `resources/description-formulas/README.md` | Documents the blocker and the file format a real formula would use; **no class `.yaml` files shipped** |

### Why no class formulas were written

Writing `FITTINGS.yaml`/`FAUCETS.yaml` now would mean inventing how `INVOICE_DESC`/`MOBILE_DESC`/
`SHORT_DESC`/`LONG_DESC1`/`ITEM_FEATURES_n` are actually assembled — there is no documented formula
for any of the five fields beyond the two confirmed length/casing constraints above. `resources/
description-formulas/` is treated differently from the client-workbook gaps elsewhere in this track:
a missing class file there means "no formula configured yet" (an empty dict, not a loud crash) because
it's *this project's own* config, legitimately starting empty — `build_field_description` returns
`DescriptionBlocked(reason="NO_FORMULA_CONFIGURED")` for every field+class today, the same honest
"cannot do this yet" shape as UH2's `Unknown(REFERENCE_DATA_UNAVAILABLE)` and UH3's `SchemaBlocked`.

### Validation — real, not deferred

Unlike the formulas themselves, the two confirmed constraints are fully real and tested against both
fixtures and the two genuine example rows in `delivery_format.csv`
(`TestConfirmedConstraintsAgainstRealExampleRows` in `tests/unit/test_dsc_validation.py`): both real
`INVOICE_DESC` values (38/39 chars, all-caps) and both real `MOBILE_DESC` values (75/64 chars) pass
the confirmed rules — consistent with, not proof of, the constraint being correct in general.

### Tests added

42 new tests across five files: `test_description_domain.py` (9), `test_formula_engine.py` (8 —
composition, omission of missing/unknown/`NEEDS_REVIEW` attributes, per-slot vs overall casing,
determinism), `test_dsc_validation.py` (14 — including the real-example-row cross-check),
`test_description_formula_loader.py` (7 — fixture parsing, missing-file-is-empty-dict, the real
shipped directory's honest emptiness), `test_build_description.py` (4 — blocked vs built, a failing
length check still returns a built (not silently truncated) description). All prior 289 tests still
pass unmodified.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH5
addendum), `docs/decisions.md` (one new entry), `resources/description-formulas/README.md` (new). No
new ADR: this implements ADR-0013, already accepted.

---

## 13. UH6 — Faucets parity, `CNF`, real-backend integration assessment (2026-08-14)

**Status: PARTIAL — Faucets architecture parity proven, `CNF` scoring/calibration/routing built and
tested (calibration blocked on the still-missing gold set), frontend integration assessed and
deliberately left pointed at mock data.** `make check` (backend): 362 tests (up from 331 after UH5 —
+31 new), `ruff check`/`ruff format --check` clean, `mypy --strict` clean.

### Faucets — proven as data, not code

UH3 already built the taxonomy/LOV architecture category-agnostically (`ProductCategory.FITTINGS |
FAUCETS`, `CanonicalValueLovAdapter` shared by `fittings_lov.py`/`faucets_lov.py`,
`resolve_schema_for_classpath` scoped by `category_scope.yaml` rules, not a hardcoded category). UH4's
`enrich_catalog_row`/`extract_*` functions are also category-agnostic — they operate on row fields, not
a Fittings-specific shape. `tests/unit/test_faucets_parity.py` proves this directly: the same
`resolve_schema_for_classpath` call and the same `CanonicalValueLovAdapter` instance serve both a
Fittings and a Faucets classpath side by side, from one set of `category_scope.yaml`-shaped rules —
ADR-0014's "adding a sixth class is a YAML file, zero code changes" claim, extended here to a second
*category*. `FAUCETS_LOV.xlsx` itself remains unavailable (fifth+ verification pass, unchanged from
UH3's addendum), so real Faucets attribute/canonicalisation data is still blocked — the parity proof is
architectural, not a real Faucets extraction run.

### `CNF` — composite scoring, calibration, and INV-9 routing

New this milestone (`docs/16-unilog-alignment.md` UH6: "`CNF` composite scoring calibrated on the
combined gold set"):

| Layer | File | What it does |
|---|---|---|
| Domain — scoring (pure) | `domain/cnf/scoring.py` | `ConfidenceSignal` (named, weighted, `[0,1]`-bounded), `composite_raw_score` — a weighted average, never a single model-reported number (CLAUDE.md) |
| Domain — calibration (pure) | `domain/cnf/calibration.py` | `CalibrationCurve` (piecewise-linear, must span `[0,1]`), `identity_calibration_curve()` — the honest "not calibrated yet" default |
| Domain — routing (pure) | `domain/cnf/routing.py` | `route()` — Tier 0 always routes to `NEEDS_APPROVAL` regardless of confidence, the routing-time mirror of `AttributeValueAsserted`'s own INV-9 constructor guard |
| Infrastructure — policy | `resources/policy/cnf_routing.yaml`, `infrastructure/cnf_policy.py` | `accept_threshold: 0.85` — a placeholder default, explicitly flagged as uncalibrated, mirroring `manufacturer_brand_resolution.yaml`'s existing caveat pattern |

**Not calibrated against real outcomes** — no gold set exists in this environment (UH0's still-open
gap) to fit a real curve or tune the threshold against. `identity_calibration_curve()` is deliberately
the domain's default rather than an invented fit. `EXT`/`RES` (UH2/UH4) were **not** retrofitted to
route through `CNF` this milestone — they already have their own tested, working status logic
(deterministic-tier confidence for `RES`, `1.0` for verbatim `EXT`), and rewiring them without a gold
set to prove the composite/calibrated path produces better routing would be architectural churn without
a measurable benefit. `CNF` is real, tested, standalone architecture, ready to be wired in once there's
a signal set worth compositing and a gold set to calibrate against.

### Frontend / real-backend integration

Reviewed `frontend/lib/api/client.ts` (single fetch wrapper, `NEXT_PUBLIC_API_BASE_URL` env-driven,
defaults to the mock) and `frontend/lib/contracts/*.ts` against `api/schemas/*.py` and
`tests/contract/test_records_api.py` — no drift since UH1/UH2 (those sessions' additive changes to
`Evidence`/`UnknownReason` were confirmed non-breaking for the frontend's non-strict `zod` schemas at
the time, unchanged since). `tests/contract/test_records_api.py` already runs against a live, in-process
FastAPI `TestClient` (the closest to "live responses, not just shape" achievable without a deployed
Postgres — §3 above), and continues to pass.

**Deliberately not flipping the frontend's default to the real backend.** The real backend today serves
exactly two endpoints and two demo records (the ADR-0011 bronze-ball-valve fixture, `infrastructure/
memory/repositories.py`) — unrelated to the Fittings/Faucets scope this whole track targets, and there
is still no write path (`POST /records/*`) for any of UH2/UH4/UH5/UH6's real pipeline output
(`sample_input.csv` rows, `enrich_catalog_row` results) to reach the API at all. Pointing the frontend
at it today would **replace** the mock's ~240-record fixture universe with two unrelated records —
strictly worse for a demo, not better, and would violate this session's explicit "do not break mock
mode" / "preserve the ability to run against the mock backend" instructions if it became the default.
`docs/16-unilog-alignment.md` UH6's own "done when" (review queue/Judge Mode/Why panel on live
Fittings+Faucets records, no mock fallback) genuinely needs the write path plus real reference data
neither of which this environment has — an honest gap, not an oversight. No frontend file was changed.

### Tests added

31 new tests across five files: `test_cnf_scoring.py` (8), `test_cnf_calibration.py` (9),
`test_cnf_routing.py` (6), `test_cnf_policy.py` (1 — real YAML loads), `test_faucets_parity.py` (2 —
the category-parity proof). All prior 331 tests still pass unmodified.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH6
addendum), `docs/decisions.md` (one new entry). No new ADR.

---

## 14. UH7 — Delivery Format export, `ExportTarget` (2026-08-14)

**Status: PARTIAL — export projection/validation architecture built, tested, and run against the real
1,000-row `sample_input.csv` through the real 252-column schema; deployment/live-link work is an
environment blocker, not attempted.** `make check` (backend): 395 tests (up from 362 after UH6 — +33
new), `ruff check`/`ruff format --check` clean, `mypy --strict` clean.

### What was built

| Layer | File | What it does |
|---|---|---|
| Application — port | `application/ports/export.py` | `ExportTarget` (ADR-0010) — format-agnostic: `(rows, column_order) -> bytes` |
| Infrastructure — generic adapter | `infrastructure/export/csv_target.py` | `CsvExportTarget` — the first concrete `ExportTarget`, per ADR-0010's "generic CSV/JSON/XLSX ship first" |
| Infrastructure — projection | `infrastructure/export/delivery_format_projection.py` | `project_record_to_delivery_format_row`: internal `AttributeValue`s → the real 252-column row shape, using the real, live-loaded `DeliveryFormatSchema` (UH0) — never a hand-typed second schema |
| Infrastructure — validation | `infrastructure/export/delivery_format_validation.py` | Column count/names/order, `ATTRIBUTE_LABEL/VALUE/UOM` triple consistency, `ITEM_FEATURES_n` duplicate detection, description char-limit/casing (reuses UH5's `domain/dsc/validation.py`) |
| Infrastructure — eval | `infrastructure/export/delivery_format_eval.py` | `compute_delivery_format_export_report` — coverage statistics from a real run, never accuracy |

**`ATTRIBUTE_TO_COLUMN` maps exactly four internal attribute codes to real columns** (verified against
the live CSV header, not assumed): `MFG_PART_NUM`→`Mfg_Part_Num`, `ITEM_DESCRIPTION`→`Part_Desc`,
`MANUFACTURER_NAME`→`MANUFACTURER_NAME`, `BRAND_NAME`→`BRAND_NAME` — exactly the four attributes UH4's
`enrich_catalog_row` actually produces real values for. Every other column (the 50 `ATTRIBUTE_LABEL/
VALUE/UOM` triples, 20 `ITEM_FEATURES_n`, five description fields, pricing, images, documents, ...) has
no source in this environment and is projected as the empty string — never a fabricated value, never
literal `"N/A"`/`"Unknown"` text (INV-4). The real `unknown_reason` for why a column is empty stays in
the domain layer's own store; a flat 252-column CSV row has no column to carry it, which is a limitation
of the target format, not something this system silently drops.

### Real run against the real data — coverage, not accuracy

`tests/unit/test_delivery_format_eval.py` runs the full `enrich_catalog_row` → project → validate
pipeline against all 1,000 real `sample_input.csv` rows, through the real, live-loaded 252-column
schema:

| Metric | Value |
|---|---|
| Rows exported | 1000 |
| Column count | 252 (matches the live schema exactly, every row) |
| `Mfg_Part_Num` / `Part_Desc` population | 1000/1000 (100%) |
| `MANUFACTURER_NAME` / `BRAND_NAME` population | 0/1000 (0% — honest, per UH2's still-missing workbook) |
| `EXPORT-COLUMN-COUNT` / `-NAMES` / `-ORDER` | 1000/1000 pass, every row |
| `EXPORT-ITEM-FEATURES-NO-DUPLICATES` | 1000/1000 pass (vacuously — no features populated yet) |
| Validation failures | 0 |

**No per-column field accuracy, no LOV-membership rate, no gold-set score is reported anywhere in this
milestone** — there is no gold set (UH0) and no LOV reference data (UH3) in this environment to compute
either against. What's reported is exactly what UH7's brief asks for when a gold set doesn't exist:
processed rows, population/coverage, and validation pass/fail counts.

### Deployment — environment blocker, not attempted

`docs/16-unilog-alignment.md` UH7 also asks for "backend deployed against hosted Postgres" and a
working "Live Prototype Link". This requires provisioning an external hosted Postgres (Neon/Supabase)
and a hosting platform for both frontend and backend — actions requiring account creation, credentials,
and irreversible external service state that this session has neither the access nor the standing
authorization to create unilaterally. Consistent with §3's existing Postgres gap (no Docker/local
Postgres in this sandbox either) and this session's explicit no-git/no-push constraints, this is
recorded as a genuine **environment blocker**, not attempted, not faked with a placeholder URL.

### Dashboard numbers

UH7 also asks to regenerate frontend dashboard numbers "from the real eval run". The frontend dashboard
was already built to avoid fabricated hero numbers (its command-center imagery is a cropped supplied
mockup with the original fake-number panels painted out, predating this session) — there is no real
gold-set eval run in this environment to regenerate numbers from, and no dashboard-visible number in
this codebase was found to be sourced from invented data. No frontend change was made.

### Tests added

33 new tests across five files: `test_csv_export_target.py` (3), `test_delivery_format_projection.py`
(7 — including that every unmapped column, e.g. `UPC`/`List Price`, always projects empty),
`test_delivery_format_validation.py` (16 — every structural rule's pass and fail path), and
`test_delivery_format_eval.py` (5 — real numbers from the real 1,000-row run, same discipline as every
prior milestone's real-data tests). All prior 362 tests still pass unmodified.

### Documentation updated

`docs/15-backend-implementation-status.md` (this section), `docs/16-unilog-alignment.md` (UH7
addendum), `docs/decisions.md` (one new entry). No new ADR: this implements ADR-0010, already accepted.

---

## 15. M0 — gap analysis + foundation (2026-08-14)

**Status: COMPLETE against the true remaining M0 scope; two deliverables genuinely blocked by
missing source data, not implemented.** `docs/16-unilog-alignment.md` §5 already noted "M0's
architectural deliverables are already substantially done" from UH0–UH7 — this session returned to
`docs/10-roadmap.md`'s original M0 checklist verbatim, compared it against the repository as it
actually stood (not as UH0–UH7's own write-ups summarised it), and closed the gaps that were real.
`make check` (backend, run directly — see "Environment constraints" below): **474 tests collected (up
from 395 before this session) — 469 passed, 5 skipped honestly** (Postgres-dependent integration
tests — see §3, unchanged), `ruff check`/`ruff format --check` clean, `mypy --strict` clean on 97
source files (up from 88).

### Gap analysis — M0's checklist against what actually existed

| M0 deliverable (`docs/10-roadmap.md` verbatim) | Before this session | Action |
|---|---|---|
| Repo, `docker-compose.yml`, `Makefile`, CI skeleton, `.env.example` | Existed **inside `backend/`** only; nothing at repo root despite `docs/07-devops.md` §1's layout diagram and `CLAUDE.md`'s own Commands table both documenting root-level `make up`/`make seed`/`make test`/`make eval`/`make demo` | Added root `Makefile` (delegates to `backend/`+`frontend/`, honest stubs for `eval`/`demo`/`snapshot` — later milestones), root `docker-compose.yml` (Compose `include:` of `backend/docker-compose.yml`, zero duplication), root `.env.example` (pointer to each subproject's own) |
| Postgres schema migration #1 including every INV `CHECK` constraint | Schema designed (`infrastructure/db/models.py`), DDL-compile-tested, **no Alembic migration existed at all** | `alembic.ini` + `alembic/env.py` (targets `Base.metadata` directly — one source of truth) + `alembic/versions/0001_initial.py`. Found and fixed a real bug while building this: a circular FK (`attribute_value.verification_id` ↔ `verification.attribute_value_id`) that silently dropped both FK constraints from `create_all`/`drop_all`'s DDL (`SAWarning`, not an error — easy to miss) — fixed with `use_alter=True`, verified via `alembic upgrade head --sql` generating correct SQL for all 20 tables plus the deferred `ALTER TABLE` |
| `resources/` loading: taxonomy, attributes, rules, units, abbreviations | Taxonomy YAML existed and loaded into the domain layer (`taxonomy_loader.py`) at request time; nothing loaded it into the DB schema. `rules/`, `units/`, `abbreviations/` directories don't exist — later milestones (`VAL`/`NRM`) per `docs/13-implementation-blueprint.md` step 12/13, correctly not fabricated | Not expanded beyond taxonomy (the only resource type that exists) — see seeder row below |
| Idempotent seeder | Did not exist | `infrastructure/db/seed.py` (`seed_taxonomy`: `INSERT ... ON CONFLICT DO UPDATE` keyed on the schema's own natural-key constraints) + `scripts/seed.py` CLI |
| `tests/architecture/` — layering, INV-1, INV-6, no-`eval`, no-hard-delete | All four existed and pass (UH0–UH1) | Verified they **demonstrably fail**: temporarily added a banned `import os` to `domain/ing/mpn.py`, confirmed `test_layering.py` failed with the exact violation named, reverted — not just "the test exists," proven live this session |
| `llm_call` ledger table + cost accounting scaffolding | Table existed in `infrastructure/db/models.py`; no port, no adapter | `LlmResponse` (`application/ports/llm.py`) carries the fields `llm_call` needs (`tokens_in/out`, `cost_usd`, `outcome`) — the ledger-*writing* use case is deferred with the write path in general (see "Not built" below), consistent with `docs/15-backend-implementation-status.md` §4's existing scoping |
| `BlobStore` port with local FS **and** S3 adapters | Did not exist | `application/ports/blob.py` + `infrastructure/blob/local.py` (real, filesystem-tested) + `infrastructure/blob/s3.py` (`boto3`, unit-tested against a mocked client — no live AWS credentials in this sandbox) |
| `LLMProvider` port with real, `cached` (replay), and `offline` adapters | Did not exist | `application/ports/llm.py` + `infrastructure/llm/{anthropic_provider,cached,offline}.py`. `resources/llm-cache/` ships empty — no pipeline stage calls this port yet, so there is nothing real to record (same discipline `resources/description-formulas/` already established) |
| ING module: CSV import with column mapping, per-row error reporting | Did not exist — no write path of any kind existed before this session (`docs/15-backend-implementation-status.md` §4's "not built yet" table, now partly closed) | `domain/ing/mpn.py`, `application/stages/ing.py`, `application/usecases/ingest_batch.py`, `application/ports/import_repository.py`, `POST /records/import` + `GET /records/import/{batch_id}` (`api/routers/records.py`, exactly the routes `docs/api.md` already documented). `infrastructure/memory/repositories.py` extended to implement the new write port alongside its existing read-only role — one process-lifetime store, so an imported record is visible to `GET /records` immediately |
| Frontend shell: nav, `/catalog` list, `/catalog/:id` stub | Already far exceeded by the UH-track frontend (full catalog/documents/review/judge UI on mock data) | No change — frontend stays frozen, this bullet was already done |
| Corpus fetch scripts + `corpus/manifest.json`; 150+ documents | Did not exist | **Not implemented — genuine blocker, not a decision.** This bullet targets the original hand-authored PVF/ball-valve corpus; `docs/16-unilog-alignment.md` §4/ADR-0014 already demoted that corpus to an architecture-test fixture with no client-supplied ground truth to score against, and the UniHack pivot's own manufacturer-PDF corpus has been independently confirmed absent from this environment across UH2–UH7 (five-plus verification passes, `docs/15-backend-implementation-status.md` §7 onward). There is no target document list in this environment to write a fetch script against without inventing one |
| Gold set v1: 150 labelled attribute values | Did not exist | **Not implemented — genuine blocker, same root cause as UH0's still-open gap.** The client's own Delivery Format file has 2 example rows (both Dishwashers, `docs/15-backend-implementation-status.md` §7), not a 150+ row labelled set; labelling 150 values with no corpus/vocabulary to label against would mean inventing ground truth, forbidden by this session's explicit instruction and by `CLAUDE.md`'s domain-trap discipline |
| Decision on CX1 integration research (OD-2) | Partially resolved by UH7: Delivery Format CSV confirmed as export target, live CX1 API schema still unconfirmed | Unchanged — no new information available this session; `docs/decisions.md` OD-2 already records the partial resolution accurately |

### Reuse — what was *not* rebuilt

`AttributeValue`/`Evidence`/pipeline state machine (`domain/model/`), all four `tests/architecture/`
files, `infrastructure/taxonomy_loader.py`, `infrastructure/db/models.py`'s 20-table schema (one bug
fixed, not redesigned), `api/main.py`/`api/errors.py`'s correlation-id middleware and problem+json
error shape, `config/settings.py`, and — critically — `infrastructure/memory/repositories.py`'s
existing read-only demo dataset, which is **extended, not replaced**: the same class now also
implements the new write port, and the original two demo records (`CANONICAL_RECORD_ID` etc.) are
untouched, still asserted against by the pre-existing contract tests.

### Environment constraints (verified this session, not assumed)

- **No `docker` binary** in this sandbox (`docker: command not found`) — one level below the
  previously-documented "no Docker/Postgres" gap (§3): even `docker compose config` to validate the
  new root `docker-compose.yml`'s `include:` directive isn't possible here.
- **No `make` binary** either — every command in this report's tables was run as the underlying
  `.venv/Scripts/python -m {pytest,mypy,ruff}` invocation the new `Makefile`s wrap, not via `make`
  itself. The `Makefile`s are still correct, reviewable POSIX Make syntax (tab-indented recipes
  verified byte-for-byte with `cat -A`) — just not executable *as `make`* in this environment.
- Network access for `pip install` **was** available this session (unlike the "no network beyond
  initial install" note in §6, which was accurate for earlier sessions) — `alembic`, `psycopg[binary]`,
  `boto3`, `anthropic`, `python-multipart`, and their type stubs were installed without issue and
  added to `pyproject.toml`'s `dependencies`.

### A housekeeping fix, not part of M0's checklist

Found two stray files at the **repo root** — `src/openspec/application/stages/__init__.py` and
`src/openspec/domain/cnf/__init__.py` — containing real, correctly-written docstrings for modules that
exist under `backend/src/openspec/...`, evidently created by a past session running from the wrong
working directory. Neither `application/stages/` nor `domain/cnf/` had an `__init__.py` in their real
location (harmless today — Python 3's implicit namespace packages mean nothing broke — but not the
convention every sibling package in this codebase follows). Moved the exact content to the correct
path under `backend/src/openspec/...` and removed the stray root `src/` directory. Flagged here rather
than silently deleted, per this session's own "surface what you didn't create" discipline.

### Tests added this session

`test_local_blob_store.py` (7), `test_s3_blob_store.py` (7), `test_cached_llm_provider.py` (5),
`test_offline_llm_provider.py` (2), `test_anthropic_provider.py` (4), `test_migration_0001.py` (5),
`tests/integration/test_constraints.py` (4, skip-if-no-Postgres), `test_seed.py` (5),
`tests/integration/test_seed_idempotency.py` (1, skip-if-no-Postgres), `test_mpn_canonicalization.py`
(9), `test_ing_stage.py` (17), `test_ingest_batch_usecase.py` (5),
`tests/contract/test_records_import_api.py` (8, including the real 1,000-row `sample_input.csv` run) —
79 new tests total (395 -> 474 collected). All 395 pre-existing tests still pass unmodified.

### Documentation updated

This section, `docs/decisions.md` (new entries below). `docs/10-roadmap.md` itself was **not**
edited — per this session's explicit instruction, it stays the plan, not a status log; this file is
where implementation status against that plan is recorded, per its own stated purpose. `README.md`'s
"Planning complete, implementation not started" status line and "Planned commands" section were
updated — both were true when written and are no longer, and `README.md` is a human's first read of
the repo, not internal status tracking.

---

## 16. M1 — CLS + SCH + EVL (2026-08-14)

**Status: COMPLETE against the true remaining M1 scope; real classification/evaluation accuracy
genuinely blocked on the same missing reference pack UH0–UH7 already documented — not a new gap.**
`make check` (backend): 577 tests collected (up from 474 before this session) — 572 passed, 5
skipped honestly (Postgres-dependent integration tests, unchanged from §3/§15), `ruff check`/`ruff
format --check` clean, `mypy --strict` clean on 113 source files (up from 97).

This session returned to `docs/10-roadmap.md`'s original M1 scope — CLS, SCH, EVL, in that
sequencing (`docs/16-unilog-alignment.md` §5: M0's architectural deliverables are already
substantially built by UH0–UH7; this session picks the roadmap's own M1 back up) — rather than
continuing the UH-track numbering, per this session's explicit brief.

### Source data — re-verified before writing any code

Before implementing anything, this session re-searched the environment specifically for a real
gold set (any `*gold*`-named file, every name in `infrastructure/reference_data/
missing_datasets.py`'s registry, "Fittings_LOV", "FAUCETS_LOV", "Sample Dataset", "Delivery
Format", ...): the user's Desktop, Downloads, and Documents, machine-wide. Found nothing new — the
same two CSVs already committed under `resources/reference/unihack/` (`delivery_format.csv`,
`sample_input.csv`), and one unrelated file from a different project
(`Desktop/Sahayak/data/eval/matching-golden-set.json` — a different hackathon's own fixture, not
this project's data, not used). This is at least the sixth independent verification pass across
sessions reaching the same conclusion (`resources/reference/unihack/README.md`,
`resources/reference/unihack/gold/README.md`). No substitute or fabricated gold set, LOV, or
taxonomy data was created.

### CLS — classification

**What was implemented.** The full CLS architecture from `docs/domain/pvf-reference.md` §8's own
description ("abbreviation dictionary... the deterministic pre-pass that resolves ~40% of
classification with no LLM call") through to a taxonomy-validated residual LLM path:

| Layer | File | What it does |
|---|---|---|
| Domain — value objects | `domain/model/classification.py` | `ClassificationCandidate` (method, confidence, rationale — INV-1-style non-empty checks), `ClassificationResolved`/`ClassificationUnresolved` sealed union (mirrors `AttributeValueAsserted`/`AttributeValueUnknown`'s "no third shape" discipline) |
| Domain — rules engine (pure, INV-6) | `domain/cls/rules_engine.py` | `expand_abbreviations` (whole-token, case-insensitive), `ClassificationRule` (AND-of-OR keyword groups), `apply_rules` |
| Application — use case | `application/usecases/classify_record.py` | `classify_record`: deterministic pre-pass first → residual LLM only on a miss → every LLM proposal validated against a caller-supplied `known_class_codes: frozenset[str]` before being trusted |
| Infrastructure — resources | `infrastructure/cls_resources.py`, `infrastructure/cls_policy.py`, `infrastructure/prompt_loader.py` | Loaders for `resources/cls/abbreviations.yaml`, `resources/policy/classification_rules.yaml`, `resources/policy/classification.yaml`, `resources/prompts/cls_v1.md` — mirrors `resolution_policy.py`/`attribute_risk_policy.py`'s established pattern |

**What data it uses.** `resources/cls/abbreviations.yaml` is transcribed verbatim from
`docs/domain/pvf-reference.md` §8 — OpenSpec's own already-reviewed domain documentation, the same
provenance discipline `resources/nrm/connection_synonyms.yaml` established for `NRM` (UH4).
`resources/policy/classification_rules.yaml` targets exactly one real class, `BALL_VALVE_BRONZE` —
the only class `resources/taxonomy/classes.yaml` (ADR-0011's fixture) actually loads — so the
deterministic pre-pass is genuinely real, executable, and unit-tested, not a fixture-only proof.
Fittings/Faucets category-level rules are deliberately **not** added: the only source for that
vocabulary is the still-missing Unicat LOV workbook, and inventing keyword rules for a client
category would be exactly the fabricated-reference-data failure mode this track forbids
(`resources/policy/classification_rules.yaml`'s own header comment explains this). `classify_record`
is class-set-agnostic (`known_class_codes: frozenset[str]`) precisely so that once the LOV exists,
the same code serves Fittings/Faucets classpaths with zero changes — the same "a class is data, not
code" claim ADR-0014/UH6 already proved for `SCH`.

**How deterministic and residual classification work.** Deterministic: text is abbreviation-expanded
(`expand_abbreviations`), then every `ClassificationRule` is checked (`apply_rules`); a rule fires
only when *every* keyword group has a member present (AND of ORs), so "ball valve AND (brass OR
bronze)" is one rule, not two. Two rules tying at the highest confidence is `Unknown
(AMBIGUOUS_CANDIDATES)`, never picked arbitrarily. Residual: only reached when no rule resolves (or
a matched rule names a class outside the caller's known set / misses the confidence floor); builds
a prompt from the versioned `resources/prompts/cls_v1.md` (CLAUDE.md: "inline prompt strings fail
review"), calls the injected `LLMProvider`, and validates the proposed code against
`known_class_codes` before ever returning a `ClassificationResolved` — "an LLM may propose a class,
it must NOT create a class" (M1 brief) is enforced structurally, not by convention: an unrecognised
proposal (or `NONE`, or an offline/cached-miss `DomainAbstention`) always routes to
`ClassificationUnresolved(reason=CLASS_UNRESOLVED)`, reusing the `UnknownReason.CLASS_UNRESOLVED`
value `domain/model/attribute.py` already defined rather than inventing new status semantics.

**How confidence/review works.** Rule confidence is the rule's own configured value
(`resources/policy/classification_rules.yaml`). LLM confidence is never the model's self-report —
`ClassificationPolicy.llm_validated_confidence` is a fixed, documented-as-uncalibrated constant
(mirrors `resources/policy/cnf_routing.yaml`'s `accept_threshold` caveat) assigned only after the
proposal survives taxonomy validation, per CLAUDE.md's "Confidence is a calibrated composite of
measured signals, never a model self-report". Every classification is explainable end to end:
`ClassificationResolved.candidate.rationale` + `.evidence` (a `SourceRowSpan` citing the exact
description text), or `ClassificationUnresolved.attempted` (every candidate considered and
rejected) + `.rationale` — never an opaque decision.

### SCH — schema resolution

**What was implemented.** `SCH`'s classpath-based resolution engine (`resolve_schema_for_classpath`,
`domain/sch/schema_engine.py`, `domain/model/taxonomy.py`) already exists in full from UH3
(2026-08-14, §10 above) and needed no rebuild — reused exactly as `docs/16-unilog-alignment.md`'s
M1 brief instructs ("Reuse the taxonomy architecture created during UH3. Do NOT create a second
taxonomy system"). This session closed the one genuine gap against `docs/10-roadmap.md`'s M1 SCH
deliverable list: **completeness computation**. It existed, but as a private, untested helper
(`_completeness`) embedded in `infrastructure/memory/repositories.py` — the wrong layer for a pure
computation the API contract (`docs/api.md` §Records `completeness` object) depends on. Extracted to
`domain/sch/completeness.py` (`compute_completeness`, plus the `Completeness` dataclass itself,
moved out of `application/ports/repositories.py` which now re-exports it) with its own test suite
(`tests/unit/test_completeness.py`, 6 tests) — the in-memory repository's three call sites now call
the pure function instead of a private duplicate. No behaviour changed; `tests/contract/
test_records_api.py`'s existing completeness assertions still pass unmodified.

**How it uses existing taxonomy/schema infrastructure.** Unchanged from UH3: `resolve_schema_for_
classpath` → `classify_category` (scope check) → `TaxonomyReference.attribute_definitions` →
`build_schema`/`assign_risk_tier`. This session added three tests
(`tests/unit/test_resolve_schema_m1.py`) closing the specific gaps in `docs/10-roadmap.md` M1's own
SCH test checklist that UH3's test suite hadn't named directly: **ambiguous class** (two
overlapping `CategoryScopeRule`s both claiming the same classpath resolve deterministically to the
first match, never arbitrarily), **invalid class/schema combination** (a taxonomy adapter whose only
attribute definitions belong to a different classpath than requested resolves to `SchemaBlocked
(NO_ATTRIBUTE_DEFINITIONS)`, never a schema built from the wrong class's attributes), and
**required-attribute propagation** (pins `is_mandatory=False` on every LOV-sourced attribute,
documenting the existing, deliberate gap so a future session that wires a real mandatory-attribute
source doesn't silently break it). Known class → schema, unknown class, missing schema, and
risk-tier propagation were already covered by UH3's `test_resolve_schema.py`/`test_schema_engine.py`
and remain green, unmodified.

**What remains blocked by missing client data.** Identical to UH3's finding, re-verified this
session: `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx` are
still absent, `category_scope.yaml` still ships with an empty rule list, and `sample_input.csv`
still has no `Classpath` column — real schema resolution against the client's actual Fittings/
Faucets vocabulary is unreachable in this environment, not because of anything this session did or
didn't build.

### EVL — evaluation harness

**What was implemented.** The complete architecture the M1 brief asks for, landing before any
extractor expansion (this session added none — M2+/EXT expansion is explicitly out of scope and
untouched):

| Layer | File | What it does |
|---|---|---|
| Domain — gold-set contract (pure) | `domain/model/gold.py` | `GoldLabel` (exactly one of `expected_value`/`expected_unknown_reason`, INV-4's discipline extended to expectations), `GoldSet` (non-empty, only constructible via validation below), `GoldSetAvailability` (the M1 brief's three-way `GOLD_SET_AVAILABLE`/`GOLD_SET_UNAVAILABLE`/`INVALID_GOLD_SET`), `GoldSetLoadOutcome` (the typed loader-port return shape), `Prediction` (the prediction-side mirror of `GoldLabel`, with optional `evidence_count`/`lov_compliant`/`char_limit_ok` signals) |
| Domain — gold-row validation (pure) | `domain/evl/gold_validation.py` | `validate_gold_rows`: required-column, malformed-row (blank identifiers), duplicate-`(record_id, field)`, and invalid-value checks, each a structured `GoldRowError` — never a partially-valid `GoldSet` that silently drops bad rows (all-or-nothing) |
| Domain — metrics (pure) | `domain/evl/metrics.py` | `classify_outcome` (total function over `(GoldLabel, Prediction \| None)` → `TP`/`FP`/`FN`/`CORRECT_ABSTAIN`/`OVER_ABSTAIN`, `docs/04-data-model.md` §3.7's own enum, not a parallel one), `wilson_score_interval` (95% CI, per `docs/10-roadmap.md` M1's own "produces a report with confidence intervals" requirement), `compute_per_field_metrics`, `compute_aggregate_metrics` (unknown rate, review rate, evidence coverage, LOV membership rate, compliance rate — the last two `None`, not `0.0`, when no field in scope carries that constraint) |
| Domain — adapter (pure) | `domain/evl/adapters.py` | `prediction_from_attribute_value`: projects a real pipeline `AttributeValue` into the plain `Prediction` shape `metrics.py` compares |
| Infrastructure — gold-set loader | `infrastructure/reference_data/gold_set.py` | `load_gold_set`: file-absent → `GOLD_SET_UNAVAILABLE`; present-but-invalid → `INVALID_GOLD_SET` + rendered error strings; present-and-valid → `GOLD_SET_AVAILABLE` — never collapses "absent" and "empty" into the same outcome |
| Application — orchestration | `application/usecases/run_evaluation.py` | `run_evaluation`: injected `GoldSetLoader` port (never a concrete file reader — `application/` doesn't import `infrastructure/`), aligns by `(record_id, field)`, computes aggregate metrics twice (all labels, and `is_real`-only — "real and synthetic slices reported separately, real first", `docs/decisions.md` 2026-08-07) plus per-field metrics, reports every gold label with no matching prediction as an explicit failure string |
| Application — reporting | `application/usecases/eval_report.py` | `render_eval_markdown`/`render_eval_json`: pure string rendering (no I/O); an unavailable/invalid gold set renders *no* metrics section at all — 0% and unavailable are never the same shape on the page, either |
| Composition root | `scripts/run_eval.py` (`make eval`) | Wires `load_gold_set` + real predictions from the existing UH4 `enrich_catalog_row` pipeline run against all 1,000 real `sample_input.csv` rows (4,000 predictions) → `run_evaluation` → writes both reports to `evaluation/reports/` |

**Gold-set contract.** `record_id,field,expected_value,expected_unknown_reason,is_real` — documented
in full, including every validation rule, in `resources/reference/unihack/gold/README.md`, the file
a future session (or a real gold-labelling effort) reads before supplying `gold_set.csv`.

**Metrics.** `TP`/`FP`/`FN`/`CORRECT_ABSTAIN`/`OVER_ABSTAIN` outcome classification, Wilson-interval
overall/per-field accuracy, unknown rate, review rate, evidence coverage, LOV membership rate,
compliance rate — every one a pure, independently unit-tested function
(`tests/unit/test_evl_metrics.py`, 20 tests), never hidden inside an API handler (M1 brief §6).
`classify_outcome` accepts an optional `value_equal` comparator so a caller can inject normalised
comparison (fractions, casing, UOM) without this module inventing the normalisation rule itself —
exact string equality is the default.

**Result model.** `EvalRunResult` (`run_id`, `dataset`, `timestamp`, `availability`, `row_count`,
`field_count`, `aggregate_all`, `aggregate_real`, `per_field`, `failures`, `warnings`) —
`aggregate_all`/`aggregate_real`/`per_field` are `None`/empty exactly when `availability` is not
`GOLD_SET_AVAILABLE`, never a zero-filled stand-in.

**Failure reporting.** Every gold label with no corresponding prediction is rendered as an explicit
failure string (`EvalRunResult.failures`) rather than silently scored as `FN` with no explanation of
which record/field was missing.

**Real run, honestly reported.** `scripts/run_eval.py` was executed against the real environment
during this session: 4,000 real predictions produced (1,000 rows × 4 attributes, from the existing
UH4 pipeline — genuinely real `MFG_PART_NUM`/`ITEM_DESCRIPTION` extractions and honestly-`Unknown`
`MANUFACTURER_NAME`/`BRAND_NAME` resolutions, not synthetic), and the harness correctly reported
`GOLD_SET_UNAVAILABLE` with zero fabricated metrics — the exact, correct behaviour for this
environment's real data. The generated reports are run artifacts (`backend/evaluation/reports/`,
now gitignored), not committed source.

### Gold set

**Not found.** Re-verified this session (see "Source data" above) — the sixth independent
verification pass across sessions reaching the same conclusion. `EVL` can today: validate a
well-formed gold set, reject a malformed one with structured errors, align predictions to labels,
compute every documented metric with confidence intervals, and render both report formats — all
proven against small, explicitly-labelled test fixtures (`tests/fixtures/evl/`) and wired for real
against actual pipeline predictions. What `EVL` genuinely **cannot** do yet: report a single real
accuracy number for this project, because there is nothing to score real predictions against. This
is an honest, typed `GOLD_SET_UNAVAILABLE` outcome every time `make eval` runs today, not a silently
skipped step and not a fabricated number.

### Tests

103 new tests (474 → 577 collected): `test_completeness.py` (6), `test_classification_domain.py`
(7), `test_cls_rules_engine.py` (11), `test_cls_resources.py` (5), `test_cls_policy.py` (1),
`test_prompt_loader.py` (2), `test_classify_record.py` (10), `test_gold_domain.py` (11),
`test_gold_validation.py` (10), `test_evl_metrics.py` (20), `test_gold_set_loader.py` (5),
`test_run_evaluation.py` (5), `test_evl_adapters.py` (2), `test_eval_report.py` (5),
`test_resolve_schema_m1.py` (3). All 474 prior tests still pass unmodified — regression is green.

### Documentation updated

This section; `docs/decisions.md` (new entries below); `resources/reference/unihack/README.md` and
`resources/reference/unihack/gold/README.md` (sixth re-verification note, gold-set contract);
`.gitignore` (`backend/evaluation/reports/`); `backend/Makefile`/root `Makefile` (`eval` target
wired to `scripts/run_eval.py`, replacing the M1-blocked stub); `.github/workflows/ci.yml` (eval
harness smoke run added to the backend job — not a metric-regression gate yet, since there is
nothing to regress against, but proves the harness runs end-to-end on every backend change).
`docs/10-roadmap.md` was **not** edited, per this file's own established convention (§15) and this
session's explicit instruction. No new ADR: this implements `docs/10-roadmap.md`'s own M1 scope,
already accepted; no new architectural decision was made.

---

## 17. M2 — PRS + DOC + document evidence infrastructure (2026-08-14)

**Status: COMPLETE against the true M2 architectural scope; real-corpus binding/parse-cache
accuracy targets genuinely blocked by the same missing corpus UH0 onward already documented — not
a new gap.** `make check` (backend): 701 tests collected (up from 577 before this session) — 696
passed, 5 skipped honestly (Postgres-dependent integration tests, unchanged from §3), `ruff
check`/`ruff format --check` clean, `mypy --strict` clean on 139 source files (up from 113).

### Source data — re-verified before writing any code

Searched again at the start of this session for a real manufacturer-document corpus: `*.pdf` files
and a `corpus/`/`manifest.json` anywhere under the repository. Found nothing — consistent with
every prior verification pass across UH0–UH7 and M0/M1 (six-plus independent passes). **No PDF
corpus was fabricated.** What this session does differently from UH0–UH7's "architecture now, data
later" pattern: PRS/DOC do not actually need the *client's* missing reference workbooks (Unicat
LOV, manufacturer list, UOM standards) the way UH2–UH5 did — they need PDF *documents*, which were
never expected to be supplied by the UniHack reference pack in the first place
(`docs/16-unilog-alignment.md` UH4 already noted "no manufacturer PDFs in this dataset" as the
honest default). So instead of stopping at architecture-plus-fixtures, this session went one step
further: it built and validated the **entire PRS pipeline against a hand-built, byte-exact
synthetic PDF** (`tests/fixtures/pdf/minimal_pdf.py`) that is explicitly, repeatedly labelled a test
fixture, never presented as corpus data. Every real adapter (`PdfplumberParser`,
`Pypdfium2Rasterizer`) runs against genuine PDF byte structure end to end, including a real stroked
grid that `pdfplumber`'s own table detector recognises without any hand-holding — this is
qualitatively more than "the engine runs against a fixture that says it isn't real data" (UH4/UH5's
honest caveat); it is real parsing/rendering code, verified against real (if small and synthetic)
PDF bytes, with zero fabricated manufacturer content anywhere in the codebase.

### PRS — parsing architecture

| Layer | File | What it does |
|---|---|---|
| Domain — document/region model | `domain/model/document.py` | `Document`, `DocumentVersion`, `DocumentPage`, `DocumentRegion`, `ParseArtifact`, `DocumentBinding` — mirrors `frontend/lib/contracts/document.ts` field-for-field (including which enums are `lower_snake` vs `UPPER_SNAKE` on the wire, copied from the shipped frontend contract, not invented) |
| Domain — region addressing (pure) | `domain/prs/region_path.py` | `build_region_path`/`parse_region_path`/`parent_path` — the `table:1/row:14/cell:3` grammar `docs/04-data-model.md` §3.3 names, with nesting-order validation (`cell` can't precede its `row`) |
| Domain — table tree (pure) | `domain/prs/table_regions.py` | `build_table_regions` — library-independent `RawTable`/`RawTableRow`/`RawTableCell` -> table/row/cell region tree, unit-tested with a hand-built `RawTable`, independent of whether `pdfplumber`'s own detector fires on any given fixture |
| Domain — cache key (pure) | `domain/prs/cache_key.py` | `ParseCacheKey(content_hash, parser_name, parser_version)` — exactly the key `docs/04-data-model.md` §3.3 specifies |
| Domain — typed outcome (pure) | `domain/prs/parse_result.py` | `ParseSucceeded \| ParseFailed` sealed union, `ParseFailureReason` closed set (`UNSUPPORTED_FORMAT`, `CORRUPT_FILE`, `NO_TEXT_LAYER_OCR_UNAVAILABLE`, `EMPTY_DOCUMENT`, `PARSER_ERROR`) — mirrors `AttributeValueAsserted \| AttributeValueUnknown`'s "no third shape" discipline |
| Application — ports | `application/ports/{parser,rasterizer,ocr,parse_cache}.py` | `DocumentParser`, `PageRasterizer`, `OcrProvider`, `ParseCacheRepository` — `application/` depends on these only, per the standing layering rule |
| Infrastructure — real parser | `infrastructure/parsing/pdfplumber_parser.py` | `PdfplumberParser` (ADR-0005) — genuinely extracts text, words, and tables from real PDF bytes; one page region + one block region per page, a table/row/cell subtree per detected table. The one broad `except Exception` is deliberate and documented (third-party byte content boundary) |
| Infrastructure — real rasteriser | `infrastructure/parsing/pypdfium2_rasterizer.py` | `Pypdfium2Rasterizer` (ADR-0012) — renders a page to real PNG bytes at a fixed DPI |
| Infrastructure — OCR | `infrastructure/parsing/ocr.py` | `UnavailableOcrProvider` (composition-root default — **no `tesseract` binary is installed in this sandbox**, verified this session) + `TesseractOcrProvider` (real `pytesseract` adapter, degrades to `OcrUnavailable` rather than crashing if the binary is missing) |
| Infrastructure — parse cache | `infrastructure/parsing/parse_cache.py` | `InMemoryParseCache` — the dev/test adapter, same role `infrastructure/memory/repositories.py` already plays for records |
| Application — orchestration | `application/usecases/parse_document.py` | `parse_document`: cache lookup -> parse -> (only if no text layer) OCR fallback via rasterised pages -> cache write. **Failed parses are never cached** — a retried parse of a previously-corrupt upload always gets a fresh attempt |
| Application — rasterisation+cache | `application/usecases/render_page_image.py` | `render_page_image` — reuses the existing `BlobStore` port as the rendered-image cache, keyed `(content_hash, page, dpi)` (ADR-0012), rather than inventing a second caching mechanism |
| Application — ingestion | `application/usecases/ingest_document.py` | `ingest_document`: `POST /documents` end to end — content-addressed identity (re-upload of identical bytes is a no-op), blob storage, `parse_document` (with OCR fallback wiring), pixel-dimension computation (`points -> width_px/height_px` at the document's fixed DPI), registration |

**Real, not fixture-only, for the pipeline mechanics themselves:** `PdfplumberParser`,
`Pypdfium2Rasterizer`, and `ingest_document` were run end to end via a live `TestClient` against the
synthetic PDF fixture in this session (`tests/contract/test_documents_api.py`) — upload -> parse ->
detail -> regions -> real PNG page image -> corpus list, all real code, no mocks in the path. What's
architecture-only (per the M2 brief's own framing) is *accuracy against real manufacturer PDFs* —
there are none in this environment to be accurate or inaccurate about.

### DOC — retrieval hierarchy and binding

| Layer | File | What it does |
|---|---|---|
| Domain — candidate search (pure) | `domain/doc/binding_engine.py` | `resolve_document_binding` — the exact -> normalised -> supplier -> class -> overlap cascade `docs/10-roadmap.md` M2 names, narrowing the candidate pool tier by tier (mirrors UH2's `resolve_manufacturer_brand` shape exactly); `resolve_row_binding` — the same cascade one level down (catalog-no exact hit -> MPN-variant hit) for row-level binding; `detect_binding_conflict` — true when a record is bound to more than one *version* of the same logical document (the exact `conflicting_sources` scenario the frontend mock already demonstrates) |
| Application — orchestration + AI boundary | `application/usecases/bind_document.py` | `bind_record_to_document`: deterministic cascade first; only when it leaves a small ambiguous pool does it offer that pool to an `LLMProvider` for disambiguation (`CLAUDE.md`'s one AI-allowed step here) — the model may only pick one of the *offered* `document_version_id`s, validated exactly like `classify_record` validates a proposed class against `known_class_codes`; a proposal outside the offered set, `NONE`, or an abstention all route to `AMBIGUOUS_CANDIDATES`, never a guess |
| Resources | `resources/prompts/doc_disambiguation_v1.md` | Versioned prompt file (`CLAUDE.md`: "Inline prompt strings fail review") |

**Binding confidence is structural, not just scored.** `DocumentBinding.__post_init__`
(`domain/model/document.py`) refuses to construct an `ACCEPTED` binding whose method isn't
`EXACT_MPN`, `NORMALIZED_MPN`, or `HUMAN` — the M2 brief's "do not allow a low-confidence match to
become an asserted binding automatically" enforced the same way INV-9 makes Tier-0 auto-accept
unrepresentable, not merely checked. `SUPPLIER_MATCH`/`CLASS_MATCH`/`TEXT_OVERLAP`/
`LLM_DISAMBIGUATION` bindings are always `NEEDS_REVIEW`.

**Real-corpus binding accuracy is the one genuinely blocked measurement.** `docs/10-roadmap.md`
M2's own verification checklist ("binding accuracy ≥95% on the gold set", "adversarial wrong-document
rejection ≥90%") needs both a real document corpus and a gold set — neither exists in this
environment (OD-7, extended this session). What's proven instead: the full deterministic cascade,
row-level narrowing, conflict detection, and the LLM-disambiguation boundary's "never invent a
candidate" guarantee, all against small, explicitly-labelled test fixtures
(`tests/unit/test_binding_engine.py`, `tests/unit/test_bind_document_usecase.py`) — the same
discipline UH2's `_FIXTURE_CANDIDATES` established for manufacturer/brand resolution.

### API — endpoints added

All six were already named in `docs/api.md` §Documents before this session (placeholders); this
session implemented every one for real and filled in the wire shapes that weren't yet specified
(`POST /documents`'s multipart fields, the binding attach/detach request/response bodies — added to
`docs/api.md` in this same session, before the endpoint, per that doc's own rule):

`GET /documents`, `GET /documents/{version_id}`, `GET /documents/{version_id}/regions`,
`GET /documents/{version_id}/pages/{n}/image`, `POST /documents`, `POST /records/{id}/bindings`,
`DELETE /records/{id}/bindings/{binding_id}`. All contract-tested against a live in-process
`TestClient` (`tests/contract/test_documents_api.py`, 18 tests) — schema shape, 404s, pagination,
corrupt-upload handling, idempotent re-upload, page-image bytes, manual attach/detach.

`api/deps.py` gained `get_document_repository`/`get_document_ingest_repository`/
`get_binding_repository` (all backed by one `InMemoryDocumentRepository` — mirrors
`_get_memory_repository`'s existing "one store, several port roles" pattern for records),
`get_parse_cache`, `get_document_parser`, `get_page_rasterizer`.

### Database

No new migration this session — `document`, `document_version`, `parse_artifact`,
`document_region`, `document_binding` already exist in `infrastructure/db/models.py`'s 20-table
schema (built at M0, §2 above) with every column M2's domain model needs. The read/write path
implemented this session targets the in-memory adapter (`repository_backend=memory`, the same
environment constraint as every other milestone — §3: no Docker/Postgres in this sandbox).
Swapping to a Postgres-backed `DocumentRepository`/`BindingRepository` implementation is the same
composition-root-only change §3 already describes for `RecordRepository`.

### Frontend — DocumentViewer reused, zero changes

**No frontend file was read-write touched this session.** `frontend/components/document-viewer/`,
`frontend/lib/document-viewer/coordinates.ts`, `frontend/lib/contracts/document.ts`,
`frontend/lib/queries/documents.ts`, and the mock API routes under
`frontend/app/api/mock/v1/documents/` are exactly as they were. The backend's wire schemas
(`api/schemas/document.py`) were built field-for-field against `frontend/lib/contracts/document.ts`
— `DocumentSummaryOut`/`DocumentDetailOut`/`DocumentRegionOut`/`DocumentBindingOut` match
`documentSummaryWireSchema`/`documentDetailWireSchema`/`documentRegionWireSchema`/
`documentBindingWireSchema` exactly, including the `lower_snake` enum values
(`parse_status`/`region_type`/`doc_type`) the frontend's `zod` schemas already expect verbatim, and
the additive `pages[]` per-page-dimensions field (`frontend-f0.5`) is populated for real. Pointing
`NEXT_PUBLIC_API_BASE_URL` at this backend today would show an honestly empty `/documents` corpus
browser and `document unavailable` for the existing demo record's citation (`docver_apollo_76a_series`
was never actually re-created here — see "What was deliberately not built" below) — both already-
supported frontend states, not new ones. The frontend's default stays pointed at the mock, unchanged
from UH6's own reasoning (§13): the real backend still has no write path feeding a demo-comparable
record universe.

### What was deliberately not built

- **A real document backing the existing demo record's citation.** `InMemoryRecordRepository`'s
  `rec_demo_abc123` still cites `docver_apollo_76a_series` in its `DocumentSpan` evidence
  (unchanged, M0-era fixture) — no matching `DocumentVersion` was fabricated in the new
  `InMemoryDocumentRepository` to "fill the gap", because doing so would mean inventing a document
  this environment doesn't have. The two repositories are honestly inconsistent on this one
  pre-existing fixture record; a real corpus (or removing that fixture's `DocumentSpan`) resolves it,
  neither of which is this session's call to make unilaterally.
- **A real gold-set-scored binding-accuracy number.** Covered above and in OD-7.
- **Postgres-backed `DocumentRepository`/`BindingRepository`.** Same standing environment blocker
  as every other milestone (§3).
- **Row-level binding wired into a live endpoint.** `resolve_row_binding` exists, is unit-tested, and
  is ready to be called once a real table with real candidate rows exists to call it against — no
  endpoint invokes it yet, because `bind_record_to_document`'s own contract test coverage (document-
  level only) is what this session's real data could actually exercise.
- **Worker/queue-based async parsing.** `ingest_document` parses synchronously inline, the same
  "shaped as `202` but the body is available immediately" pattern `POST /records/import` already
  established at M0 — consistent with `docs/15-backend-implementation-status.md` §4's "job queue" row
  still being out of scope until the queue framework itself is built.

### Tests

124 new tests (577 → 701 collected): `test_document_domain.py` (24), `test_region_path.py` (14),
`test_parse_cache_key.py` (8), `test_binding_engine.py` (16), `test_table_regions.py` (5),
`test_pdfplumber_parser.py` (14), `test_pypdfium2_rasterizer.py` (6), `test_ocr_providers.py` (4),
`test_parse_cache_adapter.py` (5), `test_parse_document_usecase.py` (7), `test_bind_document_usecase.py`
(8), `test_render_page_image_usecase.py` (2), `test_ingest_document_usecase.py` (5),
`test_documents_api.py` (18, contract, including pagination). All 577 prior tests still pass
unmodified — regression is green. Architecture tests (`tests/architecture/`) pass unmodified and
already cover `domain/prs/`/`domain/doc/` (they walk `domain/` recursively) with no changes needed.

### Documentation updated

This section; `docs/api.md` (§Documents — the `POST /documents`/binding-attach/binding-detach wire
shapes filled in, additive); `docs/decisions.md` (six new entries, OD-7 extended to name M2's own
blocked verification-checklist items). No new ADR: this implements ADR-0005/ADR-0012, already
accepted, plus `docs/10-roadmap.md`'s own M2 scope — no new architectural decision was made that
those two ADRs didn't already settle.

---

## 18. M3 — Extraction, verification, validation (2026-08-14)

**Status: COMPLETE against the true M3 architectural scope; real class-specific extraction accuracy
is genuinely blocked by the same missing Fittings/Faucets LOV and PVF gold set UH3/UH4 already
documented — not a new gap.** `make check` (backend): 878 tests collected (up from 701 before this
session) — 873 passed, 5 skipped honestly (Postgres-dependent integration tests, unchanged from §3),
`ruff check`/`ruff format --check` clean, `mypy --strict` clean on 157 source files (up from 139).

### Source data — re-verified before writing any code

Re-checked at the start of this session, consistent with every prior pass (UH0 onward, seven-plus
verifications now): `Fittings_LOV.xlsx`, `FAUCETS_LOV.xlsx`, `Unicat_Lov_v1_0...xlsx`, and a labelled
gold set are still absent. `sample_input.csv`'s real 1,000 rows remain generic industrial-supply
items (adhesives, tools, electrical parts — verified again by inspecting `Part_Desc` values), **not
PVF product data** — an important, previously-unstated fact this session made explicit before writing
any `VAL` rules: attempting PVF-specific attribute extraction (nominal size, pressure rating,
connection type) against this real dataset would not exercise real PVF data, it would risk spurious
pattern matches against unrelated text, exactly the "confident wrong answer" CLAUDE.md's thesis
exists to prevent. `EXT`/`VER`/`VAL` are therefore proven for real, end to end, against the one
genuinely-owned PVF vocabulary this project has — the `BALL_VALVE_BRONZE` architecture-test fixture
(`resources/taxonomy/classes.yaml`, ADR-0011/ADR-0014) — using explicitly-labelled test fixtures, the
same discipline every UH milestone already established for class-specific work blocked on missing
client data (`_FIXTURE_CANDIDATES`, `tests/fixtures/pdf/minimal_pdf.py`, ...). UH4's real,
live, evidenced, 1000/1000-row `MFG_PART_NUM`/`ITEM_DESCRIPTION` extraction against `sample_input.csv`
is untouched by this session — it remains the one genuinely real-data path through the pipeline.

### EXT — grounded extraction

| Layer | File | What it does |
|---|---|---|
| Domain — candidate model (pure) | `domain/model/extraction.py` | `ExtractionCandidate`/`ExtractionUnavailable` sealed union — mirrors `AttributeValueAsserted`/`Unknown`'s "fabrication is unrepresentable, not just rejected" shape one stage earlier than assertion. A candidate cannot be constructed with empty evidence, a blank value, or a blank rationale |
| Domain — INV-3 span containment (pure) | `domain/ext/span_containment.py` | `check_document_span_containment` (offset-based, for `DocumentSpan`) and the flat/substring form for `SourceRowSpan`/`ReferenceTableRow` — "does the cited snippet genuinely occur in the source it claims to quote", distinct from entailment ("does the asserted value follow from the snippet"). Never clamps an out-of-bounds span into validity |
| Domain — candidate builders (pure) | `domain/ext/candidate_builder.py` | `build_verbatim_row_candidate` (the general form of UH4's `_extract_verbatim_field`, returning a pre-verification candidate) and `build_document_span_candidate` (bounds-checked before any slicing — a hallucinated offset becomes `ExtractionUnavailable`, never a clamped candidate) |
| Domain — structured LLM output (pure) | `domain/ext/llm_proposal.py` | `ExtractorProposalPayload`/`parse_extractor_response` — a closed-key, closed-shape parser (hand-written, not `pydantic.BaseModel` — see below) the model's span proposal must match exactly; `found=true` requires both offsets and nothing else, `found=false` requires neither |
| Application — use case | `application/usecases/extract_attribute.py` | `extract_attribute_from_region`: region-scoped, `LLMProvider`-agnostic (real/`cached`/`offline` all valid), degrades to `ExtractionUnavailable(SYSTEM_ERROR)` on an unavailable provider or malformed output — never invents a value |
| Resources | `resources/prompts/ext_v1.md` | Versioned prompt (CLAUDE.md: "inline prompt strings fail review"). Document text is always wrapped in `<document_text>` and the system prompt states explicitly that its content is never instructions |

### VER — independent verification

| Layer | File | What it does |
|---|---|---|
| Domain — deterministic gate (pure) | `domain/ver/independent_check.py` | `verify_candidate_deterministic`: INV-3 containment, then exact-match entailment (`domain/ver/entailment.py`, unchanged from UH4) — every M3 candidate is verbatim by construction, so exact-match is the correct, sufficient entailment check for all of them, not a simplification. A containment failure short-circuits before entailment is even checked |
| Domain — conflict detection (pure) | `domain/ver/conflict.py` | `distinct_proposed_values` — the M3 §10 "two values conflict" case: more than one distinct value among candidates for the same attribute is never resolved by picking one |
| Domain — structured LLM output (pure) | `domain/ver/llm_verdict.py` | `VerifierVerdictPayload`/`parse_verifier_response` — closed-key (`verdict`, `rationale` only; an extra field, e.g. a smuggled "corrected value", fails the whole payload), closed-vocabulary (`ENTAILED`/`PARTIAL`/`NOT_ENTAILED`) |
| Application — use case | `application/usecases/verify_extraction.py` | `verify_extraction`/`verify_candidates`: deterministic layer always first and final on failure; an independent LLM verifier (`resources/prompts/ver_v1.md` — a different prompt from `EXT`'s, asymmetric/adversarial framing, never re-asks the model to "find" anything) only runs for LLM/rule-based candidates whose deterministic check already passed. `VerificationPolicy` (`resources/policy/verification.yaml`) assigns confidence per verdict tier — a fixed, documented constant, never the model's self-report, and never read from `candidate.source_confidence` |

**Why not `pydantic.BaseModel` for the structured-output schemas, despite `pydantic` being
architecturally allowed in `domain/`:** tried first, and rejected on evidence, not preference —
subclassing `BaseModel` inside `domain/ext/`/`domain/ver/` fails `pyproject.toml`'s
`disallow_any_explicit` override for `domain/`/`application/` (CLAUDE.md: "no `Any` in domain or
application") even with the `pydantic.mypy` plugin enabled (`plugins = ["pydantic.mypy"]` was tried
and reverted — no change). Hand-written frozen dataclasses with manual `json.loads` + closed-key-set
validation give the identical "typed schema, reject malformed output, reject unknown fields" guarantee
without depending on a combination this project's own strict mypy gate doesn't actually accept — and
match every other domain type's own construction style (`AttributeRef`, `Verification`,
`ClassificationCandidate`, ...). `tests/architecture/test_layering.py`'s `STDLIB_ALLOWED_ROOTS` gained
one entry, `json`, for this — pure, deterministic, INV-6-safe, the same "new stdlib import is a
visible diff" discipline `re`/`difflib`/`fractions` already established.

### Adversarial suite — prompt injection resistance

`tests/adversarial/test_prompt_injection.py` (new directory, per `docs/05-backend.md` §1's planned
tree): a ten-payload corpus covering instruction injection, fake system messages/tags, malicious
HTML, a fake pre-baked JSON answer embedded in the document, fabricated confidence instructions,
prompt-exfiltration requests, and injection embedded inside a table and inside a product description
(`docs/10-roadmap.md` M3 §6's own examples, verbatim). Every payload is checked two ways: **structural**
(the payload always lands inside `<document_text>`/`<cited_evidence>`, never concatenated into the
system prompt) and **behavioural, via a compromised model** — a `_FakeLLM` that "obeys" the injected
instruction as far as this port's response shape allows still cannot produce an asserted value, because
its response fails structured-output validation, an out-of-bounds span, or the deterministic
containment/entailment gate. A real model refusing to comply proves nothing about this system's own
boundary; a compromised model still being unable to fabricate a value does. This is real, executable
resistance evidence, not an assertion — the M3 brief's own QR target ("prompt injection resistance
≥98%") is met by construction for every payload in this corpus (10/10), not sampled.

### VAL — declarative rules engine

| Layer | File | What it does |
|---|---|---|
| Domain — DSL (pure, INV-6) | `domain/val/rules_dsl.py` | `Field`/`Compare`/`BoolExpr`/`Condition` — a restricted expression tree (comparison, boolean logic, field references; no arithmetic beyond comparison was needed by the real rule set), parsed from YAML data shapes, never a string handed to `eval()`/`exec()` (`tests/architecture/test_no_eval.py`, unchanged, passes over this file too). Missing-field policy stated once: a comparison against an absent field is `False`, never a crash, never a silent `True` |
| Domain — rule model (pure) | `domain/val/rule.py` | `ValidationRule` (`rule_id`, `class_codes`, `attributes`, `description`, `severity`, `source`, `condition`) — every rule requires a non-blank `source` citation at construction (`docs/domain/pvf-reference.md` §10: "every rule needs... a primary-source citation before it ships"). `RuleSeverity`: `BLOCK` (downgrades to `Unknown(VALIDATION_FAILED)`) / `FLAG` (downgrades `ACCEPTED` to `NEEDS_REVIEW`, value kept) |
| Domain — engine (pure) | `domain/val/engine.py` | `evaluate_rules`/`results_for_attribute`/`worst_failure_severity` — `BLOCK` outranks `FLAG` when both fire |
| Domain — cross-field helpers (pure) | `domain/val/crossfield.py` | `fields_referenced`/`is_cross_field` — which attribute codes a rule's condition actually reads, beyond the ones it's nominally attached to (PRS-011 reads both WSP and WOG) |
| Infrastructure — loader | `infrastructure/val_resources.py` | Parses `resources/rules/*.yaml`'s `condition` trees into `rules_dsl.py`'s dataclasses — never `eval()` |
| Application — use case | `application/usecases/validate_attribute_value.py` | `validate_attribute_value`: consumes an already-verified `AttributeValue` and a caller-built `Facts` dict, **never extracts** (M3 §14). Only ever makes a value more conservative — no path upgrades a value's status |
| Resources | `resources/rules/ball_valve_bronze.yaml` | 18 rules against `BALL_VALVE_BRONZE`, every one transcribed from a named, numbered rule in `docs/domain/pvf-reference.md` §10 or its §4-§7 domain-trap discussion — **none invented**. See below |

**Why 18 rules, not ≥60.** `docs/10-roadmap.md` M3's own target is "≥60 rules across 5 classes."
`pvf-reference.md` §10 names exactly 12 rule IDs; this file expands two of them per pressure attribute
(`PRS-001`, `PRS-017`) and one (`CLS-001`) per enum attribute the loaded taxonomy actually has (five),
reaching 18 — every one traceable to a real citation, none padded in to hit a round number. Reaching 60
for real needs either the other four PVF demo classes' schemas (not loaded in this environment — only
`BALL_VALVE_BRONZE` is, ADR-0011/ADR-0014) or a richer, primary-source-verified rule catalogue than
`pvf-reference.md` §10 currently provides — that document's own header still flags OD-4
(`docs/decisions.md`, unresolved since 2026-08-07) as open: "every rule below must be verified against
primary sources... before it is implemented." Inventing 42 more rules to hit 60 would be exactly the
fabricated-business-rules failure mode `docs/10-roadmap.md` M3 §11 names and forbids
("Do NOT blindly invent 60 arbitrary rules"). `TMP-005`'s own 450°F figure is capped at `FLAG`
severity, never `BLOCK`, for the same reason — the source document itself marks it "(verify)".

Every rule is exercised against the real, shipped YAML through the real engine
(`tests/unit/test_val_resources.py`), including one test that builds a fully clean, in-vocabulary
`BALL_VALVE_BRONZE` record and asserts every applicable rule passes — proving the rule set doesn't
just fire on bad data, it also stays quiet on good data.

### Tests

177 new tests (701 -> 878 collected — 873 passed, 5 skipped, the same standing Postgres skips as
every prior milestone): `test_span_containment.py` (17 — exact/boundary/partial-overlap/out-of-bounds/
empty/malformed/Unicode, all three evidence kinds), `test_extraction_domain.py` (8),
`test_candidate_builder.py` (7), `test_independent_check.py` (5), `test_llm_verdict.py` (10),
`test_llm_proposal.py` (9), `test_extract_attribute.py` (8), `test_verify_extraction.py` (18 — the
M3 §10 adversarial suite's ten numbered cases, each with its own test, plus general-behaviour cases),
`test_rules_dsl.py` (22), `test_val_rule_and_engine.py` (12), `test_val_resources.py` (8, against the
real shipped YAML), `test_validate_attribute_value.py` (7), `test_verification_policy.py` (1, real
YAML loads), `test_ext_ver_prompts.py` (3, the real shipped prompt files format correctly against the
real keyword arguments each use case passes), `tests/adversarial/test_prompt_injection.py` (42 — the
ten-payload corpus parametrised across structural/behavioural checks, plus targeted single-payload
tests). All 701 prior tests still pass unmodified — regression is green.

### What is genuinely blocked, and what isn't

Blocked, unchanged from UH3/UH4: real class-specific attribute extraction/verification/validation
against the client's actual Fittings/Faucets vocabulary (needs the missing LOV workbooks) and any
accuracy number (needs the missing gold set, `docs/15-backend-implementation-status.md` §7 onward,
OD-7). Not blocked, and real today: the entire `EXT`/`VER`/`VAL` architecture, proven end to end
against explicitly-labelled fixtures and the real `BALL_VALVE_BRONZE` rule set; the injection-resistance
corpus, real and passing 10/10; UH4's verbatim `MFG_PART_NUM`/`ITEM_DESCRIPTION` path, untouched and
still real against all 1,000 `sample_input.csv` rows.

`PRV` (evidence/verification/transform persistence, audit events) was **not built this milestone** —
it needs the write path and Postgres wiring `docs/15-backend-implementation-status.md` §4 already lists
as not built, unchanged by this session. No pipeline orchestrator (`application/usecases/
enrich_record.py`, named but not yet built per `domain/model/states.py`'s own docstring) or new API
endpoint was added — `EXT`/`VER`/`VAL` are real, tested, composable use cases ready to be wired into
one once the queue/persistence framework exists, the same "architecture before the API that would
need it" ordering `DSC` (UH5) and `CNF` (UH6) already established. No frontend change — the M3 brief's
"attributes with values, evidence highlight linkage, `Unknown` with reasons" bullet is already served
by the existing frontend against mock data and needs no new wire shape from this milestone.

### Documentation updated

This section; `docs/decisions.md` (new entries below). `CLAUDE.md`'s module-code table already lists
`EXT`/`VER`/`VAL` (added at the project's outset) — no edit needed. No new ADR: this implements
`docs/10-roadmap.md`'s own M3 scope, already accepted; no new architectural decision was made that
INV-1/INV-2/INV-3/INV-9 and the existing `Evidence`/`AttributeValue` design didn't already settle.
