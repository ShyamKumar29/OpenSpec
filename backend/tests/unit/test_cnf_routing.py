"""Tests for `domain/cnf/routing.py` (UH6). INV-9's routing-time mirror."""

from __future__ import annotations

import pytest

from openspec.domain.cnf.routing import RoutingDecision, RoutingPolicy, route
from openspec.domain.errors import InvariantViolation

_POLICY = RoutingPolicy(accept_threshold=0.85)


class TestRoutingPolicy:
    def test_threshold_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            RoutingPolicy(accept_threshold=1.5)


class TestRoute:
    def test_tier0_never_accepts_even_at_perfect_confidence(self) -> None:
        """INV-9: pressure/temperature/class/compliance never auto-accept,
        regardless of how confident the pipeline is."""
        decision = route(calibrated_confidence=1.0, risk_tier=0, policy=_POLICY)
        assert decision is RoutingDecision.NEEDS_APPROVAL

    def test_tier1_above_threshold_accepts(self) -> None:
        decision = route(calibrated_confidence=0.9, risk_tier=1, policy=_POLICY)
        assert decision is RoutingDecision.ACCEPT

    def test_tier1_below_threshold_needs_review(self) -> None:
        decision = route(calibrated_confidence=0.5, risk_tier=1, policy=_POLICY)
        assert decision is RoutingDecision.NEEDS_REVIEW

    def test_exactly_at_threshold_accepts(self) -> None:
        decision = route(calibrated_confidence=0.85, risk_tier=2, policy=_POLICY)
        assert decision is RoutingDecision.ACCEPT

    def test_invalid_risk_tier_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            route(calibrated_confidence=0.9, risk_tier=4, policy=_POLICY)

    def test_out_of_range_confidence_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            route(calibrated_confidence=1.5, risk_tier=1, policy=_POLICY)
