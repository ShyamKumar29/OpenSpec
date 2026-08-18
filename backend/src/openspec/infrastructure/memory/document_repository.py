"""`InMemoryDocumentRepository` — the dev/test `DocumentRepository` +
`DocumentIngestRepository` + `BindingRepository` adapter (mirrors
`infrastructure/memory/repositories.py`'s established "fast, free, deterministic
dev/test adapter" role, applied to the document corpus and bindings). **Starts
genuinely empty** — no document corpus is fabricated here (M2 brief: "Do not
fabricate a PDF/document corpus"); it only ever holds what `POST /documents`
actually ingests.

**Detach is soft** (INV-8: no hard deletes anywhere). `detach_binding` never
removes a row from `_bindings`; it marks the id excluded from reads, the same
`deleted_at`-style semantics `docs/04-data-model.md` §5 describes for every
user-facing entity, applied here without a literal `deleted_at` column since this
adapter has no schema to add one to.
"""

from __future__ import annotations

from openspec.application.ports.document_repository import (
    DocumentDetailRef,
    DocumentListFilters,
    DocumentSummaryRef,
    RegionsSummary,
)
from openspec.domain.model.document import (
    Document,
    DocumentBinding,
    DocumentRegion,
    DocumentVersion,
    ParseArtifact,
    RegionType,
)


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._documents: dict[str, Document] = {}
        self._versions: dict[str, DocumentVersion] = {}
        self._artifacts: dict[str, ParseArtifact] = {}
        self._bindings: dict[str, list[DocumentBinding]] = {}
        self._detached_binding_ids: set[str] = set()

    # ---- DocumentIngestRepository (POST /documents) --------------------------

    def find_version_by_content_hash(
        self, *, tenant_id: str, content_hash: str
    ) -> DocumentVersion | None:
        for version in self._versions.values():
            doc = self._documents.get(version.document_id)
            if (
                doc is not None
                and doc.tenant_id == tenant_id
                and version.content_hash == content_hash
            ):
                return version
        return None

    def upsert_document_version(
        self, *, tenant_id: str, document: Document, version: DocumentVersion
    ) -> None:
        self._documents[document.id] = document
        self._versions[version.id] = version

    def save_parse_artifact(
        self, *, tenant_id: str, document_version_id: str, artifact: ParseArtifact
    ) -> None:
        self._artifacts[document_version_id] = artifact

    # ---- DocumentRepository (GET /documents*) --------------------------------

    def _bound_record_count(self, document_version_id: str) -> int:
        return len(
            {
                record_id
                for record_id, bindings in self._bindings.items()
                for b in bindings
                if b.document_version_id == document_version_id
                and b.id not in self._detached_binding_ids
            }
        )

    def _region_counts(self, document_version_id: str) -> RegionsSummary:
        artifact = self._artifacts.get(document_version_id)
        regions = artifact.regions if artifact else ()
        table_count = sum(1 for r in regions if r.region_type is RegionType.TABLE)
        row_count = sum(1 for r in regions if r.region_type is RegionType.ROW)
        return RegionsSummary(table_count=table_count, row_count=row_count)

    def _summary(self, version: DocumentVersion) -> DocumentSummaryRef:
        doc = self._documents[version.document_id]
        return DocumentSummaryRef(
            document_version_id=version.id,
            document_id=doc.id,
            publisher=doc.publisher,
            title=doc.title,
            doc_type=doc.doc_type,
            page_count=version.page_count,
            parse_status=version.parse_status,
            bound_record_count=self._bound_record_count(version.id),
            first_seen_at=doc.first_seen_at,
        )

    def list_summaries(
        self, *, tenant_id: str, cursor: int, limit: int, filters: DocumentListFilters
    ) -> tuple[list[DocumentSummaryRef], int | None]:
        versions = [
            v
            for v in self._versions.values()
            if self._documents[v.document_id].tenant_id == tenant_id
        ]
        summaries = [self._summary(v) for v in versions]
        if filters.publisher is not None:
            summaries = [s for s in summaries if s.publisher == filters.publisher]
        if filters.parse_status is not None:
            summaries = [s for s in summaries if s.parse_status == filters.parse_status]
        if filters.bound_count == "0":
            summaries = [s for s in summaries if s.bound_record_count == 0]
        elif filters.bound_count == "gt0":
            summaries = [s for s in summaries if s.bound_record_count > 0]
        summaries.sort(key=lambda s: (s.first_seen_at, s.document_version_id))  # deterministic
        page = summaries[cursor : cursor + limit]
        next_offset = cursor + limit if cursor + limit < len(summaries) else None
        return page, next_offset

    def get_detail(self, *, tenant_id: str, document_version_id: str) -> DocumentDetailRef | None:
        version = self._versions.get(document_version_id)
        if version is None:
            return None
        doc = self._documents.get(version.document_id)
        if doc is None or doc.tenant_id != tenant_id:
            return None
        artifact = self._artifacts.get(document_version_id)
        return DocumentDetailRef(
            summary=self._summary(version),
            content_hash=version.content_hash,
            source_url=doc.source_url,
            fetched_at=version.fetched_at,
            effective_date=version.effective_date,
            parse_quality=artifact.parse_quality if artifact else None,
            has_text_layer=artifact.has_text_layer if artifact else False,
            used_ocr=artifact.used_ocr if artifact else False,
            pages=version.pages,
            regions_summary=self._region_counts(document_version_id),
        )

    def get_regions(self, *, document_version_id: str) -> tuple[DocumentRegion, ...] | None:
        if document_version_id not in self._versions:
            return None
        artifact = self._artifacts.get(document_version_id)
        return artifact.regions if artifact else ()

    def get_blob_key(self, *, document_version_id: str) -> str | None:
        version = self._versions.get(document_version_id)
        return version.blob_key if version else None

    # ---- BindingRepository (POST/DELETE /records/{id}/bindings) --------------

    def list_bindings(self, *, tenant_id: str, record_id: str) -> tuple[DocumentBinding, ...]:
        return tuple(
            b for b in self._bindings.get(record_id, []) if b.id not in self._detached_binding_ids
        )

    def attach_binding(self, *, tenant_id: str, binding: DocumentBinding) -> None:
        self._bindings.setdefault(binding.record_id, []).append(binding)

    def detach_binding(self, *, tenant_id: str, record_id: str, binding_id: str) -> bool:
        candidates = self._bindings.get(record_id, [])
        match = next(
            (
                b
                for b in candidates
                if b.id == binding_id and b.id not in self._detached_binding_ids
            ),
            None,
        )
        if match is None:
            return False
        self._detached_binding_ids.add(binding_id)
        return True
