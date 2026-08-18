# UniHack reference pack — what's actually here

> **Read `docs/16-unilog-alignment.md` and `docs/15-backend-implementation-status.md` §7 before
> touching this directory.** This note records provenance and a known gap; it does not repeat the
> milestone plan.

## Files present (verified, loaded by `infrastructure/reference_data/`)

| File here | Original filename (as supplied) | Rows (excl. header) | Columns |
|---|---|---|---|
| `delivery_format.csv` | `Unihack_ Expected Output - Delivery Format.csv` | 2 | 252 |
| `sample_input.csv` | `Unihack_ Sample Dataset - Input.csv` | 1000 | 6 |

Both copied byte-for-field (UTF-8, no BOM, `\r\n` line endings preserved as supplied) from the
files handed to this project. **Do not hand-edit these** — they are the ground truth the loader
and its tests are written against. If a corrected or expanded version is supplied later, replace
the file and re-run `make test` — the schema/stat tests will report exactly what changed.

## Files the design docs describe but that are **not present** in this environment

`docs/16-unilog-alignment.md` and `docs/adr/ADR-0014-unilog-vocabulary-adoption.md` describe a
larger reference pack. As of this UH0 pass, only the two files above were found anywhere on the
machine this session ran on. **Not present:**

| Expected file | Referenced in | Needed for |
|---|---|---|
| `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` | ADR-0014, 16-unilog-alignment.md G2 | UH3 taxonomy cutover |
| `UniCat_Manufacturer_and_Brand_List.xlsx` | ADR-0014, 16-unilog-alignment.md G3 | UH2 manufacturer/brand resolution |
| `Fittings_LOV.xlsx` | ADR-0014, 16-unilog-alignment.md §4 | UH3/UH4 |
| `FAUCETS_LOV.xlsx` | ADR-0014, 16-unilog-alignment.md §4 | UH6 |
| `Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx` | 16-unilog-alignment.md G5 | UH4 `NRM` |
| `Decimal_Fraction.xlsx` | 16-unilog-alignment.md G5 | UH4 `NRM` |
| `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` | ADR-0013 | UH5 `DSC` |

This is a genuine gap between the design docs and what's supplied, not a decision made in this
session — see `docs/15-backend-implementation-status.md` §7 for the full writeup. **No substitute
or fabricated data was created for any of these.** `infrastructure/reference_data/missing_datasets.py`
registers each one explicitly so code that later depends on it fails with a clear, actionable
message (naming the exact file expected, and this directory as the drop location) instead of
silently running against nothing.

**Re-verified 2026-08-13 (follow-up session):** re-searched the environment on a claim that the
missing pack "is now available." It wasn't — same two CSVs, byte-identical (`md5sum`) to what's
already here. Full re-verification writeup in `docs/15-backend-implementation-status.md` §7.

**Re-verified 2026-08-13 (UH2 session, third pass):** searched again specifically for
`UniCat_Manufacturer_and_Brand_List.xlsx` before writing any `RES` code — Desktop, Downloads,
Documents, the rest of the home directory, and a second mapped drive (`Z:\`, including its
`Docs`/`Projects` subfolders). Still not present; no substitute or fabricated workbook was created.
`RES`'s resolution architecture (normalisation, indexed lookup, exact/normalized/alias/fuzzy tiers)
was built and fully unit-tested against a small, explicitly-labelled test fixture instead — see
`docs/15-backend-implementation-status.md` §9 and `infrastructure/reference_data/
manufacturer_brand_list.py`.

When one of these files becomes available, drop it in this directory using the filename in the
table above (lower-cased, `snake_case`, `.xlsx`→ loader's choice) and wire a loader next to
`delivery_format.py` / `sample_input.py` following the same pattern — do not bypass
`missing_datasets.py`'s registry without updating it.

**Re-verified 2026-08-14 (UH3 session, fourth pass):** searched again specifically for
`Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `Fittings_LOV.xlsx`, and `FAUCETS_LOV.xlsx` before
writing any `SCH` code — still not present. `sample_input.csv` re-confirmed to have no `Classpath`
column at all, so Fittings/Faucets scope cannot be determined for any real row in this environment
either. The taxonomy/LOV resolution architecture (classpath typing, attribute-definition
parsing/grouping, category-scope boundary, indexed lookup adapters) was built and fully unit-tested
against small, explicitly-labelled test fixtures instead — see
`docs/15-backend-implementation-status.md` §10.

## Also discovered while inspecting the two files that ARE present

- The Delivery Format file has **2 example rows**, not the 200-row gold set
  `docs/16-unilog-alignment.md` UH0 describes. Both rows are `Classpath =
  "Appliances & Consumer Electronics>Kitchen Appliances>Built-In Dishwashers"` — not Fittings or
  Faucets, the two categories the alignment doc scopes the whole UH track to. Both MPNs
  (`PDSH4816AF`, `WDTS7024RZ`) do appear in `sample_input.csv`, so the pairing itself is real.
- The Rheem/Frigidaire mismatch `docs/16-unilog-alignment.md` §2 calls out by name is confirmed
  present in row 1 (`MANUFACTURER_NAME=Rheem Manufacturing`, `BRAND_NAME=FRIGIDAIRE®`).
- `sample_input.csv`'s `Unilog_Brand` column is the placeholder `-- No Unilog Brand --` on **all
  1000 rows** — it carries no signal in this file.
- `Mfg_Part_Num` is not a unique key in this file: `AVM6EV` appears twice with different
  `Part_Desc` (`"AVM6 EV Mini Snip Red"` vs `"AVM7 EV Mini Snip Green"` — looks like a supplied
  data-entry error, not a real duplicate part). Flagged as a loader warning, not auto-corrected.

**Re-verified 2026-08-14 (M1 session, sixth pass):** searched again specifically for a real gold
set (any `*gold*`-named file, plus every name in `missing_datasets.py`'s registry) before writing
any `EVL` code — Desktop, Downloads, and Documents, machine-wide. Found nothing new: the same two
CSVs already committed here (byte-identical), and one unrelated file from a different project
(`Desktop/Sahayak/data/eval/matching-golden-set.json` — a different hackathon's fixture, not used).
No substitute or fabricated gold set was created. The full evaluation harness (gold-set contract,
validation, metrics, typed result model, Markdown/JSON reporting) was built and fully unit-tested
against small, explicitly-labelled test fixtures instead, and wired for real against the existing
UH4 pipeline's predictions — see `docs/15-backend-implementation-status.md` §16 and
`resources/reference/unihack/gold/README.md`.
