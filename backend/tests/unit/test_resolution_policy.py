"""`ResolutionPolicy` construction and loading tests (`RES`, UH2 —
docs/16-unilog-alignment.md G3). Thresholds are configuration, never literals
in code (CLAUDE.md Conventions table) — this asserts both the loader reads the
real `resources/policy/manufacturer_brand_resolution.yaml` correctly and the
dataclass rejects an out-of-range threshold regardless of how it was built.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy
from openspec.domain.errors import InvariantViolation
from openspec.infrastructure.resolution_policy import load_resolution_policy


class TestLoadingTheRealPolicyFile:
    def test_loads_all_five_fields_from_the_real_resource(self) -> None:
        policy = load_resolution_policy()
        assert 0.0 <= policy.fuzzy_accept_floor <= 1.0
        assert 0.0 <= policy.fuzzy_ambiguity_delta
        assert policy.exact_confidence >= policy.normalized_exact_confidence
        assert policy.normalized_exact_confidence >= policy.alias_confidence

    def test_missing_file_raises(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError):
            load_resolution_policy(tmp_path / "does_not_exist.yaml")


class TestResolutionPolicyValidation:
    def test_rejects_out_of_range_confidence(self) -> None:
        with pytest.raises(InvariantViolation):
            ResolutionPolicy(
                exact_confidence=1.5,
                normalized_exact_confidence=0.9,
                alias_confidence=0.8,
                fuzzy_accept_floor=0.6,
                fuzzy_ambiguity_delta=0.05,
            )

    def test_rejects_negative_ambiguity_delta(self) -> None:
        with pytest.raises(InvariantViolation):
            ResolutionPolicy(
                exact_confidence=0.99,
                normalized_exact_confidence=0.9,
                alias_confidence=0.8,
                fuzzy_accept_floor=0.6,
                fuzzy_ambiguity_delta=-0.01,
            )
