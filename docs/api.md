# API Contract

> **Audience:** frontend and backend. This is the treaty between them.
> **Rule: this document changes BEFORE the endpoint does.** A PR that changes an endpoint without
> updating this file fails review.

---

## Conventions

| Aspect | Rule |
|---|---|
| Base | `/api/v1` |
| Format | JSON, `snake_case` on the wire |
| Auth | Session cookie; `Authorization: Bearer` for service-to-service (Track B) |
| Errors | RFC 9457 `application/problem+json` |
| Pagination | Cursor: `?cursor=<opaque>&limit=<n>`; response carries `next_cursor` |
| Long operations | `202 Accepted` + `run_id`; progress via SSE |
| Idempotency | `Idempotency-Key` header on work-enqueuing POSTs |
| Time | ISO 8601 UTC |
| Correlation | `X-Correlation-Id` echoed on every response |

**Error shape**

```json
{
  "type": "https://openspec.dev/errors/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "Column 'mpn' is required",
  "code": "ING_MISSING_COLUMN",
  "correlation_id": "01J..."
}
```

---

## Records

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/records/import` | Multipart CSV/XLSX upload + column mapping → `202` + `batch_id` |
| `GET` | `/records/import/{batch_id}` | Batch status, row counts, error report link |
| `POST` | `/records` | Create records (JSON batch) → `202` + `run_id` |
| `GET` | `/records` | List. Filters: `class_id`, `status`, `completeness_lt`, `supplier`, `q`, `has_unknown_reason`. Sort: `sort=<field>` / `-<field>` for descending, `field ∈ {mpn_raw, completeness, unknown_count, tier0_pending_count}` (adopted in `frontend-f1`, additive — same route, no contract break) |
| `GET` | `/records/{id}` | Full record: class, completeness, bindings, current attribute values |
| `POST` | `/records/{id}/enrich` | Re-run the pipeline → `202` + `run_id`. Body: `{ from_stage?, force? }` |
| `PATCH` | `/records/{id}/class` | Manual reclassification (writes `HUMAN` provenance) |

**`GET /records/{id}` response shape (abridged)**

```json
{
  "id": "...", "mpn_raw": "ABC-123", "description_raw": "1/2 BRS BALL VLV 600WOG",
  "class": { "id": "...", "code": "BALL_VALVE_BRONZE", "name": "Ball Valve, Bronze/Brass",
             "confidence": 0.97, "provenance_kind": "DERIVED", "signal": "rule+llm" },
  "completeness": { "mandatory_total": 22, "filled": 18, "accepted": 12,
                    "pending_review": 4, "unknown": 4 },
  "bindings": [ { "document_version_id": "...", "region_id": "table:1/row:14",
                  "confidence": 0.98, "signals": { "exact_mpn_hit": true, "supplier_match": true } } ],
  "attributes": [ /* AttributeValue objects, see below */ ]
}
```

---

## Attribute values

**`AttributeValue` (the core DTO)**

```json
{
  "id": "...",
  "attribute": { "code": "pressure_rating_wog", "name": "Pressure Rating (WOG)",
                 "datatype": "pressure", "risk_tier": 0, "is_mandatory": true },
  "status": "NEEDS_APPROVAL",
  "value_display": "600 psi",
  "value_canonical": { "magnitude": 600, "unit": "psi", "media": "WOG" },
  "value_raw": "600 WOG",
  "unknown_reason": null,
  "provenance_kind": "EXTRACTED",
  "confidence": 0.97,
  "evidence": [ { "document_version_id": "...", "page": 2, "region_id": "table:1/row:14/cell:6",
                  "char_start": 118, "char_end": 125, "snippet_text": "600 WOG",
                  "bbox": [312, 480, 372, 494] } ],
  "verification": { "verdict": "ENTAILED", "deterministic_check": "exact",
                    "rationale": "Row 14 corresponds to catalog no. 70-104-01…",
                    "verifier_model": "..." },
  "created_at": "2026-08-07T09:12:03Z"
}
```

**`unknown_reason` enum (closed set):** `NO_DOCUMENT_FOUND` · `DOCUMENT_LOW_CONFIDENCE` ·
`DOCUMENT_UNPARSEABLE` · `ATTRIBUTE_NOT_IN_DOCUMENT` · `AMBIGUOUS_CANDIDATES` ·
`VERIFICATION_FAILED` · `VALIDATION_FAILED` · `NORMALIZATION_FAILED` ·
`BELOW_CONFIDENCE_THRESHOLD` · `CLASS_UNRESOLVED` · `CONFLICTING_SOURCES` · `POLICY_BLOCKED` ·
`SYSTEM_ERROR`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/attributes/{id}/explain` | **The "Why?" panel payload** — evidence, verification, validation results, transform chain, confidence signal breakdown, policy note |
| `GET` | `/attributes/{id}/history` | Full supersession chain + audit events |

---

