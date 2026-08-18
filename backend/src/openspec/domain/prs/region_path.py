"""Stable structural region addressing (`docs/04-data-model.md` §3.3: `document_region.path`,
e.g. `table:4/row:14/cell:3`). Pure string construction/parsing — no coordinate
semantics live here, only the path grammar the whole codebase agrees on:
`Evidence.DocumentSpan.region_id`, the frontend's region tree, and
`domain/model/document.py`'s `DocumentRegion.path` all use exactly this format.

Grammar: `segment ("/" segment)*`, each segment `kind ":" index` where `kind` is a
`RegionType` value and `index` is a positive integer. `page` is the only kind that
may appear alone (it is the tree root and is not itself nested under a page segment
— the page number lives on `DocumentRegion.page`, not in the path).
"""

from __future__ import annotations

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.document import RegionType

_SEGMENT_ORDER: dict[RegionType, int] = {
    RegionType.TABLE: 0,
    RegionType.ROW: 1,
    RegionType.CELL: 2,
    RegionType.BLOCK: 0,
}


def build_region_path(*segments: tuple[RegionType, int]) -> str:
    """`build_region_path((RegionType.TABLE, 1), (RegionType.ROW, 14))` ->
    `"table:1/row:14"`. Raises if segments are empty, an index is non-positive, or a
    kind's nesting order doesn't strictly increase (a `cell` cannot appear before its
    `row`, mirroring the tree the region actually lives in)."""
    if not segments:
        raise InvariantViolation("build_region_path requires at least one segment")
    prev_order = -1
    parts: list[str] = []
    for kind, index in segments:
        if index < 1:
            raise InvariantViolation(f"region path index must be >= 1, got {index}")
        order = _SEGMENT_ORDER.get(kind)
        if order is None:
            raise InvariantViolation(f"region kind {kind.value!r} cannot appear in a nested path")
        if order <= prev_order:
            raise InvariantViolation(
                f"region path segments must nest table -> row -> cell, got {kind.value} "
                f"after a segment of equal/greater depth"
            )
        prev_order = order
        parts.append(f"{kind.value}:{index}")
    return "/".join(parts)


def parse_region_path(path: str) -> tuple[tuple[RegionType, int], ...]:
    """Inverse of `build_region_path`. Raises `InvariantViolation` on any segment
    that isn't `kind:index` with a known `RegionType` and a positive integer index —
    a malformed path must never resolve to a silently-wrong region."""
    if not path:
        raise InvariantViolation("region path must be non-empty")
    segments: list[tuple[RegionType, int]] = []
    for raw in path.split("/"):
        kind_str, _, index_str = raw.partition(":")
        try:
            kind = RegionType(kind_str)
        except ValueError as exc:
            raise InvariantViolation(f"unknown region kind in path segment {raw!r}") from exc
        if not index_str.isdigit() or int(index_str) < 1:
            raise InvariantViolation(f"region path index must be a positive integer: {raw!r}")
        segments.append((kind, int(index_str)))
    return tuple(segments)


def parent_path(path: str) -> str | None:
    """`"table:1/row:14/cell:3"` -> `"table:1/row:14"`; the top-level segment's
    parent is `None` (its parent is the page itself, which has no path segment)."""
    segments = parse_region_path(path)
    if len(segments) <= 1:
        return None
    return build_region_path(*segments[:-1])
