"""Tests for `infrastructure/cnf_policy.py` (UH6). Loads the real shipped
`resources/policy/cnf_routing.yaml`."""

from __future__ import annotations

from openspec.infrastructure.cnf_policy import load_routing_policy


def test_real_policy_file_loads() -> None:
    policy = load_routing_policy()
    assert policy.accept_threshold == 0.85
