# Description formulas — blocked on missing content guidelines

This directory is where per-class description-construction formulas live
(`DSC`, UH5 — [ADR-0013](../../../docs/adr/ADR-0013-templated-description-generation.md)),
one YAML file per class code, e.g. `FITTINGS.yaml`:

```yaml
formula_version: "1"
fields:
  MOBILE_DESC:
    slots:
      - kind: attribute
        attribute_code: MANUFACTURER_NAME
      - kind: literal
        text: ", "
      - kind: attribute
        attribute_code: MFG_PART_NUM
    separator: ""
    casing: AS_IS
```

**No class formula files are shipped here today.** `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` — the
document that would supply the real, client-specified construction formulas per field per class — is
one of the seven UniHack reference files not present in this environment
(`../../src/openspec/infrastructure/reference_data/missing_datasets.py`,
`../reference/unihack/README.md`). Writing formula files without it would mean inventing how
`INVOICE_DESC`/`MOBILE_DESC`/`SHORT_DESC`/`LONG_DESC1`/`ITEM_FEATURES_n` are actually supposed to be
assembled — precisely the fabrication this project's brief forbids.

What *is* built and real, independent of this gap:

- The formula engine itself (`domain/dsc/formula_engine.py`) — pure, tested against fixture formulas.
- The loader (`infrastructure/reference_data/description_formulas.py`) — tested against a fixture
  directory, not this one.
- Confirmed character-limit/casing validation for the two fields ADR-0013's own worked example
  documents a number for (`INVOICE_DESC` ≤40 char CAPS, `MOBILE_DESC` 60–80 char) —
  `domain/dsc/validation.py:CONFIRMED_FIELD_CONSTRAINTS`.

`application.usecases.build_description.build_field_description` returns a structured
`DescriptionBlocked(reason="NO_FORMULA_CONFIGURED")` for every field+class today, honestly, rather
than a guessed description — the same pattern UH2/UH3's `Unknown(REFERENCE_DATA_UNAVAILABLE)` and
`SchemaBlocked` established.

Drop a real class formula file here (reviewed in a PR, per CLAUDE.md's "Schemas & rules: Declarative
YAML... Not code") once `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` is supplied.
