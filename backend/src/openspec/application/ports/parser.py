"""`DocumentParser` — the PRS port (`docs/05-backend.md` §1 folder tree names this
`application/ports/parser.py`). Adapters live in `infrastructure/parsing/`
(ADR-0005: `pdfplumber` for text/tables, never PyMuPDF). `application/` depends on
this `Protocol` only, mirroring `LLMProvider`/`BlobStore`'s established shape.
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.prs.parse_result import ParseOutcome


class DocumentParser(Protocol):
    """One parser identity (`parser_name`/`parser_version`) — both are part of the
    parse cache key (`domain/prs/cache_key.py`), so a parser upgrade is a version
    bump here, not an in-place behaviour change under an unchanged key."""

    parser_name: str
    parser_version: str

    def parse(self, *, document_version_id: str, content: bytes) -> ParseOutcome:
        """Never raises for an ordinary bad/unparseable document — that is
        `ParseFailed`, a value, not an exception (M2 brief: "Represent failures
        explicitly. Do not silently treat a parse failure as an empty document.").
        May raise `openspec.domain.errors.TransientError` for a genuine
        infrastructure hiccup a caller should retry."""
        ...
