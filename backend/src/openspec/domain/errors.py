"""Domain error taxonomy (docs/05-backend.md §8, docs/02-architecture.md §10).

Three classes, three behaviours, no exceptions to this:

- `DomainAbstention` — expected. The pipeline chose ``Unknown`` over a guess. Not a
  failure; callers persist it and move on.
- `TransientError` — infrastructure hiccup. Callers retry with backoff, then degrade
  to ``Unknown(SYSTEM_ERROR)`` on exhaustion.
- `InvariantViolation` — a contract was breached (fabricated evidence, an illegal
  state transition, an upgraded provenance kind). Never caught outside the top-level
  worker/API boundary; it fails loudly.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base class. Never raised directly — raise one of the three below."""


class DomainAbstention(DomainError):
    """The domain chose not to assert a value. Carries the reason code that will
    become ``AttributeValue.unknown_reason`` (INV-4)."""

    def __init__(self, reason_code: str, detail: str | None = None) -> None:
        self.reason_code = reason_code
        self.detail = detail
        super().__init__(f"{reason_code}: {detail}" if detail else reason_code)


class TransientError(DomainError):
    """A retryable infrastructure failure (LLM 429, network timeout, blob hiccup)."""


class InvariantViolation(DomainError):
    """A structural guarantee was about to be broken. Must never be swallowed."""
