"""Manufacturer/brand resolution use case (`RES`, UH2 —
docs/16-unilog-alignment.md G3). Orchestrates the deterministic pipeline the
brief specifies: placeholder check → reference-availability check → exact →
normalized-exact → alias → fuzzy → ambiguous/unresolved. Never calls an LLM
(CLAUDE.md's "Where AI is allowed" table bans AI from candidate search) and
never asserts a canonical value absent from the injected
`ManufacturerBrandReference` port (UH2 brief §7's vocabulary-boundary rule —
enforced structurally here: every asserted value's `value_display` is copied
verbatim from a `ManufacturerBrandCandidate` the port itself returned, never
constructed or guessed).
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.manufacturer_brand import ManufacturerBrandReference
from openspec.domain.errors import InvariantViolation
from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValue,
    AttributeValueStatus,
    ProvenanceKind,
    ReferenceTableRow,
    SourceRowSpan,
    UnknownReason,
    Verification,
    attribute_value,
)
from openspec.domain.model.manufacturer import (
    ManufacturerBrandCandidate,
    ManufacturerBrandField,
    ResolutionMethod,
    ScoredCandidate,
)
from openspec.domain.nrm.manufacturer_brand import (
    fuzzy_similarity,
    normalize_manufacturer_brand_name,
)

# Universal attributes — not scoped to a taxonomy class, since every Delivery
# Format row carries both. Names match the actual Delivery Format column
# headers (`MANUFACTURER_NAME`, `BRAND_NAME` — verified against the live
# header in resources/reference/unihack/delivery_format.csv, columns 17/18,
# not assumed). risk_tier=1: neither is one of INV-9's Tier-0 attributes
# (pressure/temperature/class/compliance), so ACCEPTED is reachable for a
# genuinely unambiguous match once real reference data exists.
MANUFACTURER_NAME_ATTRIBUTE = AttributeRef(
    code="MANUFACTURER_NAME",
    name="Manufacturer Name",
    datatype="string",
    risk_tier=1,
    is_mandatory=True,
)
BRAND_NAME_ATTRIBUTE = AttributeRef(
    code="BRAND_NAME",
    name="Brand Name",
    datatype="string",
    risk_tier=1,
    is_mandatory=False,
)


@dataclass(frozen=True, slots=True)
class ResolutionPolicy:
    """Thresholds are configuration, never literals in code (CLAUDE.md
    Conventions table). Loaded from
    `resources/policy/manufacturer_brand_resolution.yaml` by
    `infrastructure/resolution_policy.py`; the shape lives here because it's
    specific to this one use case, not a general domain concept."""

    exact_confidence: float
    normalized_exact_confidence: float
    alias_confidence: float
    fuzzy_accept_floor: float  # minimum similarity to be considered a FUZZY candidate at all
    fuzzy_ambiguity_delta: float  # top-two scores within this of each other => no clear leader

    def __post_init__(self) -> None:
        for name in (
            "exact_confidence",
            "normalized_exact_confidence",
            "alias_confidence",
            "fuzzy_accept_floor",
        ):
            value = getattr(self, name)
            if not (0.0 <= value <= 1.0):
                raise InvariantViolation(f"ResolutionPolicy.{name} out of range [0,1]: {value}")
        if self.fuzzy_ambiguity_delta < 0:
            raise InvariantViolation(
                f"ResolutionPolicy.fuzzy_ambiguity_delta must be >= 0: {self.fuzzy_ambiguity_delta}"
            )


@dataclass(frozen=True, slots=True)
class _TierOutcome:
    """Result of consulting one deterministic tier (EXACT / NORMALIZED_EXACT /
    ALIAS). `ambiguous=True` means more than one *distinct* approved value
    matched at this tier — a reference-data collision routed to review rather
    than picked arbitrarily; `scored=None` with `ambiguous=False` means "no
    hit here, try the next tier"."""

    scored: ScoredCandidate | None
    ambiguous: bool


def _decide_deterministic_tier(
    hits: tuple[ManufacturerBrandCandidate, ...],
    *,
    method: ResolutionMethod,
    confidence: float,
) -> _TierOutcome:
    if not hits:
        return _TierOutcome(scored=None, ambiguous=False)
    distinct_values = {h.canonical_value for h in hits}
    if len(distinct_values) > 1:
        return _TierOutcome(scored=None, ambiguous=True)
    return _TierOutcome(
        scored=ScoredCandidate(candidate=hits[0], method=method, score=confidence),
        ambiguous=False,
    )


def _source_evidence(
    *, source_dataset: str, row_identifier: str, source_column: str, raw_value: str
) -> SourceRowSpan:
    return SourceRowSpan(
        source_dataset=source_dataset,
        row_identifier=row_identifier,
        source_column=source_column,
        snippet_text=raw_value,
    )


def _reference_evidence(candidate: ManufacturerBrandCandidate) -> ReferenceTableRow:
    return ReferenceTableRow(
        reference_dataset=candidate.reference_dataset,
        row_key=candidate.row_key,
        reference_field=candidate.field.value,
        snippet_text=candidate.canonical_value,
    )


