"""The DOC retrieval hierarchy (`docs/10-roadmap.md` M2: "retrieval hierarchy (exact
-> normalised -> supplier -> class -> overlap -> LLM disambiguation), signal capture,
document + row-level binding confidence, conflict detection"). Same cascade shape
`application/usecases/resolve_manufacturer_brand.py` established for `RES` (UH2):
try the strongest deterministic tier first; if it narrows the candidate pool to
exactly one, done; if it narrows to several, hand that smaller pool to the next
tier; only when every deterministic tier is exhausted and more than one candidate
survives does resolution fall through to LLM disambiguation (or, if the pool is too
large even for that, to an honest `AMBIGUOUS_CANDIDATES` outcome for human review).

No LLM call is made in this module — it is pure (INV-6-shaped, though not in the
architecture test's `val`/`nrm` list since DOC isn't named there; still zero I/O by
construction, verified by inspection). `application/usecases/bind_document.py` is
where an offered `BindingNeedsDisambiguation` pool may be handed to an `LLMProvider`.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.document import BindingMethod, DocumentBinding

# ---- Document-level candidate search -----------------------------------------------


@dataclass(frozen=True, slots=True)
class BindingCandidate:
    """One candidate document version for a record, with every deterministic signal
    the retrieval hierarchy checks (`docs/api.md` §Records `bindings[].signals`
    names `exact_mpn_hit`/`supplier_match` already; this is the full signal set)."""

    document_version_id: str
    exact_mpn_hit: bool
    normalized_mpn_hit: bool
    supplier_match: bool
    class_match: bool
    text_overlap_score: float  # [0,1] — fraction of description tokens found in the document

    def __post_init__(self) -> None:
        if not self.document_version_id:
            raise InvariantViolation("BindingCandidate.document_version_id must be non-empty")
        if not (0.0 <= self.text_overlap_score <= 1.0):
            raise InvariantViolation(
                f"text_overlap_score out of range [0,1]: {self.text_overlap_score}"
            )


@dataclass(frozen=True, slots=True)
class BindingPolicy:
    """Thresholds/confidences as configuration (`CLAUDE.md`: "Thresholds & policies |
    Configuration, never literals in code"), loaded from
    `resources/policy/document_binding.yaml` — mirrors `ResolutionPolicy` (UH2) and
    `ClassificationPolicy` (M1)'s established shape."""

    exact_mpn_confidence: float
    normalized_mpn_confidence: float
    supplier_match_confidence: float
    class_match_confidence: float
    text_overlap_confidence: float
    text_overlap_threshold: float
    llm_disambiguation_confidence: float
    max_llm_disambiguation_pool: int
    llm_model: str = "offline"

    def confidence_for(self, method: BindingMethod) -> float:
        return {
            BindingMethod.EXACT_MPN: self.exact_mpn_confidence,
            BindingMethod.NORMALIZED_MPN: self.normalized_mpn_confidence,
            BindingMethod.SUPPLIER_MATCH: self.supplier_match_confidence,
            BindingMethod.CLASS_MATCH: self.class_match_confidence,
            BindingMethod.TEXT_OVERLAP: self.text_overlap_confidence,
            BindingMethod.LLM_DISAMBIGUATION: self.llm_disambiguation_confidence,
        }[method]


@dataclass(frozen=True, slots=True)
class ScoredBindingCandidate:
    candidate: BindingCandidate
    method: BindingMethod
    confidence: float


class BindingUnresolvedReason(StrEnum):
    NO_CANDIDATES = "NO_CANDIDATES"
    AMBIGUOUS_CANDIDATES = "AMBIGUOUS_CANDIDATES"  # pool too large even for LLM disambiguation


@dataclass(frozen=True, slots=True)
class BindingResolved:
    scored: ScoredBindingCandidate


@dataclass(frozen=True, slots=True)
class BindingNeedsDisambiguation:
    """Deterministic tiers narrowed the field but couldn't reach one candidate, and
    the remaining pool is small enough that an LLM disambiguation call is worth
    making (`CLAUDE.md`'s one allowed AI use in this module). The caller (application
    layer) decides whether to actually make that call; this is a data result, not a
    trigger."""

    candidates: tuple[BindingCandidate, ...]


@dataclass(frozen=True, slots=True)
class BindingUnresolved:
    reason: BindingUnresolvedReason
    candidates: tuple[BindingCandidate, ...] = field(default_factory=tuple)


BindingResolution = BindingResolved | BindingNeedsDisambiguation | BindingUnresolved


def _tiers(
    policy: BindingPolicy,
) -> tuple[tuple[BindingMethod, Callable[[BindingCandidate], bool]], ...]:
    return (
        (BindingMethod.EXACT_MPN, lambda c: c.exact_mpn_hit),
        (BindingMethod.NORMALIZED_MPN, lambda c: c.normalized_mpn_hit),
        (BindingMethod.SUPPLIER_MATCH, lambda c: c.supplier_match),
        (BindingMethod.CLASS_MATCH, lambda c: c.class_match),
        (
            BindingMethod.TEXT_OVERLAP,
            lambda c: c.text_overlap_score >= policy.text_overlap_threshold,
        ),
    )


def resolve_document_binding(
    candidates: tuple[BindingCandidate, ...], policy: BindingPolicy
) -> BindingResolution:
    """The cascade. At each tier, compute the subset of the **current pool** the
    tier's predicate matches: exactly one -> resolved at that tier; zero -> this
    tier had nothing to add, try the next; more than one -> narrow the pool to that
    subset and keep going. Never picks arbitrarily among ties (`M2 brief §9`: "Do not
    allow a low-confidence match to become an asserted binding automatically" and
    "never resolved arbitrarily" is this codebase's standing rule, per UH2's
    `resolve_manufacturer_brand`)."""
    if not candidates:
        return BindingUnresolved(reason=BindingUnresolvedReason.NO_CANDIDATES)

    pool = candidates
    for method, predicate in _tiers(policy):
        matched = tuple(c for c in pool if predicate(c))
        if len(matched) == 1:
            return BindingResolved(
                ScoredBindingCandidate(
                    candidate=matched[0], method=method, confidence=policy.confidence_for(method)
                )
            )
        if len(matched) > 1:
            pool = matched

    if len(pool) <= policy.max_llm_disambiguation_pool:
        return BindingNeedsDisambiguation(candidates=pool)
    return BindingUnresolved(reason=BindingUnresolvedReason.AMBIGUOUS_CANDIDATES, candidates=pool)


# ---- Row-level binding (M2 brief §10) -----------------------------------------------


@dataclass(frozen=True, slots=True)
class RowCandidate:
    region_id: str
    catalog_no_exact_hit: bool
    mpn_variant_hit: bool

    def __post_init__(self) -> None:
        if not self.region_id:
            raise InvariantViolation("RowCandidate.region_id must be non-empty")


@dataclass(frozen=True, slots=True)
class RowBindingResolved:
    region_id: str


@dataclass(frozen=True, slots=True)
class RowBindingUnresolved:
    """No single row could be identified — the binding stays document-level only
    (`DocumentBinding.region_id = None`), never a guessed row."""

    candidate_count: int


RowBindingResolution = RowBindingResolved | RowBindingUnresolved


def resolve_row_binding(rows: tuple[RowCandidate, ...]) -> RowBindingResolution:
    """Same narrowing shape as `resolve_document_binding`, one level down: within an
    already-bound document, find the exact table row a record's data corresponds to
    (`docs/10-roadmap.md` M2's "money shot" — row 14 of a 40-row table, highlighted).
    """
    if not rows:
        return RowBindingUnresolved(candidate_count=0)
    pool = rows
    row_predicates: tuple[Callable[[RowCandidate], bool], ...] = (
        lambda r: r.catalog_no_exact_hit,
        lambda r: r.mpn_variant_hit,
    )
    for predicate in row_predicates:
        matched = tuple(r for r in pool if predicate(r))
        if len(matched) == 1:
            return RowBindingResolved(region_id=matched[0].region_id)
        if len(matched) > 1:
            pool = matched
    return RowBindingUnresolved(candidate_count=len(pool))


# ---- Conflict detection (M2 brief §9) -----------------------------------------------


def detect_binding_conflict(
    bindings: tuple[DocumentBinding, ...], document_id_of: Mapping[str, str]
) -> bool:
    """True when a record is bound to more than one *version* of the same logical
    document (`document_id`) — e.g. a 2023 and a 2025 revision of the same spec
    sheet stating different ratings, the exact `conflicting_sources` scenario
    `docs/04-data-model.md` §5's versioning table and the frontend's
    `RecordStatus.CONFLICTING_SOURCES` both already model. `document_id_of` maps
    `document_version_id -> document_id` (a lookup the binding itself doesn't carry,
    since one version can bind many records)."""
    versions_by_document: dict[str, set[str]] = {}
    for binding in bindings:
        document_id = document_id_of.get(binding.document_version_id)
        if document_id is None:
            continue
        versions_by_document.setdefault(document_id, set()).add(binding.document_version_id)
    return any(len(versions) > 1 for versions in versions_by_document.values())
