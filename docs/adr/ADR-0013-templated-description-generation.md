# ADR-0013 — Templated multi-format description generation, in scope
Status: Accepted
Date: 2026-08-13

## Context
`01-requirements.md` §6 and the decision log (`decisions.md`, 2026-08-07) put description generation
explicitly **out of scope** (OOS-3), reasoning that free-text generation contradicts the "prove every
value, never guess" thesis, and that refusing it is itself a positioning statement.

The Unilog challenge brief reframes this. Its worked example (`PDSH4816AF`) shows the same product
rewritten five times — `INVOICE_DESC` (≤40 char, CAPS), `MOBILE_DESC` (60–80 char), `SHORT_DESC`,
`LONG_DESC1`, up to 20 `ITEM_FEATURES_n` — and states plainly: *"getting these formats right is most
of the task."* The content guidelines supply **construction formulas** per field (e.g. `Product Title
= Brand + Series + MPN + Item Type + key attributes`), not open-ended prompts. Refusing this module
would score zero on a named, evaluated part of the brief while adding nothing to the trust story —
because the objection OOS-3 raised (free-text generation invites fabrication) does not apply to
formula-driven templating.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Keep OOS-3 as written | Consistent with original positioning | Fails a named, scored requirement; the client's own guidelines make this a lookup-and-concatenate problem, not a generation problem |
| LLM free-text generation per field | Fluent copy | Reintroduces fabrication risk OOS-3 was right to reject; ungrounded phrases are unverifiable |
| **Templated construction from accepted `AttributeValue`s, formulas as versioned config** | Every clause traces to an `AttributeValue` (which already traces to evidence); zero new fabrication surface; matches the existing rule that explanations are templated from provenance, never narrated | Coverage is bounded by how many attributes are already `ACCEPTED`/`NEEDS_REVIEW`; a thin record produces a thin description, which is honest, not a bug |

## Decision
Add a description-construction module (`DSC`) between `CNF` and `PUB`. It reads only
`AttributeValue`s already in the pipeline's own store — never the source document, never a live
model call — and assembles each output field (title, invoice/mobile/short/long descriptions,
`ITEM_FEATURES_n`) from a **declarative formula per field per class**, stored as versioned YAML in
`backend/resources/description-formulas/`, mirroring how `SCH` schemas and `VAL` rules are already
declarative (per the "AI is allowed / banned" table in `CLAUDE.md`).

Character-limit and casing rules from `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx` are enforced the same
way `VAL` enforces attribute rules: a rule ID, a pass/fail test, no LLM in the check. An attribute
missing from the record is simply omitted from the formula's slot — never inferred to fill a template
gap. This keeps `DSC` inside INV-1: nothing appears in a description that isn't already a sourced
`AttributeValue`.

`01-requirements.md` §6 OOS-3 and the 2026-08-07 decision-log entry are superseded by this ADR.

## Consequences
**Easier:** the module composes entirely from data the pipeline already trusts; no new verification
machinery is needed; a description-accuracy metric ("does the generated `LONG_DESC1` match the gold
row's tokens") slots directly into the existing eval harness.
**Harder:** formula coverage must be written per class (Fittings, Faucets first — see
`16-unilog-alignment.md`); a class with no formula falls back to a minimal concatenation, which should
be flagged in the eval report rather than hidden.
**Accepted:** description quality is bounded by attribute completeness. A record with 6 of 22
attributes filled gets a correspondingly thin description — reported honestly, consistent with the
project's existing refusal-over-guessing stance.

## Revisit when
Formula coverage exists for all demo classes and the eval harness reports description field accuracy
against the 200-row gold set with confidence intervals — at that point, decide whether an LLM
paraphrase pass (still evidence-bounded, still verified) is worth adding on top of the template for
fluency, per `12-hackathon-strategy.md`'s "AI where the model earns it" framing.
