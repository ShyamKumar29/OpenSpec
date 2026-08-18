# ADR-0014 — Adopt the Unilog LOV/manufacturer vocabulary; retire the hand-authored taxonomy for the demo classes
Status: Accepted
Date: 2026-08-13
Supersedes: ADR-0011

## Context
ADR-0011 hand-authored a 5-class, ETIM-shaped taxonomy because ETIM's own licensing terms were
unresolved and not on the critical path. That reasoning was correct at the time it was written.

The Unilog challenge pack supplies a real, ready-to-use controlled vocabulary for free:
`Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` (~161k rows: Classpath, Leaf Node, Filtering Y/N,
Attribute Label, Attribute Values, Normalized Label, Normalized Values, Guidelines, Remarks),
`UniCat_Manufacturer_and_Brand_List.xlsx` (27k+ approved manufacturer/brand rows with exact legal
casing and ®/™), and two category specs done to full depth — `Fittings_LOV.xlsx` and
`FAUCETS_LOV.xlsx`. Attribute values not drawn from this vocabulary score zero per the brief
("a fluent description made of invented values scores zero"). Continuing to score against a
hand-authored taxonomy means grading ourselves against a schema the judges never asked for.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Keep the hand-authored taxonomy (ADR-0011 as-is) | No rework; internally consistent with what's already built | Optimises against the wrong ground truth; the client's own scoring keys off their vocabulary, not ours |
| Adopt ETIM directly | Original long-term goal | Licensing still unresolved (OD-3 still open); doesn't match what the client actually supplied |
| **Adopt the Unilog `Classpath` / LOV / manufacturer list as the taxonomy source for the demo classes, keeping the ETIM-shaped `external_ref` field from ADR-0011 as the mapping seam** | Directly scoreable against the 200-row gold set; no licensing question; `external_ref` still gives a future path to ETIM/UNSPSC | Re-load `resources/taxonomy/` from client files instead of the hand-authored YAML; loses the "we designed this ourselves" framing (acceptable — see Consequences) |

## Decision
`backend/infrastructure/taxonomy_loader.py` loads its class → attribute schema from
`Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, scoped first to the two categories the client specified
end-to-end: **Fittings** (`Fittings_LOV.xlsx`: 390 Fitting Types, 1,472 connection-type variants →
515 canonical, 464 Material Construction → 113 canonical) and **Kitchen/Bath Faucets**
(`FAUCETS_LOV.xlsx`: fixed attribute sequence, fixed title word order, style guide). The
`external_ref` field introduced in ADR-0011 is retained unchanged and now stores the source
`Classpath` string, preserving the ETIM/UNSPSC migration path ADR-0011 designed for.

Manufacturer/brand normalisation (new module, `RES` — resolution) matches free-text supplier strings
against `UniCat_Manufacturer_and_Brand_List.xlsx` deterministically (exact → normalised → fuzzy, per
`CLAUDE.md`'s "AI is banned for candidate search" rule), never via a model call.

The bronze ball valve class and its hand-authored YAML from ADR-0011 are kept in `resources/` as the
architecture-test fixture they already serve as (`tests/architecture/`, `infrastructure/memory/`
demo dataset) but are no longer the class the pipeline is scored against.

## Consequences
**Easier:** every extracted value has a mechanical yes/no check — "is this in the LOV's Normalized
Values for this Attribute Label under this Classpath" — which becomes a validation rule (`VAL`) for
free and a headline eval metric the brief names directly ("percentage of values found in the LOV").
Fittings' 1,472→515 and 464→113 mappings are a ready-made, labelled entity-resolution eval set.
**Harder:** the LOV file is large (~161k rows) and messy per the brief's own warning ("inspect each
sheet before parsing it") — the loader needs real parsing work, not a straight YAML transcription.
Two categories' worth of attribute definitions must be loaded before `SCH` can serve them, which
gates `EXT` and `VAL` behind it.
**Accepted:** the "adding a sixth class is a YAML file, zero code changes" claim from ADR-0011 now
also requires an LOV extract for that class — still declarative, still no code change, but no longer
purely hand-authored. This is recorded as the ADR-0011 claim's amended form, not a retraction.

## Revisit when
ETIM licensing resolves (OD-3) — at that point `external_ref` is populated from ETIM/UNSPSC codes
instead of the Unilog `Classpath`, which was always the intended seam. Also revisit if the
competition's own vocabulary is later shown to diverge from ETIM in ways that matter beyond the demo.
