"""Tests for `infrastructure/attribute_risk_policy.py` (UH3 —
docs/16-unilog-alignment.md UH3). Loads the real shipped
`resources/policy/attribute_risk_tiers.yaml`, matching
`test_resolution_policy.py`'s pattern for the UH2 equivalent.
"""

from __future__ import annotations

from pathlib import Path

from openspec.infrastructure.attribute_risk_policy import load_risk_tier_policy


def test_real_policy_file_loads() -> None:
    policy = load_risk_tier_policy()
    assert policy.default_tier == 1
    assert "pressure" in policy.tier_0_keywords
    assert "temperature" in policy.tier_0_keywords
    assert "class" in policy.tier_0_keywords
    assert "compliance" in policy.tier_0_keywords


def test_keywords_are_lowercased_regardless_of_file_casing(tmp_path: Path) -> None:
    p = tmp_path / "policy.yaml"
    p.write_text(
        "tier_0_keywords: [Pressure, TEMPERATURE]\ndefault_tier: 2\n",
        encoding="utf-8",
    )
    policy = load_risk_tier_policy(p)
    assert policy.tier_0_keywords == frozenset({"pressure", "temperature"})
    assert policy.default_tier == 2
