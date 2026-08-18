"""`bind_record_to_document` — the DOC use case (`docs/10-roadmap.md` M2: "retrieval
hierarchy... signal capture, document + row-level binding confidence"). Orchestrates
the pure `domain/doc/binding_engine.py` cascade and, only when deterministic tiers
leave a small ambiguous pool, offers that pool to an LLM for disambiguation
(`CLAUDE.md`'s one AI-allowed step in this module) — the LLM may only pick one of
the offered `document_version_id`s, never invent one, mirroring `classify_record`'s
"an LLM may propose a class, it must NOT create a class" discipline (M1) applied to
document binding instead.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.llm import LlmMessage, LLMProvider, LlmRequest
from openspec.domain.doc.binding_engine import (
    BindingCandidate,
    BindingNeedsDisambiguation,
    BindingPolicy,
    BindingResolved,
    BindingUnresolvedReason,
    resolve_document_binding,
)
from openspec.domain.errors import DomainAbstention
from openspec.domain.model.document import BindingMethod, BindingStatus, DocumentBinding

_PROMPT_VERSION = "doc_disambiguation_v1"
_AUTO_ACCEPT_METHODS = frozenset({BindingMethod.EXACT_MPN, BindingMethod.NORMALIZED_MPN})


@dataclass(frozen=True, slots=True)
class BindingOutcome:
    """Exactly one of `binding` or `unresolved_reason` is set — mirrors
    `AttributeValueAsserted | AttributeValueUnknown`'s "no third shape" discipline.
    `candidates_considered` is kept even on failure so the caller can log/explain
    how large the candidate pool was."""

    binding: DocumentBinding | None
    unresolved_reason: BindingUnresolvedReason | None
    candidates_considered: int


def _signals(candidate: BindingCandidate) -> dict[str, object]:
    return {
        "exact_mpn_hit": candidate.exact_mpn_hit,
        "normalized_mpn_hit": candidate.normalized_mpn_hit,
        "supplier_match": candidate.supplier_match,
        "class_match": candidate.class_match,
        "text_overlap_score": candidate.text_overlap_score,
    }


def _binding_id(record_id: str, document_version_id: str) -> str:
    return f"binding_{record_id}_{document_version_id}"


def _llm_disambiguate(
    *,
    mpn: str,
    description: str,
    candidates: tuple[BindingCandidate, ...],
    prompt_template: str | None,
    llm: LLMProvider | None,
    policy: BindingPolicy,
) -> BindingCandidate | None:
    """Returns the candidate the LLM picked, or `None` if disambiguation isn't
    configured, the provider abstains, or the model's answer isn't one of the
    offered `document_version_id`s (validated exactly like `classify_record`
    validates a proposed class against `known_class_codes`)."""
    if llm is None or prompt_template is None:
        return None
    options = "\n".join(f"- {c.document_version_id}" for c in candidates)
    prompt = prompt_template.format(mpn=mpn, description=description, options=options)
    try:
        response = llm.complete(
            LlmRequest(
                stage="DOC",
                prompt_version=_PROMPT_VERSION,
                model=policy.llm_model,
                system=(
                    "You are matching a product record to the single correct manufacturer "
                    "document among a short offered list. Respond with exactly one "
                    "document_version_id from the list, or NONE."
                ),
                messages=(LlmMessage(role="user", content=prompt),),
            )
        )
    except DomainAbstention:
        return None
    proposed = response.content.strip()
    return next((c for c in candidates if c.document_version_id == proposed), None)


def bind_record_to_document(
    *,
    record_id: str,
    mpn: str,
    description: str,
    candidates: tuple[BindingCandidate, ...],
    policy: BindingPolicy,
    created_at: str,
    prompt_template: str | None = None,
    llm: LLMProvider | None = None,
) -> BindingOutcome:
    resolution = resolve_document_binding(candidates, policy)

    if isinstance(resolution, BindingResolved):
        scored = resolution.scored
        status = (
            BindingStatus.ACCEPTED
            if scored.method in _AUTO_ACCEPT_METHODS
            else BindingStatus.NEEDS_REVIEW
        )
        binding = DocumentBinding(
            id=_binding_id(record_id, scored.candidate.document_version_id),
            record_id=record_id,
            document_version_id=scored.candidate.document_version_id,
            region_id=None,
            confidence=scored.confidence,
            signals=_signals(scored.candidate),
            method=scored.method,
            status=status,
            created_by_kind="system",
            created_at=created_at,
        )
        return BindingOutcome(
            binding=binding, unresolved_reason=None, candidates_considered=len(candidates)
        )

    if isinstance(resolution, BindingNeedsDisambiguation):
        picked = _llm_disambiguate(
            mpn=mpn,
            description=description,
            candidates=resolution.candidates,
            prompt_template=prompt_template,
            llm=llm,
            policy=policy,
        )
        if picked is not None:
            binding = DocumentBinding(
                id=_binding_id(record_id, picked.document_version_id),
                record_id=record_id,
                document_version_id=picked.document_version_id,
                region_id=None,
                confidence=policy.llm_disambiguation_confidence,
                signals=_signals(picked),
                method=BindingMethod.LLM_DISAMBIGUATION,
                status=BindingStatus.NEEDS_REVIEW,
                created_by_kind="system",
                created_at=created_at,
            )
            return BindingOutcome(
                binding=binding, unresolved_reason=None, candidates_considered=len(candidates)
            )
        return BindingOutcome(
            binding=None,
            unresolved_reason=BindingUnresolvedReason.AMBIGUOUS_CANDIDATES,
            candidates_considered=len(resolution.candidates),
        )

    # BindingUnresolved
    return BindingOutcome(
        binding=None,
        unresolved_reason=resolution.reason,
        candidates_considered=len(resolution.candidates),
    )
