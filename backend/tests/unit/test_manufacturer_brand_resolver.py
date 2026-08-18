"""`resolve_manufacturer_brand` pipeline tests (`RES`, UH2 —
docs/16-unilog-alignment.md G3, UH2 brief §15's full checklist: exact,
normalized, placeholder, unknown, ambiguous, vocabulary boundary, evidence,
determinism, source preservation, confidence/threshold, regression).

**The `_FIXTURE_CANDIDATES` below are a small, hand-authored test fixture —
NOT the real `UniCat_Manufacturer_and_Brand_List.xlsx`.** That file does not
exist anywhere in this environment (re-verified at the start of this UH2
session; see `infrastructure/reference_data/manufacturer_brand_list.py`). The
fixture exists only to exercise the resolver's decision tree deterministically
and must never be read as a real resolution result or real UniCat data —
every test that touches it says so again at the point of use.
"""

from __future__ import annotations

from openspec.application.usecases.resolve_manufacturer_brand import (
    MANUFACTURER_NAME_ATTRIBUTE,
    ResolutionPolicy,
    resolve_manufacturer_brand,
)
from openspec.domain.model.attribute import (
    AttributeValueAsserted,
    AttributeValueStatus,
    AttributeValueUnknown,
    ProvenanceKind,
    ReferenceTableRow,
    SourceRowSpan,
    UnknownReason,
)
from openspec.domain.model.manufacturer import ManufacturerBrandCandidate, ManufacturerBrandField
from openspec.infrastructure.reference_data.manufacturer_brand_list import (
    ManufacturerBrandListAdapter,
)

# TEST FIXTURE — see module docstring. Not real UniCat data.
_FIXTURE_CANDIDATES = (
    ManufacturerBrandCandidate(
        reference_dataset="test_fixture_manufacturer_brand_list",
        row_key="1",
        field=ManufacturerBrandField.MANUFACTURER,
        canonical_value="Freud Inc",
        aliases=("Diablo Tools Parent Co",),
    ),
    ManufacturerBrandCandidate(
        reference_dataset="test_fixture_manufacturer_brand_list",
        row_key="2",
        field=ManufacturerBrandField.BRAND,
        canonical_value="Frigidaire",
    ),
    ManufacturerBrandCandidate(
        reference_dataset="test_fixture_manufacturer_brand_list",
        row_key="3",
        field=ManufacturerBrandField.MANUFACTURER,
        canonical_value="Diablo Tools",
    ),
    ManufacturerBrandCandidate(
        reference_dataset="test_fixture_manufacturer_brand_list",
        row_key="4",
        field=ManufacturerBrandField.MANUFACTURER,
        canonical_value="Diablo Brands",
    ),
)

_PLACEHOLDER_TOKENS = frozenset({"-- Unbranded --", "-- No DIB Brand --", "-"})

_DEFAULT_POLICY = ResolutionPolicy(
    exact_confidence=0.99,
    normalized_exact_confidence=0.95,
    alias_confidence=0.90,
    fuzzy_accept_floor=0.60,
    fuzzy_ambiguity_delta=0.05,
)


def _reference() -> ManufacturerBrandListAdapter:
    return ManufacturerBrandListAdapter(_FIXTURE_CANDIDATES)


def _resolve(
    raw_value: str,
    *,
    field: ManufacturerBrandField = ManufacturerBrandField.MANUFACTURER,
    reference: ManufacturerBrandListAdapter | None,
    policy: ResolutionPolicy = _DEFAULT_POLICY,
    row_identifier: str = "row_1",
):
    return resolve_manufacturer_brand(
        id="av_1",
        raw_value=raw_value,
        field=field,
        attribute=MANUFACTURER_NAME_ATTRIBUTE,
        created_at="2026-08-13T00:00:00Z",
        source_dataset="sample_input.csv",
        row_identifier=row_identifier,
        source_column="Part_Manuf",
        reference=reference,
        placeholder_tokens=_PLACEHOLDER_TOKENS,
        policy=policy,
    )


