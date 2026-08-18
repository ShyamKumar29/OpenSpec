"""Description validation rules (`VAL`-style, UH5 — ADR-0013: "Character-limit
and casing rules... enforced the same way `VAL` enforces attribute rules: a
rule ID, a pass/fail test, no LLM in the check"). Pure pass/fail checks —
this module never rewrites or truncates a built description to force it to
fit; it only reports whether it already does (UH5 brief: tests for
"character limits... deterministic output"). Truncating silently would hide
a real formula defect behind a passing test.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.description import Casing, DescriptionFieldConstraint

# Confirmed field constraints — sourced directly from ADR-0013's own worked
# example (`docs/adr/ADR-0013-templated-description-generation.md`), which in
# turn describes the client brief's `PDSH4816AF` example. Cross-checked
# against the two real example rows in
# `resources/reference/unihack/delivery_format.csv` (`INVOICE_DESC` values
# there are 38/39 chars, all-caps; `MOBILE_DESC` values are 75/64 chars) —
# consistent, not contradicted. Every other Delivery Format description field
# (`SHORT_DESC`, `LONG_DESC1`, `ITEM_FEATURES_n`) has no documented numeric
# limit anywhere in this environment — `UNILOG_INTERNAL_CONTENT_GUIDELINES.docx`
# is one of the still-missing UniHack files
# (`infrastructure/reference_data/missing_datasets.py`) — and is deliberately
# left out of this registry rather than guessed.
CONFIRMED_FIELD_CONSTRAINTS: tuple[DescriptionFieldConstraint, ...] = (
    DescriptionFieldConstraint(
        field_code="INVOICE_DESC", max_length=40, min_length=None, required_casing=Casing.UPPER
    ),
    DescriptionFieldConstraint(
        field_code="MOBILE_DESC", max_length=80, min_length=60, required_casing=None
    ),
)

_BY_FIELD_CODE = {c.field_code: c for c in CONFIRMED_FIELD_CONSTRAINTS}


def constraint_for(field_code: str) -> DescriptionFieldConstraint | None:
    return _BY_FIELD_CODE.get(field_code)


@dataclass(frozen=True, slots=True)
class ValidationResult:
    rule_id: str
    passed: bool
    detail: str


def validate_max_length(text: str, *, max_length: int) -> ValidationResult:
    passed = len(text) <= max_length
    return ValidationResult(
        rule_id="DSC-MAX-LENGTH",
        passed=passed,
        detail=f"length={len(text)}, max={max_length}",
    )


def validate_min_length(text: str, *, min_length: int) -> ValidationResult:
    passed = len(text) >= min_length
    return ValidationResult(
        rule_id="DSC-MIN-LENGTH",
        passed=passed,
        detail=f"length={len(text)}, min={min_length}",
    )


def validate_casing(text: str, *, required: Casing) -> ValidationResult:
    letters = [ch for ch in text if ch.isalpha()]
    if required is Casing.UPPER:
        passed = all(ch.isupper() for ch in letters)
    elif required is Casing.TITLE:
        passed = text == text.title()
    else:
        passed = True
    return ValidationResult(
        rule_id="DSC-CASING", passed=passed, detail=f"required={required.value}"
    )


def validate_non_empty(text: str) -> ValidationResult:
    return ValidationResult(
        rule_id="DSC-NON-EMPTY", passed=bool(text.strip()), detail=f"length={len(text)}"
    )


def run_field_validation(text: str, field_code: str) -> tuple[ValidationResult, ...]:
    """Runs every rule this project has a confirmed constraint for. A field
    with no `CONFIRMED_FIELD_CONSTRAINTS` entry only gets the universal
    non-empty check — not a length/casing check invented for it."""
    results = [validate_non_empty(text)]
    constraint = constraint_for(field_code)
    if constraint is None:
        return tuple(results)
    if constraint.max_length is not None:
        results.append(validate_max_length(text, max_length=constraint.max_length))
    if constraint.min_length is not None:
        results.append(validate_min_length(text, min_length=constraint.min_length))
    if constraint.required_casing is not None:
        results.append(validate_casing(text, required=constraint.required_casing))
    return tuple(results)
