"""INV-3 span containment (M3, `docs/10-roadmap.md` M3 §3: "An extracted evidence
span must actually exist within the source region from which it claims to have been
extracted... Invalid spans must fail loudly. Never silently repair an invalid
LLM-generated span into something plausible.").

**Distinct from `domain/ver/entailment.py`.** Entailment asks "does the *asserted
value* follow from the cited evidence?" (e.g. is `value_raw` exactly the evidence
snippet). Containment asks a prior, narrower question: "does the cited evidence
*snippet itself* genuinely occur in the source material it claims to be quoting?" A
`DocumentSpan`'s own `__post_init__` (`domain/model/attribute.py`) only checks
internal consistency (`char_start <= char_end`, non-empty `snippet_text`) — it has no
access to the real region text, so it cannot catch a hallucinated offset. This module
is what closes that gap: it is handed the real source text and checks the claimed
span against it.

Every function here is pure and total — it returns a `SpanContainmentResult`, it
never raises for a bad span (a bad span is expected adversarial input, not a bug in
*this* code) and it never tries to adjust/clamp/round a span into validity. The
caller (`VER`, `application/usecases/verify_extraction.py`) is responsible for
turning an invalid result into `Unknown(VERIFICATION_FAILED)` — never a silent
correction.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.model.attribute import DocumentSpan, Evidence, ReferenceTableRow, SourceRowSpan


class SpanContainmentOutcome(StrEnum):
    CONTAINED = "CONTAINED"  # the evidence snippet genuinely occurs at the claimed
    # location (document: exact offset slice; row/reference: exact or substring match)
    EMPTY_SPAN = "EMPTY_SPAN"  # zero-length span (char_start == char_end) — nothing
    # was actually cited, even though the dataclass-level snippet_text is non-empty
    # (e.g. a stale snippet paired with a collapsed range)
    OUT_OF_BOUNDS = "OUT_OF_BOUNDS"  # the claimed offsets fall outside the source
    # text's actual length — a hallucinated or stale offset
    TEXT_MISMATCH = "TEXT_MISMATCH"  # in-bounds, non-empty, but the source text at
    # the claimed location does not equal the snippet — covers boundary drift,
    # partial overlap, and any case where the snippet is not truly a substring of
    # the source it claims to come from


@dataclass(frozen=True, slots=True)
class SpanContainmentResult:
    outcome: SpanContainmentOutcome
    detail: str

    @property
    def is_valid(self) -> bool:
        return self.outcome is SpanContainmentOutcome.CONTAINED


def check_document_span_containment(
    *, region_text: str, span: DocumentSpan
) -> SpanContainmentResult:
    """`region_text` is the actual, independently-loaded text of the
    `DocumentRegion` the span claims to cite (`region_id`) — supplied by the caller,
    never re-derived here (this module does no I/O). Offset semantics: Python string
    slicing, i.e. `region_text[char_start:char_end]`, code-point indexed (not byte
    indexed), so multi-byte/Unicode text (`°`, `¼`, …) behaves consistently as long
    as the offsets were computed against the same string representation — a
    responsibility of whoever produced the span, not checked here."""
    if span.char_start == span.char_end:
        return SpanContainmentResult(
            SpanContainmentOutcome.EMPTY_SPAN,
            f"zero-length span [{span.char_start}, {span.char_end}) cites nothing",
        )
    if span.char_start < 0 or span.char_end > len(region_text):
        return SpanContainmentResult(
            SpanContainmentOutcome.OUT_OF_BOUNDS,
            f"span [{span.char_start}, {span.char_end}) is outside region text of "
            f"length {len(region_text)}",
        )
    actual = region_text[span.char_start : span.char_end]
    if actual != span.snippet_text:
        return SpanContainmentResult(
            SpanContainmentOutcome.TEXT_MISMATCH,
            f"region_text[{span.char_start}:{span.char_end}] = {actual!r}, "
            f"but the evidence claims {span.snippet_text!r}",
        )
    return SpanContainmentResult(
        SpanContainmentOutcome.CONTAINED,
        "region_text at the claimed offsets is byte-for-byte the cited snippet",
    )


def _check_flat_containment(*, source_text: str, snippet_text: str) -> SpanContainmentResult:
    """Shared logic for the two evidence kinds with no offsets of their own
    (`SourceRowSpan`, `ReferenceTableRow`) — the "span" is implicitly the whole cell,
    so containment degrades to: does the cited snippet genuinely appear, verbatim, in
    the actual cell content? Substring (not just equality) is allowed — a citation
    may quote a fragment of a longer cell, e.g. a phrase pulled out of a long
    description — but the fragment must be a real, exact substring, never a
    paraphrase."""
    if not snippet_text:
        return SpanContainmentResult(SpanContainmentOutcome.EMPTY_SPAN, "snippet_text is empty")
    if snippet_text not in source_text:
        return SpanContainmentResult(
            SpanContainmentOutcome.TEXT_MISMATCH,
            f"{snippet_text!r} does not occur in the actual source text {source_text!r}",
        )
    return SpanContainmentResult(
        SpanContainmentOutcome.CONTAINED,
        "snippet_text is a genuine substring of the actual source text",
    )


def check_source_row_span_containment(
    *, actual_cell_text: str, span: SourceRowSpan
) -> SpanContainmentResult:
    """`actual_cell_text` is the real value of `(row_identifier, source_column)` as
    independently loaded from `source_dataset` — never the candidate's own claim
    about it, or this check would be circular and prove nothing."""
    return _check_flat_containment(source_text=actual_cell_text, snippet_text=span.snippet_text)


def check_reference_table_row_containment(
    *, actual_cell_text: str, span: ReferenceTableRow
) -> SpanContainmentResult:
    """Same shape as `check_source_row_span_containment`, for the reference-table
    evidence kind — `actual_cell_text` is the real `(row_key, reference_field)` value
    from `reference_dataset`."""
    return _check_flat_containment(source_text=actual_cell_text, snippet_text=span.snippet_text)


def check_evidence_containment(*, source_text: str, evidence: Evidence) -> SpanContainmentResult:
    """Dispatches on `evidence.kind` so a caller holding a mixed evidence tuple
    (`AttributeValueAsserted.evidence` may carry more than one kind, UH1) can run one
    call per item without a `match` statement of its own. `source_text` is always the
    caller-supplied ground truth for whichever kind is passed — a `DocumentRegion`'s
    `text`, a `SupplierInputRow` cell, or an approved reference table's cell."""
    match evidence:
        case DocumentSpan():
            return check_document_span_containment(region_text=source_text, span=evidence)
        case SourceRowSpan():
            return check_source_row_span_containment(actual_cell_text=source_text, span=evidence)
        case ReferenceTableRow():
            return check_reference_table_row_containment(
                actual_cell_text=source_text, span=evidence
            )
