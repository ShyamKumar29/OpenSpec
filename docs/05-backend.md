# Phase 6 — Backend Architecture

> **Audience:** backend engineers. **Prerequisite:** `02-architecture.md`, `04-data-model.md`.
> **Governing principle:** the domain layer must be so boring and so pure that it could be unit-tested
> on a machine with no network, no database, and no API key.

---

## 1. Folder structure

Module codes from `02-architecture.md` §3 become folder names. This is deliberate: a requirement ID
(`FR-VER-4`) maps to a folder (`domain/ver/`) without translation.

```
backend/
├── src/openspec/
│   ├── domain/                      # PURE. No I/O, no frameworks, no vendor SDKs.
│   │   ├── model/                   # Entities & value objects
│   │   │   ├── record.py            # CatalogRecord, Mpn (value object)
│   │   │   ├── attribute.py         # AttributeValue, Evidence, ProvenanceKind, UnknownReason
│   │   │   ├── document.py          # DocumentVersion, Region, Binding
│   │   │   ├── confidence.py        # ConfidenceSignals (typed)
│   │   │   └── states.py            # PipelineState machine + legal transitions
│   │   ├── val/                     # INV-6 PURE — deterministic validation
│   │   │   ├── engine.py            # Rule evaluation over the restricted DSL
│   │   │   ├── rules_dsl.py         # Safe expression evaluator (NEVER eval())
│   │   │   └── crossfield.py
│   │   ├── nrm/                     # INV-6 PURE — deterministic normalisation
│   │   │   ├── fractions.py         # 1-1/4, 1¼, 1 1/4 → Fraction(5,4)
│   │   │   ├── units.py             # Exact rational conversion
│   │   │   ├── nominal_size.py      # NPS/DN designations — NEVER unit-converted
│   │   │   ├── pressure.py          # WOG / WSP / CWP / ANSI Class, non-derivation rules
│   │   │   ├── connections.py       # Synonym tables (C×C, SWT, FIP, FNPT…)
│   │   │   └── pipeline.py          # Ordered transform chain, records TransformStep
│   │   ├── cnf/                     # INV-6 PURE — confidence + routing
│   │   │   ├── scoring.py           # Composite signal → raw score
│   │   │   ├── calibration.py       # Fitted mapping raw → calibrated probability
│   │   │   └── routing.py           # Tier policy, INV-9 enforcement
│   │   ├── policy/                  # Tier definitions, thresholds (loaded, not hardcoded)
│   │   └── errors.py                # Domain error taxonomy
│   │
│   ├── application/                 # Use cases. Orchestration. No business rules.
│   │   ├── ports/                   # Interfaces the domain/app needs (ABCs / Protocols)
│   │   │   ├── llm.py               # LLMProvider
│   │   │   ├── parser.py            # DocumentParser
│   │   │   ├── fetcher.py           # DocumentFetcher
│   │   │   ├── blob.py              # BlobStore
│   │   │   ├── repositories.py      # Record/Attribute/Document/Audit repositories
│   │   │   └── export.py            # ExportTarget
│   │   ├── stages/                  # One file per pipeline stage
│   │   │   ├── ing.py  cls.py  sch.py  doc.py  prs.py
│   │   │   └── ext.py  ver.py  val.py  nrm.py  cnf.py
│   │   ├── usecases/
│   │   │   ├── enrich_record.py     # Stage orchestration + state persistence
│   │   │   ├── review_decision.py
│   │   │   ├── publish_export.py
│   │   │   ├── run_evaluation.py
│   │   │   └── ingest_batch.py
│   │   └── context.py               # ActorContext (tenant, user, roles) — passed everywhere
│   │
│   ├── infrastructure/              # Adapters. The only place vendors are named.
│   │   ├── db/                      # SQLAlchemy models, repositories, unit of work
│   │   ├── llm/                     # AnthropicProvider, CachedProvider (replay), OfflineProvider
│   │   ├── parsing/                 # PdfPlumberParser, OcrFallbackParser
│   │   ├── blob/                    # LocalFsBlobStore, S3BlobStore
│   │   ├── fetch/                   # PolicyGuardedFetcher (robots, rate limit, SSRF guard)
│   │   ├── queue/                   # PostgresJobQueue
│   │   ├── export/                  # CsvTarget, JsonTarget, Cx1Target
│   │   └── observability/           # Logging, tracing, metrics, LLM ledger
│   │
│   ├── api/                         # FastAPI. Thin. Validation + authz + serialisation only.
│   │   ├── routers/                 # records, documents, review, export, eval, judge, admin
│   │   ├── schemas/                 # Pydantic request/response DTOs (NOT domain models)
│   │   ├── deps.py                  # DI wiring
│   │   └── errors.py                # Domain error → HTTP mapping
│   │
│   ├── worker/                      # Queue consumer entrypoint
│   └── config/                      # Settings, feature flags, threshold loading
│
├── resources/                       # Versioned declarative data — reviewed in PRs
│   ├── taxonomy/                    # classes.yaml, attributes/<class>.yaml
│   ├── rules/                       # validation rules per class
│   ├── units/                       # unit definitions, synonym tables
│   ├── prompts/                     # cls_v1.md, ext_v3.md, ver_v2.md …
│   └── abbreviations/               # industry abbreviation dictionary
│
├── tests/
│   ├── unit/                        # Domain — fast, no I/O
│   ├── integration/                 # DB + adapters
│   ├── architecture/                # Import-graph tests enforcing INV-1/INV-6 and layering
│   ├── adversarial/                 # Prompt injection, wrong-document corpus
│   └── fixtures/                    # Gold set, sample documents, recorded LLM responses
└── alembic/
```