def _assert_candidate(
    *,
    id: str,
    attribute: AttributeRef,
    created_at: str,
    scored: ScoredCandidate,
    source_span: SourceRowSpan,
    status: AttributeValueStatus,
) -> AttributeValue:
    is_deterministic = scored.method is not ResolutionMethod.FUZZY
    deterministic_check = {
        ResolutionMethod.EXACT: "exact",
        ResolutionMethod.NORMALIZED_EXACT: "normalised",
        ResolutionMethod.ALIAS: "normalised",
        ResolutionMethod.FUZZY: "fuzzy",
    }[scored.method]
    return attribute_value.extracted(
        id=id,
        attribute=attribute,
        created_at=created_at,
        status=status,
        value_display=scored.candidate.canonical_value,
        value_canonical={"canonical_value": scored.candidate.canonical_value},
        value_raw=source_span.snippet_text,
        # RES always DERIVES — even the EXACT tier is the outcome of applying a
        # matching rule that *selects* an approved candidate, not a verbatim
        # quote of it (INV-5 never ranks that as EXTRACTED).
        provenance_kind=ProvenanceKind.DERIVED,
        confidence=scored.score,
        evidence=(source_span, _reference_evidence(scored.candidate)),
        verification=Verification(
            verdict="ENTAILED" if is_deterministic else "PARTIAL",
            deterministic_check=deterministic_check,
            rationale=(
                f"{scored.method.value} match against {scored.candidate.reference_dataset} "
                f"row {scored.candidate.row_key} (score {scored.score:.3f})"
            ),
            verifier_model="deterministic:manufacturer_brand_resolver",
        ),
    )


def resolve_manufacturer_brand(
    *,
    id: str,
    raw_value: str,
    field: ManufacturerBrandField,
    attribute: AttributeRef,
    created_at: str,
    source_dataset: str,
    row_identifier: str,
    source_column: str,
    reference: ManufacturerBrandReference | None,
    placeholder_tokens: frozenset[str],
    policy: ResolutionPolicy,
) -> AttributeValue:
    """The UH2 pipeline (brief §2/§4), tiers tried in the fixed order below.
    Every branch is deterministic, reached by real code — never an LLM
    decision (CLAUDE.md bans AI from candidate search)."""
    # 1. Placeholder — a declared absence, not a resolver failure (UH2 brief §6).
    if raw_value in placeholder_tokens:
        return attribute_value.unknown(
            id=id,
            attribute=attribute,
            created_at=created_at,
            reason=UnknownReason.NO_BRAND_DECLARED,
        )

    # 2. No approved reference data in this environment — an honest,
    # documented environment gap (see infrastructure/reference_data/
    # missing_datasets.py), not a resolution outcome.
    if reference is None:
        return attribute_value.unknown(
            id=id,
            attribute=attribute,
            created_at=created_at,
            reason=UnknownReason.REFERENCE_DATA_UNAVAILABLE,
        )

    source_span = _source_evidence(
        source_dataset=source_dataset,
        row_identifier=row_identifier,
        source_column=source_column,
        raw_value=raw_value,
    )
    normalized = normalize_manufacturer_brand_name(raw_value)

    tiers = (
        (
            reference.exact_matches(raw_value, field=field),
            ResolutionMethod.EXACT,
            policy.exact_confidence,
        ),
        (
            reference.normalized_exact_matches(normalized.normalized, field=field),
            ResolutionMethod.NORMALIZED_EXACT,
            policy.normalized_exact_confidence,
        ),
        (
            reference.normalized_alias_matches(normalized.normalized, field=field),
            ResolutionMethod.ALIAS,
            policy.alias_confidence,
        ),
    )
    for hits, method, confidence in tiers:
        outcome = _decide_deterministic_tier(hits, method=method, confidence=confidence)
        if outcome.ambiguous:
            return attribute_value.unknown(
                id=id,
                attribute=attribute,
                created_at=created_at,
                reason=UnknownReason.AMBIGUOUS_CANDIDATES,
            )
        if outcome.scored is not None:
            return _assert_candidate(
                id=id,
                attribute=attribute,
                created_at=created_at,
                scored=outcome.scored,
                source_span=source_span,
                status=AttributeValueStatus.ACCEPTED,
            )

    # 6. Fuzzy candidate generation + scoring — never auto-accepted alone
    # (UH2 brief §4): the best possible outcome here is NEEDS_REVIEW.
    scored_fuzzy = sorted(
        (
            ScoredCandidate(
                candidate=c,
                method=ResolutionMethod.FUZZY,
                score=fuzzy_similarity(
                    normalized.normalized,
                    normalize_manufacturer_brand_name(c.canonical_value).normalized,
                ),
            )
            for c in reference.all_candidates(field=field)
        ),
        key=lambda sc: sc.score,
        reverse=True,
    )
    above_floor = [sc for sc in scored_fuzzy if sc.score >= policy.fuzzy_accept_floor]

    if not above_floor:
        return attribute_value.unknown(
            id=id,
            attribute=attribute,
            created_at=created_at,
            reason=UnknownReason.NO_CANDIDATE_MATCH,
        )
    if len(above_floor) >= 2 and (
        above_floor[0].score - above_floor[1].score < policy.fuzzy_ambiguity_delta
    ):
        return attribute_value.unknown(
            id=id,
            attribute=attribute,
            created_at=created_at,
            reason=UnknownReason.AMBIGUOUS_CANDIDATES,
        )

    return _assert_candidate(
        id=id,
        attribute=attribute,
        created_at=created_at,
        scored=above_floor[0],
        source_span=source_span,
        status=AttributeValueStatus.NEEDS_REVIEW,
    )
