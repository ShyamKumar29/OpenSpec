"""`infrastructure/cls_policy.py` (`CLS`, M1)."""

from __future__ import annotations

from openspec.infrastructure.cls_policy import (
    DEFAULT_CLASSIFICATION_POLICY_PATH,
    load_classification_policy,
)


def test_real_shipped_policy_loads() -> None:
    policy = load_classification_policy(DEFAULT_CLASSIFICATION_POLICY_PATH)
    assert 0.0 <= policy.rule_min_confidence <= 1.0
    assert 0.0 <= policy.llm_validated_confidence <= 1.0
    assert policy.llm_model
