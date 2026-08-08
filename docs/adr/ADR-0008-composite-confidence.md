# ADR-0008 — Composite calibrated confidence, not model self-report
Status: Accepted
Date: 2026-08-07

## Context
Confidence drives the auto-accept decision (FR-CNF-5). If the number is meaningless, the entire
routing policy is arbitrary and the product's central promise is unfounded.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Ask the LLM for a 0–1 confidence | Trivial | **Poorly calibrated**; weakly correlated with correctness in the decision-relevant range; unexplainable; cannot be improved systematically |
| Token log-probabilities | Model-internal signal | Not exposed by all providers; measures token likelihood, not factual correctness; still unexplainable to a reviewer |
| Binary gates only (pass/fail) | Simple, honest | Throws away information; no tunable precision/coverage frontier |
| **Composite of measured signals, calibrated on the gold set** | Explainable per-signal; tunable; improvable; produces a reliability diagram | Requires a labelled gold set and calibration work |

## Decision
Confidence is computed by **pure code (INV-6)** from a typed signal vector: document binding, row
binding, parse quality, span containment strength, verification verdict, candidate agreement,
validation result, provenance kind, class confidence, per-attribute historical precision, and
optional dual-model agreement. A weighted linear score is fitted to a calibrated probability by
isotonic regression on the gold set.

## Consequences
**Easier:** the score is explainable field-by-field in the UI; "0.94" genuinely means "≈94% of values
scored 0.94 are correct"; the precision/coverage frontier becomes a real, tunable product control;
the reliability diagram becomes a demonstrable artifact.
**Harder:** requires the gold set to exist and to be maintained; calibration must be refitted when
the pipeline changes materially.
**Accepted:** the gold set is required for every other quality claim anyway.

## Revisit when
Calibration error (ECE) exceeds 0.05 despite refitting, or a learned scorer over the signal vector
demonstrably beats the linear model on held-out data.
