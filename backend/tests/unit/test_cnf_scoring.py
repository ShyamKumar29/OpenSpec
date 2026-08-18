"""Tests for `domain/cnf/scoring.py` (UH6)."""

from __future__ import annotations

import pytest

from openspec.domain.cnf.scoring import ConfidenceSignal, composite_raw_score
from openspec.domain.errors import InvariantViolation


class TestConfidenceSignal:
    def test_valid_signal_constructs(self) -> None:
        s = ConfidenceSignal(name="lov_membership", value=0.9, weight=1.0)
        assert s.value == 0.9

    def test_blank_name_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            ConfidenceSignal(name=" ", value=0.5, weight=1.0)

    def test_value_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            ConfidenceSignal(name="x", value=1.5, weight=1.0)

    def test_negative_weight_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            ConfidenceSignal(name="x", value=0.5, weight=-1.0)


class TestCompositeRawScore:
    def test_single_signal_returns_its_value(self) -> None:
        signals = (ConfidenceSignal(name="a", value=0.8, weight=1.0),)
        assert composite_raw_score(signals) == 0.8

    def test_weighted_average_of_two_signals(self) -> None:
        signals = (
            ConfidenceSignal(name="a", value=1.0, weight=1.0),
            ConfidenceSignal(name="b", value=0.0, weight=1.0),
        )
        assert composite_raw_score(signals) == 0.5

    def test_unequal_weights_bias_the_average(self) -> None:
        signals = (
            ConfidenceSignal(name="a", value=1.0, weight=3.0),
            ConfidenceSignal(name="b", value=0.0, weight=1.0),
        )
        assert composite_raw_score(signals) == 0.75

    def test_zero_weight_signal_contributes_nothing(self) -> None:
        signals = (
            ConfidenceSignal(name="a", value=1.0, weight=1.0),
            ConfidenceSignal(name="b", value=0.0, weight=0.0),
        )
        assert composite_raw_score(signals) == 1.0

    def test_empty_signals_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            composite_raw_score(())

    def test_all_zero_weight_rejected(self) -> None:
        signals = (ConfidenceSignal(name="a", value=1.0, weight=0.0),)
        with pytest.raises(InvariantViolation):
            composite_raw_score(signals)

    def test_deterministic(self) -> None:
        signals = (
            ConfidenceSignal(name="a", value=0.7, weight=2.0),
            ConfidenceSignal(name="b", value=0.3, weight=1.0),
        )
        assert composite_raw_score(signals) == composite_raw_score(signals)
