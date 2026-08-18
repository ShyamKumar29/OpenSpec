"""Pure `EXT` candidate construction (M3). Each builder here takes source material
that is **already loaded** (no I/O — a document region's parsed text, a supplier
row's cell, a reference table's cell) and either proposes an `ExtractionCandidate`
or abstains with an `ExtractionUnavailable`. There is no third path: a builder never
raises for "nothing to extract" — that is an expected, common outcome (a blank cell,
an unparsed region), not a bug.

**EXT boundary, enforced by what these functions do *not* do**
(`docs/10-roadmap.md` M3 §7): no builder here normalises, silently corrects spelling,
upgrades a match to `ACCEPTED`, or invents a value when the source has none. A
builder's `value_raw` is always either a verbatim quote of the cited evidence
(`VERBATIM_ROW_FIELD`) or the exact, unclamped slice of `region_text` its own
proposed offsets denote (`RULE_BASED`/`LLM_GROUNDED`) — a caller cannot get a
candidate out of this module for a span whose bounds don't check out; it gets
`ExtractionUnavailable` instead. `domain/ext/span_containment.py`'s standalone
`check_*_containment` functions exist for `VER` to re-derive the same judgement
independently later, against its own copy of the source text — see
`build_document_span_candidate`'s docstring.
"""

from __future__ import annotations

from openspec.domain.model.attribute import AttributeRef, DocumentSpan, SourceRowSpan, UnknownReason
from openspec.domain.model.extraction import (
    ExtractionCandidate,
    ExtractionMethod,
    ExtractionResult,
    ExtractionUnavailable,
)


def build_verbatim_row_candidate(
    *,
    id: str,
    attribute: AttributeRef,
    source_dataset: str,
    row_identifier: str,
    source_column: str,
    raw_value: str,
    blank_reason: UnknownReason = UnknownReason.SOURCE_FIELD_BLANK,
) -> ExtractionResult:
    """The general form of UH4's `_extract_verbatim_field` (`application/stages/
    ext.py`), returning a pre-verification candidate rather than jumping straight to
    an asserted value. A blank cell is not a candidate with an empty snippet — it is
    `ExtractionUnavailable`, matching UH4's existing behaviour exactly."""
    if not raw_value.strip():
        return ExtractionUnavailable(
            attribute=attribute,
            reason=blank_reason,
            detail=f"{source_column!r} is blank for {source_dataset} row {row_identifier}",
        )
    evidence = SourceRowSpan(
        source_dataset=source_dataset,
        row_identifier=row_identifier,
        source_column=source_column,
        snippet_text=raw_value,
    )
    return ExtractionCandidate(
        id=id,
        attribute=attribute,
        value_raw=raw_value,
        evidence=(evidence,),
        method=ExtractionMethod.VERBATIM_ROW_FIELD,
        source_confidence=1.0,
        rationale=f"verbatim quote of {source_dataset}:{source_column} row {row_identifier}",
    )


def build_document_span_candidate(
    *,
    id: str,
    attribute: AttributeRef,
    document_version_id: str,
    region_id: str,
    region_text: str,
    page: int,
    bbox: tuple[float, float, float, float],
    char_start: int,
    char_end: int,
    method: ExtractionMethod,
    source_confidence: float,
    rationale: str,
) -> ExtractionResult:
    """Region-scoped, document-grounded extraction (`docs/10-roadmap.md` M3: "Input
    should be constrained to the relevant source material/document region"). Bounds
    are checked before any slicing happens and are never clamped into range -- that
    would silently repair a hallucinated offset into something plausible, exactly
    what `docs/10-roadmap.md` M3 SS3 forbids. A span that fails either check never
    becomes a candidate: it becomes `ExtractionUnavailable` with the failure recorded
    in `detail`. `VER` (`application/usecases/verify_extraction.py`) re-derives and
    re-checks containment independently against its own freshly-supplied
    `region_text` before ever trusting this candidate -- `EXT` and `VER` deliberately
    do not share a single point of failure for this check."""
    if char_start == char_end:
        return ExtractionUnavailable(
            attribute=attribute,
            reason=UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT,
            detail=f"proposed span [{char_start}, {char_end}) in region {region_id} is zero-length",
        )
    if char_start < 0 or char_end > len(region_text):
        return ExtractionUnavailable(
            attribute=attribute,
            reason=UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT,
            detail=(
                f"proposed span [{char_start}, {char_end}) in region {region_id} is "
                f"outside the region's text (length {len(region_text)}) -- refusing to clamp it"
            ),
        )

    snippet_text = region_text[char_start:char_end]
    span = DocumentSpan(
        document_version_id=document_version_id,
        page=page,
        region_id=region_id,
        char_start=char_start,
        char_end=char_end,
        snippet_text=snippet_text,
        bbox=bbox,
    )
    return ExtractionCandidate(
        id=id,
        attribute=attribute,
        value_raw=snippet_text,
        evidence=(span,),
        method=method,
        source_confidence=source_confidence,
        rationale=rationale,
    )
