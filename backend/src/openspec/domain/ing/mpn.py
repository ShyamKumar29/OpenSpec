"""MPN canonicalisation (docs/04-data-model.md §3.1: `catalog_record.
mpn_canonical`; CLAUDE.md's "Where AI is allowed" table: "MPN
canonicalisation... [banned from AI] — use code"). Pure, deterministic,
INV-6-safe — no I/O, no clock, no randomness, same discipline as `domain/nrm/`
even though `ING` isn't one of the two folders that module's architecture
test currently enumerates by name.

The convention (uppercase, alphanumeric-only) matches the existing demo
fixture's own precedent (`infrastructure/memory/repositories.py`:
`Mpn(raw="ABC-123", canonical="ABC123")`) rather than inventing a new one —
this makes that fixture's implicit rule explicit and testable.
"""

from __future__ import annotations

from openspec.domain.errors import DomainAbstention


def canonicalize_mpn(raw: str) -> str:
    """Raises `DomainAbstention("MISSING_MPN")` for blank input — canonicalising
    nothing into an empty string would let `Mpn.canonical`'s own non-blank
    invariant (`domain/model/record.py`) catch it one layer too late, with a
    less specific reason code than the caller (ING's row validation) needs."""
    stripped = raw.strip()
    if not stripped:
        raise DomainAbstention("MISSING_MPN", "MPN is blank after stripping whitespace")
    canonical = "".join(c for c in stripped.upper() if c.isalnum())
    if not canonical:
        raise DomainAbstention(
            "MISSING_MPN", f"MPN {raw!r} has no alphanumeric characters to canonicalise"
        )
    return canonical