class TestExactMatch:
    def test_byte_identical_raw_resolves_accepted(self) -> None:
        result = _resolve("Freud Inc", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.ACCEPTED
        assert result.value_display == "Freud Inc"
        assert result.confidence == _DEFAULT_POLICY.exact_confidence
        assert result.provenance_kind is ProvenanceKind.DERIVED


class TestNormalizedMatch:
    def test_case_and_trademark_variant_resolves(self) -> None:
        """`FRIGIDAIRE®` vs the approved `Frigidaire` — the UH2 brief's own
        worked example (§5, §11), run through the real pipeline."""
        result = _resolve("FRIGIDAIRE®", field=ManufacturerBrandField.BRAND, reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.ACCEPTED
        assert result.value_display == "Frigidaire"
        assert result.confidence == _DEFAULT_POLICY.normalized_exact_confidence

    def test_legal_suffix_variant_resolves(self) -> None:
        result = _resolve("FREUD INC.", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.value_display == "Freud Inc"


class TestAliasMatch:
    def test_known_alias_resolves_to_canonical_value(self) -> None:
        result = _resolve("Diablo Tools Parent Co", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.ACCEPTED
        assert result.value_display == "Freud Inc"  # canonical, not the alias string
        assert result.confidence == _DEFAULT_POLICY.alias_confidence


class TestFuzzyMatch:
    def test_clear_fuzzy_leader_is_needs_review_never_accepted(self) -> None:
        result = _resolve("Diablo Tool Co", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.NEEDS_REVIEW
        assert result.value_display == "Diablo Tools"
        assert 0.0 < result.confidence < 1.0

    def test_fuzzy_never_reaches_accepted_regardless_of_score(self) -> None:
        # Even a near-perfect fuzzy score must not auto-accept (UH2 brief §4).
        high_floor_policy = ResolutionPolicy(
            exact_confidence=0.99,
            normalized_exact_confidence=0.95,
            alias_confidence=0.90,
            fuzzy_accept_floor=0.01,
            fuzzy_ambiguity_delta=0.0,
        )
        result = _resolve("Diablo Toolz", reference=_reference(), policy=high_floor_policy)
        assert isinstance(result, AttributeValueAsserted)
        assert result.status is AttributeValueStatus.NEEDS_REVIEW


class TestAmbiguous:
    def test_close_fuzzy_scores_are_ambiguous_not_arbitrary(self) -> None:
        """`Diablo Tools` (0.96-ish) vs `Diablo Brands` (0.58-ish) against
        `Diablo Tool Co` — normally a clear leader (see
        TestFuzzyMatch), but with a wide `fuzzy_ambiguity_delta` the resolver
        must refuse to pick one rather than guess (UH2 brief §4/§7/§15)."""
        wide_delta_policy = ResolutionPolicy(
            exact_confidence=0.99,
            normalized_exact_confidence=0.95,
            alias_confidence=0.90,
            fuzzy_accept_floor=0.10,
            fuzzy_ambiguity_delta=0.5,
        )
        result = _resolve("Diablo Tool Co", reference=_reference(), policy=wide_delta_policy)
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.AMBIGUOUS_CANDIDATES

    def test_alias_collision_across_two_distinct_canonical_values_is_ambiguous(self) -> None:
        """Two distinct approved rows sharing one alias string is a
        reference-data defect, not something the resolver may silently pick
        one side of."""
        colliding_candidates = _FIXTURE_CANDIDATES + (
            ManufacturerBrandCandidate(
                reference_dataset="test_fixture_manufacturer_brand_list",
                row_key="5",
                field=ManufacturerBrandField.MANUFACTURER,
                canonical_value="Diablo Power Tools",
                aliases=("Ambiguous Shared Alias",),
            ),
            ManufacturerBrandCandidate(
                reference_dataset="test_fixture_manufacturer_brand_list",
                row_key="6",
                field=ManufacturerBrandField.MANUFACTURER,
                canonical_value="Diablo Outdoor Products",
                aliases=("Ambiguous Shared Alias",),
            ),
        )
        reference = ManufacturerBrandListAdapter(colliding_candidates)
        result = resolve_manufacturer_brand(
            id="av_1",
            raw_value="Ambiguous Shared Alias",
            field=ManufacturerBrandField.MANUFACTURER,
            attribute=MANUFACTURER_NAME_ATTRIBUTE,
            created_at="2026-08-13T00:00:00Z",
            source_dataset="sample_input.csv",
            row_identifier="row_1",
            source_column="Part_Manuf",
            reference=reference,
            placeholder_tokens=_PLACEHOLDER_TOKENS,
            policy=_DEFAULT_POLICY,
        )
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.AMBIGUOUS_CANDIDATES


class TestNoMatch:
    def test_nothing_above_the_fuzzy_floor_is_no_candidate_match(self) -> None:
        result = _resolve("Completely Unrelated Entity Name", reference=_reference())
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.NO_CANDIDATE_MATCH


class TestPlaceholder:
    def test_declared_placeholder_is_no_brand_declared_not_a_failure(self) -> None:
        result = _resolve(
            "-- Unbranded --", field=ManufacturerBrandField.BRAND, reference=_reference()
        )
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.NO_BRAND_DECLARED

    def test_placeholder_checked_before_reference_availability(self) -> None:
        """A declared placeholder is `NO_BRAND_DECLARED` even when there is no
        reference data at all — it never even needs to look (UH2 brief §6's
        distinction: declared absence vs resolver failure)."""
        result = _resolve("-- Unbranded --", field=ManufacturerBrandField.BRAND, reference=None)
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.NO_BRAND_DECLARED


class TestReferenceDataUnavailable:
    def test_no_reference_adapter_is_an_honest_unknown(self) -> None:
        """The real environment's actual state today: no
        `UniCat_Manufacturer_and_Brand_List.xlsx` exists anywhere (see
        `infrastructure/reference_data/manufacturer_brand_list.py`), so every
        non-placeholder raw value in this environment resolves this way."""
        result = _resolve("Freud Inc", reference=None)
        assert isinstance(result, AttributeValueUnknown)
        assert result.unknown_reason is UnknownReason.REFERENCE_DATA_UNAVAILABLE


class TestVocabularyBoundary:
    def test_never_asserts_a_value_absent_from_the_reference(self) -> None:
        """UH2 brief §7: "Resolver must NEVER output a canonical value that is
        absent from the approved reference dataset." Checked positively: every
        asserted `value_display` across every fixture candidate/probe
        combination traces to one of `_FIXTURE_CANDIDATES`."""
        approved_values = {c.canonical_value for c in _FIXTURE_CANDIDATES}
        probes = ["Freud Inc", "Diablo Tool Co", "FREUD INC."]
        for probe in probes:
            result = _resolve(
                probe, field=ManufacturerBrandField.MANUFACTURER, reference=_reference()
            )
            if isinstance(result, AttributeValueAsserted):
                assert result.value_display in approved_values


class TestEvidence:
    def test_asserted_value_always_carries_source_and_reference_evidence(self) -> None:
        result = _resolve("Freud Inc", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        kinds = {type(e) for e in result.evidence}
        assert kinds == {SourceRowSpan, ReferenceTableRow}

    def test_source_evidence_cites_the_verbatim_raw_value(self) -> None:
        result = _resolve("FREUD INC.", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        source_spans = [e for e in result.evidence if isinstance(e, SourceRowSpan)]
        assert len(source_spans) == 1
        assert source_spans[0].snippet_text == "FREUD INC."
        assert source_spans[0].source_column == "Part_Manuf"

    def test_unknown_value_carries_no_evidence(self) -> None:
        """INV-4: `AttributeValueUnknown` has no field that could hold evidence."""
        result = _resolve("Completely Unrelated Entity Name", reference=_reference())
        assert isinstance(result, AttributeValueUnknown)
        assert not hasattr(result, "evidence")


class TestSourcePreservation:
    def test_value_raw_is_the_untouched_original_string(self) -> None:
        result = _resolve("FREUD INC.", reference=_reference())
        assert isinstance(result, AttributeValueAsserted)
        assert result.value_raw == "FREUD INC."


class TestDeterminism:
    def test_same_input_and_reference_always_resolve_the_same(self) -> None:
        first = _resolve("Diablo Tool Co", reference=_reference())
        second = _resolve("Diablo Tool Co", reference=_reference())
        assert first == second
