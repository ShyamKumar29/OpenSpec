"""Document / page / region / binding value objects (M2, `docs/10-roadmap.md` — PRS +
DOC). Mirrors `frontend/lib/contracts/document.ts` field-for-field, the same
discipline `domain/model/attribute.py` already follows for `AttributeValue` against
`frontend/lib/contracts/attribute-value.ts` — the wire vocabulary (including which
enums are `lower_snake` vs `UPPER_SNAKE`) is copied from the frontend contract that
already shipped, not invented here.

**Distinct from `domain/model/states.py`'s `PipelineState`.** `PipelineState.PARSED` /
`.UNPARSEABLE` describe *a record's* progress through the pipeline; `ParseStatus`
here describes *a document version's* own parse lifecycle, shown in the `/documents`
corpus browser independent of which records reference it. A document version can be
`parsed` while a given record is still `DOC_BOUND` (about to be parsed) or `NO_DOCUMENT`
(never referenced it at all) — one document, many records, independent record-side
states.

**`DocumentBinding.status` is structural, mirroring `AttributeValueAsserted`'s INV-9
guard (`domain/model/attribute.py`).** The M2 brief is explicit: "Do not allow a
low-confidence match to become an asserted binding automatically." Rather than trust
every call site to check that, `__post_init__` refuses to construct an `ACCEPTED`
binding whose `method` is not one of the two deterministic high-precision tiers (or a
human attach) — the same "fabrication is unrepresentable" shape INV-1/INV-9 already
use elsewhere in this codebase.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from openspec.domain.errors import InvariantViolation

# ---- Enums — wire vocabulary copied verbatim from frontend/lib/contracts/document.ts ----


class ParseStatus(StrEnum):
    """A document *version's* own parse lifecycle (`docs/api.md` §Documents,
    `frontend/lib/contracts/document.ts` `PARSE_STATUSES`). `lower_snake` on the wire,
    unlike `AttributeValueStatus` — copied from the shipped frontend contract, not a
    new convention invented here."""

    PENDING = "pending"
    PARSED = "parsed"
    UNPARSEABLE = "unparseable"
    OCR_FALLBACK = "ocr_fallback"


class DocType(StrEnum):
    SPEC_SHEET = "spec_sheet"
    FAMILY_CATALOG = "family_catalog"
    SUBMITTAL = "submittal"
    FULL_CATALOG = "full_catalog"
    OM_MANUAL = "om_manual"


class RegionType(StrEnum):
    """The region tree's node kinds (`docs/04-data-model.md` §3.3 `document_region`,
    M2 brief §5). `page` is the tree root; `table` groups `row`s; `row` groups `cell`s;
    `block` is a non-tabular text region (a paragraph/heading span). No `line`/`span`
    level is modelled — `docs/api.md`'s own `REGION_TYPES` (the authoritative wire
    vocabulary this mirrors) stops at these five, and inventing a finer level the API
    contract doesn't define would be exactly the un-anchored architecture decision the
    M2 brief's §5 warns against ("use the exact terminology defined in the docs")."""

    PAGE = "page"
    TABLE = "table"
    ROW = "row"
    CELL = "cell"
    BLOCK = "block"


class BindingMethod(StrEnum):
    """The DOC retrieval hierarchy's tiers, in the order `docs/10-roadmap.md` M2 names
    them: "exact -> normalised -> supplier -> class -> overlap -> LLM disambiguation".
    `HUMAN` is the manual-attach path (`POST /records/{id}/bindings`), not a tier the
    automatic resolver ever assigns itself."""

    EXACT_MPN = "EXACT_MPN"
    NORMALIZED_MPN = "NORMALIZED_MPN"
    SUPPLIER_MATCH = "SUPPLIER_MATCH"
    CLASS_MATCH = "CLASS_MATCH"
    TEXT_OVERLAP = "TEXT_OVERLAP"
    LLM_DISAMBIGUATION = "LLM_DISAMBIGUATION"
    HUMAN = "HUMAN"


# Deterministic, high-precision enough to auto-accept a binding with no human review —
# mirrors INV-9's Tier-0 gate but for binding confidence rather than attribute risk.
_AUTO_ACCEPT_METHODS = frozenset(
    {BindingMethod.EXACT_MPN, BindingMethod.NORMALIZED_MPN, BindingMethod.HUMAN}
)


class BindingStatus(StrEnum):
    ACCEPTED = "ACCEPTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    REJECTED = "REJECTED"


# ---- Value objects ----------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DocumentPage:
    """One rendered page's geometry (`docs/api.md` §Documents `pages[]`). `dpi` is
    fixed per document version (ADR-0012) — the rasteriser, the parser's bbox space,
    and the frontend's `bboxToNormalizedRect` all agree on this one pixel space by
    construction."""

    n: int
    width_px: int
    height_px: int
    dpi: int

    def __post_init__(self) -> None:
        if self.n < 1:
            raise InvariantViolation("DocumentPage.n must be >= 1")
        if self.width_px <= 0 or self.height_px <= 0:
            raise InvariantViolation("DocumentPage dimensions must be positive")
        if self.dpi <= 0:
            raise InvariantViolation("DocumentPage.dpi must be positive")


