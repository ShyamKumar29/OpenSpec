"""`PressureRating` value object (`NRM`, docs/domain/pvf-reference.md §6 —
"trap #3, the most dangerous"; NRM-17, the non-derivation rule).

**`ANSI Class` may never be derived from a WOG rating, and vice versa** —
they are different rating bases (NRM-17). This module enforces that by
*absence*: there is no `.to_ansi_class()` method on `PressureRating`, and
there cannot be one added later without deleting this sentence and the
architecture accepting the change deliberately. `media` (`WOG`/`WSP`/`CWP`)
is carried in the type so comparing across media is a type-level question,
not a runtime mistake — `compare_same_basis` refuses to compare across media
or unit, returning `None` ("Unknown") rather than a number that would imply
they're comparable.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from fractions import Fraction

from openspec.domain.errors import InvariantViolation


class PressureMedia(StrEnum):
    """Distinct rating bases (§6) — never merged, never converted between."""

    WOG = "WOG"  # Water/Oil/Gas, non-shock, ambient temperature
    WSP = "WSP"  # Working/Saturated Steam Pressure — a harsher basis
    CWP = "CWP"  # Cold Working Pressure — approximately WOG, distinct marking


@dataclass(frozen=True, slots=True)
class PressureRating:
    """`unit` is kept as a plain string (`"psi"`, `"bar"`) rather than a
    canonical unit code — the approved abbreviation table
    (`Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx`) that would
    let this normalise further is one of the still-missing UniHack files
    (`infrastructure/reference_data/missing_datasets.py`). `temperature_qualifier`
    is `None` unless the source stated one; §6's own rule is that plastics
    ratings without a temperature qualifier are incomplete, not that this
    type should silently assume one."""

    magnitude: Fraction
    unit: str
    media: PressureMedia
    temperature_qualifier: Fraction | None = None

    def __post_init__(self) -> None:
        if self.magnitude < 0:
            raise InvariantViolation("PressureRating.magnitude cannot be negative")
        if not self.unit.strip():
            raise InvariantViolation("PressureRating.unit must be non-blank")

    # Deliberately no `.to_ansi_class()`, no `.to_wog()`, no `.to_wsp()` — see
    # module docstring. Do not add one.


def compare_same_basis(a: PressureRating, b: PressureRating) -> int | None:
    """`-1`/`0`/`1` only when `a` and `b` share both `media` and `unit` —
    otherwise `None` ("Unknown"), never a numeric answer that would imply
    `600 WOG` and `Class 150` (or `150 WSP`) are on the same scale."""
    if a.media is not b.media or a.unit != b.unit:
        return None
    if a.magnitude < b.magnitude:
        return -1
    if a.magnitude > b.magnitude:
        return 1
    return 0


def is_rating_complete(rating: PressureRating, *, requires_temperature_qualifier: bool) -> bool:
    """PRS-017 (docs/domain/pvf-reference.md §10): "PVC/CPVC ratings require a
    temperature qualifier". Callers pass `requires_temperature_qualifier`
    based on the record's body material — this function does not know
    material itself (keeps it a single-purpose pure check, not a rules
    engine)."""
    if requires_temperature_qualifier and rating.temperature_qualifier is None:
        return False
    return True
