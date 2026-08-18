"""Tests for `domain/cnf/calibration.py` (UH6)."""

from __future__ import annotations

import pytest

from openspec.domain.cnf.calibration import (
    CalibrationCurve,
    CalibrationPoint,
    apply_calibration,
    identity_calibration_curve,
)
from openspec.domain.errors import InvariantViolation


class TestCalibrationPoint:
    def test_raw_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationPoint(raw=1.5, calibrated=0.5)

    def test_calibrated_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationPoint(raw=0.5, calibrated=-0.1)


class TestCalibrationCurve:
    def test_single_point_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationCurve(points=(CalibrationPoint(0.0, 0.0),))

    def test_must_start_at_zero(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationCurve(points=(CalibrationPoint(0.1, 0.0), CalibrationPoint(1.0, 1.0)))

    def test_must_end_at_one(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationCurve(points=(CalibrationPoint(0.0, 0.0), CalibrationPoint(0.9, 1.0)))

    def test_must_be_strictly_increasing(self) -> None:
        with pytest.raises(InvariantViolation):
            CalibrationCurve(
                points=(
                    CalibrationPoint(0.0, 0.0),
                    CalibrationPoint(0.5, 0.5),
                    CalibrationPoint(0.5, 0.6),
                    CalibrationPoint(1.0, 1.0),
                )
            )


class TestIdentityCalibrationCurve:
    def test_identity_curve_is_a_no_op(self) -> None:
        """No gold set exists to fit a real curve — the default must not
        silently invent one."""
        curve = identity_calibration_curve()
        for raw in (0.0, 0.25, 0.5, 0.75, 1.0):
            assert apply_calibration(raw, curve) == raw


class TestApplyCalibration:
    def test_interpolates_between_points(self) -> None:
        curve = CalibrationCurve(
            points=(
                CalibrationPoint(0.0, 0.0),
                CalibrationPoint(0.5, 0.2),
                CalibrationPoint(1.0, 1.0),
            )
        )
        assert apply_calibration(0.25, curve) == pytest.approx(0.1)

    def test_exact_point_returns_exact_value(self) -> None:
        curve = CalibrationCurve(
            points=(
                CalibrationPoint(0.0, 0.0),
                CalibrationPoint(0.5, 0.2),
                CalibrationPoint(1.0, 1.0),
            )
        )
        assert apply_calibration(0.5, curve) == 0.2

    def test_out_of_range_raw_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            apply_calibration(1.1, identity_calibration_curve())
