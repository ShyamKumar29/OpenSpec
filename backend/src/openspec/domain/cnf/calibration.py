"""Raw-to-calibrated confidence mapping (`CNF`, UH6 —
docs/16-unilog-alignment.md UH6: "`CNF` composite scoring calibrated on the
combined gold set").

**No gold set exists in this environment** (UH0's still-open gap,
`docs/15-backend-implementation-status.md` §7) — there is nothing to fit a
real calibration curve against. `identity_calibration_curve()` ships as the
honest default (`calibrated == raw`) rather than an invented fit; fitting a
real piecewise curve from `eval_result` outcomes is future work once a gold
set exists, per the module's own "revisit when" note in ADR-0008.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.errors import InvariantViolation


@dataclass(frozen=True, slots=True)
class CalibrationPoint:
    raw: float
    calibrated: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.raw <= 1.0):
            raise InvariantViolation(f"CalibrationPoint.raw out of range [0,1]: {self.raw}")
        if not (0.0 <= self.calibrated <= 1.0):
            raise InvariantViolation(
                f"CalibrationPoint.calibrated out of range [0,1]: {self.calibrated}"
            )


@dataclass(frozen=True, slots=True)
class CalibrationCurve:
    """Piecewise-linear map from raw composite score to calibrated
    probability. `points` must be sorted by `raw`, strictly increasing, and
    span the full `[0, 1]` domain — a curve that doesn't cover the domain
    could be asked to extrapolate, which this module refuses to do."""

    points: tuple[CalibrationPoint, ...]

    def __post_init__(self) -> None:
        if len(self.points) < 2:
            raise InvariantViolation("CalibrationCurve needs at least two points")
        raws = [p.raw for p in self.points]
        if raws != sorted(raws) or len(set(raws)) != len(raws):
            raise InvariantViolation("CalibrationCurve.points must be strictly increasing by raw")
        if raws[0] != 0.0 or raws[-1] != 1.0:
            raise InvariantViolation("CalibrationCurve.points must span [0.0, 1.0]")


def identity_calibration_curve() -> CalibrationCurve:
    """The uncalibrated default — see module docstring."""
    return CalibrationCurve(points=(CalibrationPoint(0.0, 0.0), CalibrationPoint(1.0, 1.0)))


def apply_calibration(raw: float, curve: CalibrationCurve) -> float:
    if not (0.0 <= raw <= 1.0):
        raise InvariantViolation(f"apply_calibration raw out of range [0,1]: {raw}")
    points = curve.points
    for lower, upper in zip(points, points[1:], strict=False):
        if lower.raw <= raw <= upper.raw:
            span = upper.raw - lower.raw
            if span == 0:
                return lower.calibrated
            fraction = (raw - lower.raw) / span
            return lower.calibrated + fraction * (upper.calibrated - lower.calibrated)
    raise InvariantViolation(f"apply_calibration: {raw} not covered by curve")