## Documents

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/documents` | Upload a PDF → `document_version_id` |
| `GET` | `/documents` | Corpus list. Filters: `publisher`, `bound_count`, `parse_status` |
| `GET` | `/documents/{version_id}` | Metadata, parse status, regions summary, per-page dimensions |
| `GET` | `/documents/{version_id}/pages/{n}/image` | **Pre-rendered page image** (cached, fixed DPI) |
| `GET` | `/documents/{version_id}/regions` | Region tree with bboxes — powers the highlight overlay |
| `POST` | `/records/{id}/bindings` | Manually attach a document/region (`HUMAN` provenance) |
| `DELETE` | `/records/{id}/bindings/{binding_id}` | Detach (soft) |

> The page image and region tree share a coordinate system by construction — see `06-frontend.md` §7.

**Additive, non-breaking (adopted in `frontend-f0.5`, per `14-frontend-implementation-plan.md`
§3 O1):** `GET /documents/{version_id}` also returns per-page pixel dimensions, so the
`DocumentViewer`'s coordinate-adapter conversion (wire pixel space → normalised `[0,1]`
rectangles) is possible without a second request.

```json
"pages": [ { "n": 1, "width_px": 1700, "height_px": 2200, "dpi": 200 } ]
```

Convention: `bbox` (in `AttributeValue.evidence` and in `DocumentRegion`) is in the same
pixel space as the rendered page image for that `(version_id, page, dpi)`, origin top-left.

---

## Review

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/review/tasks` | Queue. Filters: `reason_code`, `risk_tier`, `class_id`, `assigned_to`, `confidence_lt` |
| `GET` | `/review/tasks/counts` | Counts per reason code — powers the queue tabs |
| `GET` | `/review/next` | Claim the next task (supports `?reason_code=`) |
| `POST` | `/review/tasks/{id}/accept` | Accept the proposed value |
| `POST` | `/review/tasks/{id}/reject` | → `Unknown` with an optional reason |
| `POST` | `/review/tasks/{id}/correct` | `{ value, reason }` → new `HUMAN` value supersedes |
| `POST` | `/review/tasks/{id}/approve` | Tier-0 approval (role `approver` only) |
| `POST` | `/review/bulk` | `{ task_ids[], action, value? }` with a confirmation summary |
| `GET` | `/review/session/stats` | Resolved count, rate/hour, median decision time |

---

## Runs & progress

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/runs/{id}` | Run status, per-stage progress, cost, token totals |
| `GET` | `/runs/{id}/events` | **SSE stream** of stage events |
| `POST` | `/runs/{id}/cancel` | Cooperative cancel between stages |

**SSE event shape**

```
event: stage
data: { "record_id": "...", "stage": "EXT", "state": "running",
        "progress": { "done": 17, "total": 22 }, "duration_ms": 6200, "cost_usd": 0.041 }
```

---

## Judge Mode

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/judge/run` | `{ mpn, description, document? }` → `202` + `run_id`. **Isolated from catalog data** (FR-JDG-5). Hard timeout with partial results (FR-JDG-4) |
| `GET` | `/judge/runs/{id}` | Full intermediate output for every stage |

---

## Export

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/export/targets` | Available adapters (`csv`, `json`, `xlsx`, `cx1`) |
| `POST` | `/export` | `{ target, filter, include_provenance, policy }` → `202` + `export_id` |
| `GET` | `/export/{id}` | Status + download link + validation report |
| `GET` | `/catalog/pull` | Paginated machine-readable pull for downstream systems |

**Export policy:** `auto_accepted_only` · `human_approved_only` · `all_with_flags`.
CSV exports escape leading `=`, `+`, `-`, `@` (threat T11).

---

## Evaluation & dashboard

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/eval/runs` | Trigger an evaluation run |
| `GET` | `/eval/runs` | History with metric deltas |
| `GET` | `/eval/runs/{id}` | Metrics with CIs, per-slice breakdown, frontier + reliability data, ablation table |
| `GET` | `/metrics/catalog-health` | Completeness, STP, unknown-reason breakdown |
| `GET` | `/metrics/throughput` | SKUs/hr, cost/SKU, reviewer rate vs configured baseline |
| `GET` | `/metrics/quality-trend` | Metric series over eval runs |

---

## Admin (Track B)

| Method | Path | Purpose |
|---|---|---|
| `GET`/`PUT` | `/admin/thresholds` | Per-tier τ values (hot-reloaded) |
| `GET`/`PUT` | `/admin/routing` | Model routing policy |
| `GET` | `/admin/schemas` | Loaded taxonomy + attribute definitions |
| `GET` | `/admin/audit` | Audit log query (read-only, always) |

---

## ✔ Summary

- One versioned contract, `snake_case`, RFC 9457 errors, cursor pagination, SSE for progress.
- `AttributeValue` is the central DTO and **always carries evidence, verification, provenance kind,
  and either a value or a reason code** — the wire format itself enforces INV-1 and INV-4.
- `/attributes/{id}/explain` is the "Why?" panel and is the single most important endpoint in the API.
- Page images and region trees share a coordinate system by construction, eliminating highlight
  misalignment as a class of bug.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| M1 | Contract drifts from implementation | This doc changes first; OpenAPI schema snapshot test in CI |
| M2 | `explain` payload grows unbounded on records with many candidates | Cap candidate lists; paginate history |
| M3 | SSE unreliable across hosting boundaries | Polling fallback on the same endpoint shape |

## 💡 Recommendations

1. Generate the frontend API client types from the OpenAPI schema — it makes contract drift a
   compile error rather than a runtime surprise.
2. Design `/attributes/{id}/explain` before building the pipeline. What it must return determines
   what the pipeline must persist, and discovering that late is expensive.
