"""INV-9 tier routing (`CNF`, UH6 — docs/16-unilog-alignment.md UH6).
Decides `ACCEPT` / `NEEDS_REVIEW` / `NEEDS_APPROVAL` from a calibrated
confidence and an attribute's `risk_tier`. **Tier 0 never reaches `ACCEPT`
here** — the same guarantee `AttributeValueAsserted.__post_init__`
(`domain/model/attribute.py`) enforces structurally at construction time;
this function is the routing-decision mirror of it, checked *before* a
status is even chosen, not just rejected after the fact.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation


class RoutingDecision(StrEnum):
    ACCEPT = "ACCEPT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"


@dataclass(frozen=True, slots=True)
class RoutingPolicy:
    """Thresholds are configuration (CLAUDE.md Conventions table), loaded
    from `resources/policy/cnf_routing.yaml` — see that file's own header for
    why these are placeholder defaults, not a calibrated fit."""

    accept_threshold: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.accept_threshold <= 1.0):
            raise InvariantViolation(
                f"RoutingPolicy.accept_threshold out of range [0,1]: {self.accept_threshold}"
            )


def route(
    *, calibrated_confidence: float, risk_tier: int, policy: RoutingPolicy
) -> RoutingDecision:
    if risk_tier not in (0, 1, 2, 3):
        raise InvariantViolation(f"route: risk_tier must be 0-3, got {risk_tier}")
    if not (0.0 <= calibrated_confidence <= 1.0):
        raise InvariantViolation(
            f"route: calibrated_confidence out of range [0,1]: {calibrated_confidence}"
        )
    if risk_tier == 0:
        # INV-9, structural at the routing decision itself — not merely
        # rejected after the fact by AttributeValueAsserted's constructor.
        return RoutingDecision.NEEDS_APPROVAL
    if calibrated_confidence >= policy.accept_threshold:
        return RoutingDecision.ACCEPT
    return RoutingDecision.NEEDS_REVIEW
