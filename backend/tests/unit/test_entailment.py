"""Tests for `domain/ver/entailment.py` (UH4)."""

from __future__ import annotations

from openspec.domain.ver.entailment import verify_exact_match, verify_lov_membership


class TestVerifyExactMatch:
    def test_identical_strings_entail(self) -> None:
        v = verify_exact_match(
            value_raw="ACME-123", evidence_snippet="ACME-123", verifier_name="test"
        )
        assert v.verdict == "ENTAILED"
        assert v.deterministic_check == "exact"

    def test_different_strings_do_not_entail(self) -> None:
        v = verify_exact_match(
            value_raw="ACME-123", evidence_snippet="ACME-124", verifier_name="test"
        )
        assert v.verdict == "NOT_ENTAILED"
        assert v.deterministic_check == "fail"

    def test_case_sensitive(self) -> None:
        v = verify_exact_match(value_raw="acme", evidence_snippet="ACME", verifier_name="test")
        assert v.verdict == "NOT_ENTAILED"


class TestVerifyLovMembership:
    def test_member_entails(self) -> None:
        v = verify_lov_membership(
            normalized_value="SOLDER",
            allowed_normalized_values=frozenset({"SOLDER", "NPT_FEMALE"}),
            verifier_name="test",
        )
        assert v.verdict == "ENTAILED"

    def test_non_member_does_not_entail(self) -> None:
        v = verify_lov_membership(
            normalized_value="FLANGED",
            allowed_normalized_values=frozenset({"SOLDER", "NPT_FEMALE"}),
            verifier_name="test",
        )
        assert v.verdict == "NOT_ENTAILED"

    def test_empty_allowed_set_never_entails(self) -> None:
        v = verify_lov_membership(
            normalized_value="SOLDER", allowed_normalized_values=frozenset(), verifier_name="test"
        )
        assert v.verdict == "NOT_ENTAILED"
