"""Deterministic entailment checks (`VER`, UH4 — docs/16-unilog-alignment.md
UH4). Two checks, both pure:

- `verify_exact_match` — for source-row-derived values: does the asserted
  `value_raw` literally equal the cited evidence snippet? The strongest
  possible INV-3 entailment (the citation *is* the value), used by `EXT`'s
  verbatim row-field extraction (`application/stages/ext.py`).
- `verify_lov_membership` — for LOV-validated values: is the normalised
  value one of the attribute's approved `Normalized Values`? "This is a
  strictly easier deterministic check than PDF-span entailment: 'is this
  value in the Normalized Values set'" (UH4 brief). Exercised only against
  test fixtures today — no real Fittings/Faucets LOV data exists in this
  environment (UH3 addendum, `docs/15-backend-implementation-status.md` §10).
"""

from __future__ import annotations

from openspec.domain.model.attribute import Verification


def verify_exact_match(
    *, value_raw: str, evidence_snippet: str, verifier_name: str
) -> Verification:
    if value_raw == evidence_snippet:
        return Verification(
            verdict="ENTAILED",
            deterministic_check="exact",
            rationale="asserted value_raw is byte-for-byte identical to the cited evidence snippet",
            verifier_model=verifier_name,
        )
    return Verification(
        verdict="NOT_ENTAILED",
        deterministic_check="fail",
        rationale=(
            f"asserted value_raw {value_raw!r} does not match cited evidence snippet "
            f"{evidence_snippet!r}"
        ),
        verifier_model=verifier_name,
    )


def verify_lov_membership(
    *, normalized_value: str, allowed_normalized_values: frozenset[str], verifier_name: str
) -> Verification:
    if normalized_value in allowed_normalized_values:
        return Verification(
            verdict="ENTAILED",
            deterministic_check="exact",
            rationale=f"{normalized_value!r} is a member of the approved Normalized Values set",
            verifier_model=verifier_name,
        )
    return Verification(
        verdict="NOT_ENTAILED",
        deterministic_check="fail",
        rationale=f"{normalized_value!r} is not a member of the approved Normalized Values set",
        verifier_model=verifier_name,
    )
