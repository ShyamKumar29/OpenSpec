# Gold set — contract and current status

**Status: no real gold set exists in this environment.** `gold_set.csv` is
not shipped in this directory. This is a documented, re-verified gap, not an
oversight — see `docs/15-backend-implementation-status.md` §7/§15 and
`docs/decisions.md` OD-7 for the full history, and the M1 session note below
for the latest re-verification.

## Why

The evaluation harness (`EVL`) needs a set of hand-labelled expected values
to score pipeline output against. Two things would supply that in this
project's plan and neither is available here:

1. **A real manufacturer-document corpus + 150+ hand-labelled attribute
   values** (`docs/10-roadmap.md` M0's own checklist) — blocked on a missing
   document corpus; there is nothing to label extraction against.
2. **The client's own 200-row Input/Delivery-Format gold pairing**
   (`docs/16-unilog-alignment.md` UH0) — the Delivery Format file that *did*
   arrive (`resources/reference/unihack/delivery_format.csv`) has exactly
   **2** example rows, both `Appliances & Consumer Electronics > Kitchen
   Appliances > Built-In Dishwashers` — not Fittings or Faucets, the two
   categories this whole track scores against, and far short of "200 rows".

Treating either of those as a real gold set — or hand-inventing labels for
this dataset without a verified source of truth — would be exactly the
fabricated-evaluation-data failure mode `CLAUDE.md` and this project's M1
brief forbid ("Do NOT ... call sample-input statistics accuracy" / "Never
present synthetic fixture results as real project accuracy").

## What `EVL` does instead

The full evaluation harness — gold-set contract, validation, alignment,
metrics, typed result model — is built and unit-tested against small,
explicitly-labelled **test fixtures** (`tests/fixtures/evl/`,
`tests/unit/test_gold_set_loader.py`, `tests/unit/test_run_evaluation.py`),
the same "architecture now, real data later" discipline every UH milestone
before it (UH2–UH7) already established. `infrastructure/reference_data/
gold_set.py`'s `load_gold_set()` looks for `gold_set.csv` in this directory
at call time; if it's absent, it returns a typed `GOLD_SET_UNAVAILABLE`
outcome — never an empty-but-successful load, and never a fabricated
substitute.

## The contract, for whoever supplies the real file

A CSV with exactly these columns (`domain/evl/gold_validation.py`'s
`REQUIRED_COLUMNS`):

| Column | Meaning |
|---|---|
| `record_id` | Stable identifier joining a gold row to a prediction (`Mfg_Part_Num`, e.g.) |
| `field` | The attribute/column being scored (`MFG_PART_NUM`, `MANUFACTURER_NAME`, ...) |
| `expected_value` | The expected value, verbatim — blank if `expected_unknown_reason` is set |
| `expected_unknown_reason` | One of `docs/api.md`'s closed `unknown_reason` enum — blank if `expected_value` is set |
| `is_real` | `true`/`false` — real client-labelled vs. a synthetic/test row (never mix the two silently; `docs/decisions.md` 2026-08-07: "real and synthetic slices reported separately, real first") |

Exactly one of `expected_value` / `expected_unknown_reason` must be set per
row (mirrors `AttributeValue`'s own INV-4 discipline). `(record_id, field)`
must be unique. See `domain/evl/gold_validation.py` for the full validation
rules (`MISSING_COLUMN` / `MALFORMED_ROW` / `DUPLICATE_IDENTIFIER` /
`INVALID_VALUE`).

## M1 session note (2026-08-14)

Re-verified before implementing `EVL`: searched the user's Desktop,
Downloads, and Documents folders machine-wide for anything gold-set-shaped
(`*gold*`, the six still-missing UH0 reference files, "Fittings_LOV",
"FAUCETS_LOV", "Sample Dataset", "Delivery Format", ...). Found only the
same two CSVs already committed under `resources/reference/unihack/`
(byte-identical to what's already here) and one unrelated file from a
different project (`Desktop/Sahayak/data/eval/matching-golden-set.json` —
a different hackathon's fixture, not this project's data; not used). No new
gold set arrived. This is at least the sixth independent verification pass
across sessions reaching the same conclusion.
