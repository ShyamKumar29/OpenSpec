"""Exact fraction parsing (`NRM`, docs/domain/pvf-reference.md §4, CLAUDE.md
domain traps: "Fractions: `1-1/4`, `1¼`, `1 1/4`, `1.25` are the same value.
Parse to exact `Fraction`, never float."). Pure, INV-6: no I/O, no clock, no
randomness — `fractions` and `re` are both stdlib and both allowed in
`domain/nrm` (`tests/architecture/test_layering.py`).

This is the general parsing algorithm the docs specify directly; it does not
depend on `Decimal_Fraction.xlsx` (a UniHack-supplied lookup table this
environment does not have — `infrastructure/reference_data/missing_datasets.py`)
because the rule itself — how to read a fraction string — is documented
project knowledge, not client-proprietary data.
"""

from __future__ import annotations

import re
from fractions import Fraction

from openspec.domain.errors import DomainAbstention
from openspec.domain.model.attribute import UnknownReason

# Common vulgar-fraction Unicode code points actually seen on manufacturer
# spec sheets and part descriptions (¼ ½ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ ...).
_UNICODE_FRACTIONS: dict[str, Fraction] = {
    "¼": Fraction(1, 4),
    "½": Fraction(1, 2),
    "¾": Fraction(3, 4),
    "⅓": Fraction(1, 3),
    "⅔": Fraction(2, 3),
    "⅕": Fraction(1, 5),
    "⅖": Fraction(2, 5),
    "⅗": Fraction(3, 5),
    "⅘": Fraction(4, 5),
    "⅙": Fraction(1, 6),
    "⅚": Fraction(5, 6),
    "⅛": Fraction(1, 8),
    "⅜": Fraction(3, 8),
    "⅝": Fraction(5, 8),
    "⅞": Fraction(7, 8),
}

# `1-1/4` or `1 1/4` — a whole number, a separator (hyphen or whitespace), a
# simple fraction.
_MIXED_RE = re.compile(r"^(?P<whole>\d+)\s*[-\s]\s*(?P<num>\d+)/(?P<den>\d+)$")
# `1/4` — a bare simple fraction, no whole part.
_SIMPLE_FRACTION_RE = re.compile(r"^(?P<num>\d+)/(?P<den>\d+)$")
# `1.25` or `2` — plain decimal, handed to `Fraction(str)` directly (exact,
# no float round-trip: `Fraction("1.25") == Fraction(5, 4)`).
_DECIMAL_RE = re.compile(r"^\d+(\.\d+)?$")
# `1¼` or `1 ¼` or bare `¼` — an optional whole part plus one Unicode vulgar
# fraction character.
_UNICODE_TRAILING_RE = re.compile(r"^(?P<whole>\d*)\s*(?P<frac_char>[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$")


def parse_fraction(raw: str) -> Fraction:
    """Parses any of the documented equivalent forms to the same exact
    `Fraction`. Raises `DomainAbstention(NORMALIZATION_FAILED)` for anything
    unrecognised — the caller persists `Unknown`, never a guessed magnitude
    (INV-4)."""
    working = raw.strip()
    if not working:
        raise DomainAbstention(UnknownReason.NORMALIZATION_FAILED.value, "empty fraction string")

    unicode_match = _UNICODE_TRAILING_RE.match(working)
    if unicode_match:
        whole_part = int(unicode_match.group("whole")) if unicode_match.group("whole") else 0
        return Fraction(whole_part) + _UNICODE_FRACTIONS[unicode_match.group("frac_char")]

    mixed_match = _MIXED_RE.match(working)
    if mixed_match:
        return _build_fraction(
            raw,
            whole=int(mixed_match.group("whole")),
            num=int(mixed_match.group("num")),
            den=int(mixed_match.group("den")),
        )

    simple_match = _SIMPLE_FRACTION_RE.match(working)
    if simple_match:
        return _build_fraction(
            raw, whole=0, num=int(simple_match.group("num")), den=int(simple_match.group("den"))
        )

    if _DECIMAL_RE.match(working):
        return Fraction(working)

    raise DomainAbstention(
        UnknownReason.NORMALIZATION_FAILED.value, f"unrecognised fraction format: {raw!r}"
    )


def _build_fraction(raw: str, *, whole: int, num: int, den: int) -> Fraction:
    if den == 0:
        raise DomainAbstention(
            UnknownReason.NORMALIZATION_FAILED.value, f"zero denominator in {raw!r}"
        )
    return Fraction(whole) + Fraction(num, den)


def render_mixed_fraction(value: Fraction) -> str:
    """The canonical display form for a parsed fraction — `Fraction(5, 4)` ->
    `"1-1/4"`, `Fraction(1, 4)` -> `"1/4"`, `Fraction(2, 1)` -> `"2"`. Display
    form is kept separate from the parsed value per the documented rule
    ("Display form preserved separately") — this never reconstructs the
    caller's original raw string, only a normalised canonical rendering."""
    whole = value.numerator // value.denominator
    remainder = value - whole
    if remainder == 0:
        return str(whole)
    if whole == 0:
        return f"{remainder.numerator}/{remainder.denominator}"
    return f"{whole}-{remainder.numerator}/{remainder.denominator}"