---

## 2. Layer responsibilities & the dependency rule

| Layer | May import | May NOT import | Test style |
|---|---|---|---|
| `domain/` | stdlib, `pydantic` | anything else, ever | Pure unit tests, no fixtures |
| `application/` | `domain`, `application.ports` | `infrastructure`, `api`, any vendor SDK | Unit tests with fake ports |
| `infrastructure/` | `domain`, `application.ports`, vendor SDKs | `api` | Integration tests |
| `api/` | `application`, `api.schemas` | `infrastructure` internals, `domain` models directly | Contract + E2E tests |

**Enforced by `tests/architecture/test_layering.py`**, which walks the AST import graph and asserts:

```
1. domain.*        imports nothing outside {stdlib, pydantic}
2. domain.val.*    and domain.nrm.*  additionally import no
                   {time, datetime.now, random, os, requests, httpx, anthropic}   # INV-6
3. application.*   never imports infrastructure.*
4. api.*           never imports infrastructure.* internals
5. AttributeValue  has no construction path that omits evidence                    # INV-1
```

> **This test is the single most valuable 80 lines in the codebase.** It converts six architectural
> principles from documentation into build failures. Write it in M0.

---

## 3. Domain modelling notes

### 3.1 Making INV-1 structural

The `AttributeValue` type has **no public constructor that accepts a value without evidence.** Two
factory methods exist, and they are the only way to create one:

```
AttributeValue.extracted(value, evidence: NonEmptyList[Evidence], ...)   # evidence required
AttributeValue.unknown(reason: UnknownReason, ...)                       # no value permitted
```

There is no `AttributeValue(value=...)`. Fabrication isn't rejected by a validator — it is
unrepresentable. This is what "invariant" means, and it's the answer to a judge's "what if a
developer forgets?"

### 3.2 Value objects that prevent unit bugs

| Value object | Prevents |
|---|---|
| `Mpn` | Comparing raw and canonical forms by accident |
| `NominalSize` | Being treated as a length or unit-converted (the classic NPS bug) |
| `PressureRating(magnitude, unit, media)` | Comparing WOG to WSP, or WOG to ANSI Class |
| `Quantity(Fraction, Unit)` | Float drift in conversions — **exact rationals throughout** |
| `Confidence` | A raw score being used where a calibrated one is required |

> **`PressureRating` carrying `media` in the type** is what makes FR-NRM-5 (Class ⇎ WOG
> non-derivation) enforceable rather than remembered. There is no `.to_ansi_class()` method. There
> cannot be one.

