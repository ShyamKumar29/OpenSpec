"""Pure normalisation tests for `domain/nrm/manufacturer_brand.py` (`RES`,
UH2 — docs/16-unilog-alignment.md G3, UH2 brief §5/§15). No I/O, no fixtures
from disk — every case here is either lifted verbatim from
`resources/reference/unihack/sample_input.csv` (flagged where it is) or a
worked example the UH2 brief itself gives (`FRIGIDAIRE®` vs `FRIGIDAIRE`)."""

from __future__ import annotations

from openspec.domain.nrm.manufacturer_brand import (
    fuzzy_similarity,
    normalize_manufacturer_brand_name,
)


class TestWhitespaceAndCase:
    def test_strips_surrounding_whitespace(self) -> None:
        result = normalize_manufacturer_brand_name("  Freud  ")
        assert result.normalized == "freud"
        assert "strip_whitespace" in result.transforms

    def test_collapses_internal_whitespace(self) -> None:
        result = normalize_manufacturer_brand_name("Jam   Industrial  Supply")
        assert result.normalized == "jam industrial supply"

    def test_casefold_is_case_insensitive(self) -> None:
        assert (
            normalize_manufacturer_brand_name("FRIGIDAIRE").normalized
            == normalize_manufacturer_brand_name("frigidaire").normalized
            == normalize_manufacturer_brand_name("Frigidaire").normalized
        )


class TestTrademarkSymbols:
    def test_frigidaire_trademark_symbol_stripped(self) -> None:
        """The UH2 brief's own worked example (§5, §11)."""
        with_symbol = normalize_manufacturer_brand_name("FRIGIDAIRE®")
        without_symbol = normalize_manufacturer_brand_name("FRIGIDAIRE")
        assert with_symbol.normalized == without_symbol.normalized == "frigidaire"
        assert "strip_trademark_symbols" in with_symbol.transforms

    def test_registered_trademark_and_copyright_also_stripped(self) -> None:
        assert normalize_manufacturer_brand_name("Acme™").normalized == "acme"
        assert normalize_manufacturer_brand_name("Acme©").normalized == "acme"


class TestLegalSuffixes:
    def test_inc_suffix_folded(self) -> None:
        """`Freud Inc (2435)` — verbatim `Part_Manuf` value from sample_input.csv."""
        result = normalize_manufacturer_brand_name("Freud Inc")
        assert result.normalized == "freud"
        assert "strip_legal_suffix" in result.transforms

    def test_llc_suffix_folded(self) -> None:
        """`Jam Industrial Supply LLC` — verbatim `Part_Manuf` prefix from sample_input.csv."""
        assert normalize_manufacturer_brand_name("Jam Industrial Supply LLC").normalized == (
            "jam industrial supply"
        )

    def test_punctuated_llc_folds_the_same_as_unpunctuated(self) -> None:
        assert (
            normalize_manufacturer_brand_name("Acme L.L.C.").normalized
            == normalize_manufacturer_brand_name("Acme LLC").normalized
        )

    def test_only_trailing_suffix_tokens_are_folded(self) -> None:
        """A suffix-like word in the middle of a name is never touched — folding
        is a trailing-token rule, not a substring strip (UH2 brief §5: don't
        blindly strip meaningful information)."""
        result = normalize_manufacturer_brand_name("Company Products Inc")
        assert result.normalized == "company products"


class TestEmbeddedCode:
    def test_trailing_parenthetical_code_extracted_not_discarded(self) -> None:
        """`Freud Inc (2435)` — verbatim from sample_input.csv `Part_Manuf`."""
        result = normalize_manufacturer_brand_name("Freud Inc (2435)")
        assert result.embedded_code == "2435"
        assert result.normalized == "freud"
        assert result.raw == "Freud Inc (2435)"  # source preservation

    def test_alphanumeric_code_extracted(self) -> None:
        """`Jam Industrial Supply LLC (JAMIN)` — verbatim from sample_input.csv."""
        result = normalize_manufacturer_brand_name("Jam Industrial Supply LLC (JAMIN)")
        assert result.embedded_code == "JAMIN"

    def test_no_trailing_parenthetical_means_no_code(self) -> None:
        result = normalize_manufacturer_brand_name("TREX")
        assert result.embedded_code is None


class TestSourcePreservation:
    def test_raw_is_never_mutated(self) -> None:
        raw = "  FRIGIDAIRE®  "
        result = normalize_manufacturer_brand_name(raw)
        assert result.raw == raw
        assert result.raw != result.normalized


class TestDeterminismAndIdempotency:
    def test_same_input_always_normalizes_the_same(self) -> None:
        a = normalize_manufacturer_brand_name("Freud Inc (2435)")
        b = normalize_manufacturer_brand_name("Freud Inc (2435)")
        assert a == b

    def test_normalizing_an_already_normalized_string_is_a_no_op(self) -> None:
        once = normalize_manufacturer_brand_name("Freud Inc (2435)")
        twice = normalize_manufacturer_brand_name(once.normalized)
        assert twice.normalized == once.normalized
        assert twice.transforms == ()
        assert twice.embedded_code is None


class TestFuzzySimilarity:
    def test_identical_strings_score_1(self) -> None:
        assert fuzzy_similarity("frigidaire", "frigidaire") == 1.0

    def test_completely_different_strings_score_low(self) -> None:
        assert fuzzy_similarity("frigidaire", "rheem manufacturing") < 0.3

    def test_is_deterministic(self) -> None:
        assert fuzzy_similarity("phillips lighting", "philips") == fuzzy_similarity(
            "phillips lighting", "philips"
        )

    def test_is_symmetric(self) -> None:
        a, b = "phillips lighting", "philips"
        assert fuzzy_similarity(a, b) == fuzzy_similarity(b, a)

    def test_near_miss_example_from_real_data(self) -> None:
        """`Phillips Lighting` (Part_Manuf, normalized) vs `Philips` (DIB_Brand) —
        a genuine near-miss found in sample_input.csv rows 432+ (see
        test_manufacturer_brand_stats.py), not a fabricated example. Close but
        not identical: worth a human's attention, not an auto-resolution."""
        score = fuzzy_similarity("phillips lighting", "philips")
        assert 0.5 <= score < 1.0
