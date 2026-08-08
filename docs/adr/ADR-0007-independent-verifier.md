# ADR-0007 — Independent verification as a separate pipeline stage
Status: Accepted
Date: 2026-08-07

## Context
Requiring the extractor to cite a source span solves fabrication (failure mode F1) but not
**misgrounding** (F2 — a real span that doesn't support the value) or **misattribution** (F3 —
correct extraction from the wrong row). Both produce output that passes a naive provenance check,
and both are common in family datasheets.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Self-verification in the extraction prompt | Cheapest | The model checking its own work shares its own blind spots. Measured gains are small |
| Deterministic span-containment only | Free, fast | Catches fabricated spans, misses semantically wrong ones (right string, wrong row) |
| Sampling/consistency (N extractions, vote) | No extra prompt design | N× cost; correlated errors survive voting; doesn't detect wrong-row |
| **Separate verification stage, asymmetric prompt, different model** | Detects F2/F3; independent failure modes; the rationale is a reviewer-facing artifact | ~2× LLM cost on extraction; added latency |

## Decision
A `VER` stage runs after `EXT`. A **deterministic span-containment check (INV-3) runs first and can
reject for free.** The model verifier then sees only the span and the claim — not the extraction
prompt, not the reasoning, not other attributes — and is framed adversarially as an entailment task.
It uses a different model from the extractor where available. `NOT_ENTAILED` downgrades the value to
`Unknown(VERIFICATION_FAILED)`; it is never published.

## Consequences
**Easier:** the primary product claim becomes measurable — the ablation study quantifies exactly what
verification buys. The verifier's rationale becomes the most useful text in the review queue.
**Harder:** roughly doubles LLM cost and latency on the extraction path.
**Accepted:** mitigated by the free deterministic pre-check, attribute batching, and an optional
skip rule for Tier-2/3 attributes with exact span matches (to be validated on the gold set before
enabling).

## Revisit when
The ablation study shows verification contributes less than ~10% relative error reduction, or a
cheaper mechanism (a small NLI model) achieves the same delta at lower cost.