---

## 4. Dependency injection

Constructor injection, wired once at composition roots (`api/deps.py`, `worker/main.py`). No global
singletons, no service locator, no DI framework.

```
Settings → build adapters → build use cases → hand to FastAPI dependencies / worker loop
```

**Consequences:** every use case is instantiable in a test with fake ports; `cached` and `offline`
LLM modes are a one-line adapter swap at the composition root; there is exactly one file to read to
understand what the system is actually made of.

---

## 5. API contracts

Full endpoint list lives in `api.md`. Conventions:

| Convention | Rule |
|---|---|
| Versioning | `/api/v1/...` from day one |
| Request/response types | Pydantic DTOs in `api/schemas/` — **never** domain models on the wire |
| Errors | RFC 9457 problem+json: `type`, `title`, `status`, `detail`, `code`, `correlation_id` |
| Long operations | `202 Accepted` + `run_id`; progress via `GET /runs/{id}/events` (SSE) |
| Pagination | Cursor-based on every list endpoint (NFR-SCL-3) |
| Idempotency | `Idempotency-Key` header on POSTs that enqueue work |
| Authorization | Asserted in the use case via `ActorContext`, not in the router |
| Field naming | `snake_case` on the wire; the frontend maps once at its API client boundary |

---

## 6. Validation — three distinct kinds, never conflated

| Kind | Where | Purpose |
|---|---|---|
| **Transport validation** | `api/schemas` (Pydantic) | Is this well-formed JSON of the right shape? |
| **Authorization** | Use case entry, via `ActorContext` | May this actor do this? |
| **Domain validation** | `domain/val/` | Is this product data *correct*? |

Conflating these is the most common way business rules leak into controllers. A rule about brass
valve pressure ranges lives in `domain/val/`, is expressed declaratively in
`resources/rules/`, and is testable with no HTTP layer present.

**Rules DSL safety:** rule expressions are evaluated by a restricted interpreter supporting only
comparison, boolean logic, arithmetic, and field references. **`eval()` and `exec()` are banned by an
architecture test.** A rules engine that executes arbitrary strings from a config file is a remote
code execution vulnerability wearing a bow tie.

---

## 7. Workers, queues, events

**Worker loop:** claim (`SKIP LOCKED`) → load record + state → execute the next stage → persist state
+ artifacts + audit → emit stage event → enqueue the following stage → commit.

| Property | Implementation |
|---|---|
| One stage per job | Fine-grained retry; a failing `VER` never re-pays `PRS` cost |
| Transactional | Stage output, state transition, and next-job enqueue commit atomically |
| Idempotent | `dedupe_key = hash(record_id, stage, ruleset_ver, prompt_ver)` |
| Rate-limited | Global per-provider semaphore backed by a Postgres token bucket, so N workers share one limit |
| Observable | Every stage writes a `stage_execution` row with timing and outcome |
| Cancellable | Run-level cancel flag checked between stages |

**Events:** in-process pub/sub for stage progress (SSE fan-out) and eval feedback. Deliberately not a
message bus — the only cross-process communication we need is the job table itself.

---

## 8. Error handling in practice

```python
# Shape only — illustrative of the contract, not code to copy
try:
    result = stage.execute(record, ctx)
except DomainAbstention as e:          # expected: not an error
    persist_unknown(record, e.reason_code, e.partial_evidence)
    advance_state()
except TransientError as e:            # retryable
    if attempt < MAX: reschedule_with_backoff()
    else: persist_unknown(SYSTEM_ERROR); mark_job_dead(); alert()
except InvariantViolation:             # contract breach — NEVER swallow
    log_full_context(); raise
```

**Rules:**
- `DomainAbstention` is the most-thrown exception in the system and is not a failure.
- `InvariantViolation` is never caught outside the top-level boundary, and it fails the job loudly.
- Bare `except Exception` appears exactly once, in the worker's outermost frame, and it re-raises
  after logging.
- Every error carries `correlation_id`.

---

## 9. Testing strategy (backend)

See `09-testing.md` for the full picture. Backend-specific targets:

