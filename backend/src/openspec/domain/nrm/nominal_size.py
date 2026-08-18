"""`NominalSize` value object (`NRM`, docs/domain/pvf-reference.md §4 —
"Size designations, trap #1").

**`NominalSize` has no conversion method to a length.** `1/2` NPS is a
designation, not 0.5 inches of anything — "there is no `.to_mm()` and there
cannot be" (docs/05-backend.md §3.2). NPS and TUBE sizes are never
comparable; NPS<->DN is a lookup table, never arithmetic, and — per OD-4
(`docs/decisions.md`, still open) — this project has not verified a primary
source for that table, so `NPS_DN_EQUIVALENCE` below ships **empty** rather
than populated from unverified general knowledge. Populating it is a
data-only change once a primary source (MSS SP-110, ASME B36.10) has been
cited, not a code change.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from fractions import Fraction

from openspec.domain.errors import InvariantViolation


class SizeStandard(StrEnum):
    NPS = "NPS"
    DN = "DN"
    TUBE = "TUBE"


@dataclass(frozen=True, slots=True)
class NominalSize:
    standard: SizeStandard
    magnitude: Fraction  # NPS: e.g. Fraction(1, 2) for "1/2"; DN: e.g. Fraction(15)
    display: str  # the form actually seen, e.g. "1/2", "DN15" — preserved verbatim

    def __post_init__(self) -> None:
        if self.magnitude <= 0:
            raise InvariantViolation("NominalSize.magnitude must be positive")
        if not self.display.strip():
            raise InvariantViolation("NominalSize.display must be non-blank")

    # Deliberately no `.to_mm()`, `.to_inches()`, or any conversion method —
    # see module docstring. Do not add one.


def compare_nominal_sizes(a: NominalSize, b: NominalSize) -> int | None:
    """`-1`/`0`/`1` only within the same `standard`; `None` ("Unknown") for
    any cross-standard comparison — NPS 1/2 and DN15 are *equivalent* in
    practice but that equivalence is a lookup, not something this function
    infers from magnitude, and NPS vs TUBE are never comparable at all."""
    if a.standard is not b.standard:
        return None
    if a.magnitude < b.magnitude:
        return -1
    if a.magnitude > b.magnitude:
        return 1
    return 0


# NPS -> DN equivalence table. Empty by design — see module docstring (OD-4).
# Keys are NPS magnitudes (as `Fraction`), values are the equivalent DN
# magnitude. A caller with an unpopulated table simply never gets a hit,
# which `nps_to_dn` turns into `None` ("Unknown"), never a guess.
NpsDnEquivalenceTable = dict[Fraction, Fraction]
EMPTY_NPS_DN_EQUIVALENCE: NpsDnEquivalenceTable = {}


def nps_to_dn(nps: NominalSize, table: NpsDnEquivalenceTable) -> Fraction | None:
    if nps.standard is not SizeStandard.NPS:
        raise InvariantViolation("nps_to_dn requires a NominalSize with standard=NPS")
    return table.get(nps.magnitude)
