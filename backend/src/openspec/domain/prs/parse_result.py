"""The typed parse outcome (M2 brief §2: "Use typed results. Represent failures
explicitly. Do not silently treat a parse failure as an empty document."). Sealed
union mirroring `AttributeValueAsserted | AttributeValueUnknown`'s established shape
(`domain/model/attribute.py`) and `SchemaResolved | SchemaBlocked`
(`application/usecases/resolve_schema.py`) — this codebase's standing pattern for
"exactly one of two shapes, never a third, never a null in between".
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.model.document import ParseArtifact


class ParseFailureReason(StrEnum):
    """Closed set, mirroring `UnknownReason`'s discipline (`domain/model/attribute.py`)
    — a parse failure always carries a machine-readable reason, never a bare
    exception message a UI would have to guess the meaning of."""

    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"  # not a PDF (or a PDF the parser can't open)
    CORRUPT_FILE = "CORRUPT_FILE"  # bytes claim to be a PDF but the parser can't read them
    NO_TEXT_LAYER_OCR_UNAVAILABLE = "NO_TEXT_LAYER_OCR_UNAVAILABLE"  # scanned doc, OCR port
    # returned OCR_UNAVAILABLE (see application/ports/ocr.py) rather than fabricating text
    EMPTY_DOCUMENT = "EMPTY_DOCUMENT"  # parsed cleanly but has zero pages
    PARSER_ERROR = "PARSER_ERROR"  # the parser raised something else — degraded, not silenced


@dataclass(frozen=True, slots=True)
class ParseSucceeded:
    artifact: ParseArtifact


@dataclass(frozen=True, slots=True)
class ParseFailed:
    reason: ParseFailureReason
    message: str


ParseOutcome = ParseSucceeded | ParseFailed


def is_parsed(outcome: ParseOutcome) -> bool:
    return isinstance(outcome, ParseSucceeded)
