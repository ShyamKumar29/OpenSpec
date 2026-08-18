"""Deterministic layer of `VER` (M3, `docs/10-roadmap.md` M3 §9: "Where
deterministic verification is possible, prefer deterministic checks"). Combines two
independently-meaningful checks into one accept/reject decision, run **before** any
LLM verifier is even considered:

1. **INV-3 containment** (`domain/ext/span_containment.py`) — does the cited evidence
   snippet genuinely occur in its claimed source? Catches a hallucinated span.
2. **Entailment** (`domain/ver/entailment.py`) — does the asserted `value_raw`
   literally equal the evidence snippet? Every `EXT` candidate in this milestone is
   verbatim by construction (`docs/10-roadmap.md` M3 §2 — normalisation is a later
   stage's job), so exact-match is the correct, sufficient entailment check for
   *all* of them, not a simplification specific to one attribute.

A candidate that fails either check is rejected here, deterministically, with no LLM
call — this is the "candidate is syntactically valid but semantically unsupported"
and "evidence span is invalid" adversarial cases (`docs/10-roadmap.md` M3 §10 #5, #6,
#10) closed structurally, not by hoping a downstream LLM verifier catches them. A
candidate that *passes* both checks still is not proof the citation is about the
*right* attribute (a verbatim, in-bounds quote of "Storage temperature" evidence
cited for an `operating_temperature` attribute would pass both of these) — that
relevance judgement is what an independent LLM verifier is for
(`application/usecases/verify_extraction.py`), and it is only ever consulted after
this module has already said yes.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.ext.span_containment import SpanContainmentOutcome, check_evidence_containment
from openspec.domain.model.attribute import Verification
from openspec.domain.model.extraction import ExtractionCandidate
from openspec.domain.ver.entailment import verify_exact_match


@dataclass(frozen=True, slots=True)
class DeterministicVerificationResult:
    verification: Verification
    accepted: bool
    containment_failed: bool
    """`True` only when rejection was caused by a containment failure (not an
    entailment mismatch) — lets a caller skip an LLM verifier call entirely for a
    candidate whose evidence is already known-fabricated; there is nothing left for
    an LLM to usefully judge."""


def verify_candidate_deterministic(
    *,
    candidate: ExtractionCandidate,
    source_texts: tuple[str, ...],
    verifier_name: str = "deterministic:containment_and_exact_match",
) -> DeterministicVerificationResult:
    """`source_texts` must be the same length as `candidate.evidence`, positionally
    aligned — the caller (a composition root with access to the real document
    region / row / reference table) is responsible for resolving each evidence
    item's actual ground-truth text. This function does no I/O and trusts none of
    `candidate`'s own claims about its source; it only trusts `source_texts`."""
    if len(source_texts) != len(candidate.evidence):
        raise ValueError(
            f"source_texts length {len(source_texts)} does not match "
            f"candidate.evidence length {len(candidate.evidence)}"
        )

    containment_results = [
        check_evidence_containment(source_text=text, evidence=item)
        for item, text in zip(candidate.evidence, source_texts, strict=True)
    ]
    invalid = [r for r in containment_results if r.outcome is not SpanContainmentOutcome.CONTAINED]
    if invalid:
        detail = "; ".join(f"{r.outcome.value}: {r.detail}" for r in invalid)
        return DeterministicVerificationResult(
            verification=Verification(
                verdict="NOT_ENTAILED",
                deterministic_check="fail",
                rationale=(
                    f"INV-3 span containment failed for {len(invalid)}/"
                    f"{len(containment_results)} evidence item(s): {detail}"
                ),
                verifier_model=verifier_name,
            ),
            accepted=False,
            containment_failed=True,
        )

    # Containment holds for every evidence item. Entailment: value_raw must be an
    # exact, verbatim quote of the evidence that is meant to support it — every M3
    # candidate's primary (first) evidence item is that support by construction
    # (`domain/ext/candidate_builder.py`).
    primary = candidate.evidence[0]
    verification = verify_exact_match(
        value_raw=candidate.value_raw,
        evidence_snippet=primary.snippet_text,
        verifier_name=verifier_name,
    )
    return DeterministicVerificationResult(
        verification=verification,
        accepted=verification.verdict == "ENTAILED",
        containment_failed=False,
    )