| Suite | Scope | Gate |
|---|---|---|
| `unit/` | Domain purity — validation, normalisation, confidence, state machine | ≥90% coverage; **100% branch on `nrm/`** |
| `architecture/` | Import graph, INV-1 constructability, no `eval`, no raw `DELETE` | Must pass |
| `integration/` | Repositories, constraints (**assert each INV `CHECK` actually rejects**), queue semantics, adapters | ≥70% |
| `adversarial/` | Prompt injection corpus, wrong-document corpus | QR-12 ≥98% |
| `eval/` | Gold set scoring | Regression gate on PRs touching the pipeline |
| `contract/` | OpenAPI schema stability | Breaking change requires an explicit version bump |

> **Test the constraints, not just the code.** An integration test that attempts to insert an
> `ACCEPTED` Tier-0 row and asserts the database rejects it is worth more than ten unit tests of the
> routing function — because it proves the guarantee survives bugs in the routing function.

---

## 10. Coding standards

| Standard | Rule |
|---|---|
| Python | 3.12, `ruff` (lint + format), `mypy --strict` on `domain/` and `application/` |
| Typing | No `Any` in domain or application. Public functions fully annotated |
| Naming | Module codes (`cls`, `ext`, `ver`) used consistently; no synonyms |
| Functions | Domain functions are pure and total — return a result type rather than raising for expected cases |
| Constants | Thresholds, weights, and tier policies are **configuration**, never literals in code |
| Prompts | Files in `resources/prompts/`, referenced by version. **Inline prompt strings fail review** |
| Logging | Structured only. No `print`. Never log document content or secrets |
| Comments | Explain *why*. The *what* should be evident from names |
| Docstrings | Required on ports, domain rules, and anything with a non-obvious invariant |
| Commits | Conventional Commits; one logical change per PR |
| PR size | < 400 lines changed where possible — Claude Code makes large PRs easy to produce and hard to review |

> ⚠ **The AI-assisted-development trap:** three developers with Claude Code can generate more code
> per day than they can meaningfully review. The mitigations are the architecture test (catches
> structural drift automatically), small PRs, and the eval harness (catches quality drift
> automatically). **Automated gates matter more than usual on this team, not less.**

---

## ✔ Summary

- Folder structure mirrors module codes, so requirement IDs map to directories without translation.
- **The dependency rule is a test, not a convention** — 80 lines of import-graph assertion enforce
  six architectural principles and INV-6.
- **INV-1 is made structural** by removing every construction path that omits evidence; fabrication
  is unrepresentable rather than merely rejected.
- Value objects (`NominalSize`, `PressureRating` with `media`, `Quantity` over exact `Fraction`)
  make the domain's classic unit bugs impossible by typing rather than by vigilance.
- Three kinds of validation kept strictly separate; the rules DSL is a restricted interpreter,
  never `eval()`.
- One stage per job gives fine-grained retry, so a failing verification never re-pays parse cost.
- Integration tests assert the **database constraints** reject invariant violations — proving the
  guarantee survives application bugs.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| D1 | Layer discipline erodes under deadline | Architecture test in CI from M0; it fails the build, not a review comment |
| D2 | Pydantic leaks into the domain as a framework dependency | Only as a data-shape library; no validators with I/O; reviewed |
| D3 | AI-assisted development outruns review capacity | Small PRs, automated gates, eval regression on every pipeline PR |
| D4 | Postgres token-bucket rate limiter is a contention hotspot | Measure at M4; a per-worker limit with a conservative global budget is the fallback |
| D5 | Stage-per-job increases DB round trips | Batch stage transitions where safe; measured against NFR-PERF-5 |

## 💡 Recommendations

1. Write `tests/architecture/` **first**, before the first domain module exists. It is the cheapest
   insurance available and it becomes worthless if added after drift has occurred.
2. Build `resources/` loading in M0 so taxonomy, rules, and prompts are file-driven from the start —
   retrofitting configuration out of hardcoded values is tedious and error-prone.
3. Implement `CachedProvider` (LLM replay) at the same time as the real provider, not later. It makes
   every subsequent test fast and free, and it is the demo safety net.