@dataclass(frozen=True, slots=True)
class DocumentRegion:
    """One node of the region tree (`docs/04-data-model.md` §3.3). `path` is the
    stable structural address (`table:1/row:14/cell:3`, built by
    `domain/prs/region_path.py`) that `Evidence.DocumentSpan.region_id` and the
    frontend's highlight overlay both key off. `bbox` is `(x0, y0, x1, y1)` in the
    same fixed-DPI pixel space as the rendered page image (ADR-0012) — the frontend's
    `isValidBbox` requires `x1 > x0 and y1 > y0`; enforced here at construction too so
    an invalid rectangle can never reach the wire in the first place."""

    id: str
    region_type: RegionType
    page: int
    bbox: tuple[float, float, float, float]
    path: str
    text: str | None
    parent_region_id: str | None

    def __post_init__(self) -> None:
        if not self.id:
            raise InvariantViolation("DocumentRegion.id must be non-empty")
        if self.page < 1:
            raise InvariantViolation("DocumentRegion.page must be >= 1")
        if not self.path:
            raise InvariantViolation("DocumentRegion.path must be non-empty")
        x0, y0, x1, y1 = self.bbox
        if not (x1 > x0 and y1 > y0):
            raise InvariantViolation(f"DocumentRegion.bbox must have x1>x0 and y1>y0: {self.bbox}")


@dataclass(frozen=True, slots=True)
class Document:
    """The logical document (`docs/04-data-model.md` §3.3 `document` table) — a
    publisher/title identity that may have several `DocumentVersion`s over time
    (a spec sheet gets revised)."""

    id: str
    tenant_id: str
    publisher: str
    title: str
    source_url: str | None
    doc_type: DocType
    first_seen_at: str

    def __post_init__(self) -> None:
        if not self.id:
            raise InvariantViolation("Document.id must be non-empty")
        if not self.publisher:
            raise InvariantViolation("Document.publisher must be non-empty")
        if not self.title:
            raise InvariantViolation("Document.title must be non-empty")


@dataclass(frozen=True, slots=True)
class DocumentVersion:
    """Content-addressed (`docs/04-data-model.md` §3.3: "identity = content hash").
    `parse_status` is denormalised here for the corpus-browser list query
    (`GET /documents`) rather than requiring a join to the latest `ParseArtifact`
    on every list read."""

    id: str
    document_id: str
    content_hash: str
    blob_key: str
    page_count: int
    fetched_at: str
    effective_date: str | None
    parse_status: ParseStatus
    pages: tuple[DocumentPage, ...]

    def __post_init__(self) -> None:
        if not self.id:
            raise InvariantViolation("DocumentVersion.id must be non-empty")
        if not self.content_hash:
            raise InvariantViolation("DocumentVersion.content_hash must be non-empty")
        if self.page_count < 0:
            raise InvariantViolation("DocumentVersion.page_count must be >= 0")
        if self.parse_status is ParseStatus.PARSED and len(self.pages) != self.page_count:
            raise InvariantViolation(
                "DocumentVersion.pages must have one entry per page_count once parsed"
            )


@dataclass(frozen=True, slots=True)
class ParseArtifact:
    """One parser run's output (`docs/04-data-model.md` §3.3 `parse_artifact`).
    **Cache key = `(document_version.content_hash, parser_version)`** — same bytes,
    same parser version, same artifact; a parser upgrade produces a new artifact
    without invalidating evidence that cites the old one's regions (they keep their
    own ids)."""

    id: str
    document_version_id: str
    parser_name: str
    parser_version: str
    parse_quality: float | None
    has_text_layer: bool
    used_ocr: bool
    regions: tuple[DocumentRegion, ...]

    def __post_init__(self) -> None:
        if not self.parser_name or not self.parser_version:
            raise InvariantViolation("ParseArtifact.parser_name/parser_version must be non-empty")
        if self.parse_quality is not None and not (0.0 <= self.parse_quality <= 1.0):
            raise InvariantViolation(f"parse_quality out of range [0,1]: {self.parse_quality}")


@dataclass(frozen=True, slots=True)
class DocumentBinding:
    """Record <-> document(-version)(-region) link (`docs/04-data-model.md` §3.3
    `document_binding`). `signals` stores the full retrieval-hierarchy breakdown
    (`docs/api.md` §Records `bindings[].signals`) so the binding is explainable, not
    just scored."""

    id: str
    record_id: str
    document_version_id: str
    region_id: str | None
    confidence: float
    signals: dict[str, object]
    method: BindingMethod
    status: BindingStatus = field(default=BindingStatus.NEEDS_REVIEW)
    created_by_kind: str = "system"
    created_at: str = ""

    def __post_init__(self) -> None:
        if not self.record_id or not self.document_version_id:
            raise InvariantViolation(
                "DocumentBinding.record_id/document_version_id must be non-empty"
            )
        if not (0.0 <= self.confidence <= 1.0):
            raise InvariantViolation(
                f"DocumentBinding.confidence out of range [0,1]: {self.confidence}"
            )
        if self.status is BindingStatus.ACCEPTED and self.method not in _AUTO_ACCEPT_METHODS:
            raise InvariantViolation(
                f"DocumentBinding cannot be ACCEPTED via method {self.method.value}: "
                "only EXACT_MPN, NORMALIZED_MPN, or HUMAN clear the auto-accept bar "
                "(M2 brief: 'do not allow a low-confidence match to become an asserted "
                "binding automatically')"
            )
