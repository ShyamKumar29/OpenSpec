"""`infrastructure/verification_policy.py` loading the real, shipped
`resources/policy/verification.yaml` (M3)."""

from __future__ import annotations

from openspec.application.usecases.verify_extraction import VerificationPolicy
from openspec.infrastructure.verification_policy import load_verification_policy


def test_real_policy_loads() -> None:
    policy = load_verification_policy()
    assert isinstance(policy, VerificationPolicy)
    assert 0.0 <= policy.llm_entailed_confidence <= 1.0
    assert 0.0 <= policy.llm_partial_confidence <= 1.0
    assert 0.0 <= policy.deterministic_only_confidence <= 1.0
