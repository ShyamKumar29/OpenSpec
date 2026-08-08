/**
 * Documents (docs/api.md §Documents), including the mandatory coverage from
 * docs/14-frontend-implementation-plan.md §4.2: ~18 documents, one unparseable, one
 * with an unresolvable revision conflict. Family-table pages and their region trees are
 * generated together by `buildFamilyTable` (mocks/fixtures/family-table.ts) so bbox and
 * pixel are the same source of truth.
 */
import type { Rng } from "./rng";
import { isoDaysAgo } from "./rng";
import { TAXONOMY } from "./taxonomy";
import { CANONICAL_PUBLISHER, type RecordSkeleton } from "./records";
import {
  buildFamilyTable,
  PAGE_DPI,
  PAGE_HEIGHT_PX,
  PAGE_WIDTH_PX,
  type TableColumn,
} from "./family-table";

const SPEC_COLUMN_BY_CLASS: Record<string, { attrCode: string; header: string }> = {
  BALL_VALVE_BRONZE: { attrCode: "pressure_rating_wog", header: "PRESSURE (WOG)" },
  GATE_GLOBE_CHECK_VALVE: { attrCode: "pressure_rating_wog", header: "PRESSURE (WOG)" },
  PIPE_FITTING_CU_BRS: { attrCode: "pressure_rating_wog", header: "PRESSURE (WOG)" },
  PVC_CPVC_VALVE_FITTING: { attrCode: "pressure_rating_psi_at_73f", header: "PRESSURE @73°F" },
  GAUGE_BACKFLOW: { attrCode: "pressure_range_max", header: "RANGE (PSI)" },
};

const TABLE_COLUMNS: TableColumn[] = [
  { key: "catalog_no", header: "CATALOG NO.", widthFraction: 0.3 },
  { key: "size", header: "SIZE", widthFraction: 0.2 },
  { key: "spec", header: "SPEC", widthFraction: 0.3 },
  { key: "weight", header: "WEIGHT", widthFraction: 0.2 },
];

const FICTIONAL_PUBLISHERS = [
  "Meridian Flow Control",
  "Cascade Brass Works",
  "Northgate PVF Manufacturing",
  "Sterling Valve & Fitting Co.",
  "Highline Industrial Products",
];

export interface DocumentPageOutput {
  documentVersionId: string;
  page: number;
  svg: string;
}

export interface RecordBinding {
  documentVersionId: string;
  regionId: string; // the row region
  page: number;
  confidence: number;
  signals: Record<string, unknown>;
  wogDisplay: string;
  wogValue: number;
  sizeCellBbox: [number, number, number, number];
  specCellBbox: [number, number, number, number];
  rowBbox: [number, number, number, number];
  catalogNo: string;
  /** Set only for the two conflicting-revision bindings on the same record. */
  conflictNote?: string;
}

export interface WrongRowEvidence {
  documentVersionId: string;
  page: number;
  regionId: string;
  bbox: [number, number, number, number];
  snippetText: string;
}

export interface DocumentsResult {
  documents: unknown[]; // DocumentDetailWire[]
  pages: DocumentPageOutput[];
  regionsByDocument: Record<string, unknown[]>; // DocumentRegionWire[]
  bindingsByRecord: Record<string, RecordBinding[]>;
  unparseableDocumentVersionId: string;
  /** The F5 hero task's misattributed span (docs/06-frontend.md §3.3) — the decoy row
   *  directly below ABC-123's bound row, on the canonical Apollo document. */
  wrongRowEvidence: WrongRowEvidence | null;
}

function buildDocumentWire(opts: {
  id: string;
  documentId: string;
  publisher: string;
  title: string;
  docType: string;
  pageCount: number;
  parseStatus: string;
  boundRecordCount: number;
  firstSeenDaysAgo: number;
  fetchedDaysAgo: number;
  effectiveDate: string | null;
  parseQuality: number | null;
  hasTextLayer: boolean;
  usedOcr: boolean;
  tableCount: number;
  rowCount: number;
}) {
  return {
    document_version_id: opts.id,
    document_id: opts.documentId,
    publisher: opts.publisher,
    title: opts.title,
    doc_type: opts.docType,
    page_count: opts.pageCount,
    parse_status: opts.parseStatus,
    bound_record_count: opts.boundRecordCount,
    first_seen_at: isoDaysAgo(opts.firstSeenDaysAgo),
    content_hash: `sha256_${opts.id}`,
    source_url: `https://corpus.internal/docs/${opts.id}.pdf`,
    fetched_at: isoDaysAgo(opts.fetchedDaysAgo),
    effective_date: opts.effectiveDate,
    parse_quality: opts.parseQuality,
    has_text_layer: opts.hasTextLayer,
    used_ocr: opts.usedOcr,
    pages: Array.from({ length: opts.pageCount }, (_, i) => ({
      n: i + 1,
      width_px: PAGE_WIDTH_PX,
      height_px: PAGE_HEIGHT_PX,
      dpi: PAGE_DPI,
    })),
    regions_summary: { table_count: opts.tableCount, row_count: opts.rowCount },
  };
}

export function generateDocuments(rng: Rng, records: RecordSkeleton[]): DocumentsResult {
  const documents: unknown[] = [];
  const pages: DocumentPageOutput[] = [];
  const regionsByDocument: Record<string, unknown[]> = {};
  const bindingsByRecord: Record<string, RecordBinding[]> = {};
  let wrongRowEvidence: WrongRowEvidence | null = null;

  const boundable = records.filter(
    (r) =>
      r.classIndex !== null &&
      r.targetStatus !== "unbound" &&
      r.targetStatus !== "conflicting_sources",
  );
  const conflicting = records.filter((r) => r.targetStatus === "conflicting_sources");

  // 15 normal documents: 3 per taxonomy class.
  let docCounter = 1;
  for (let classIndex = 0; classIndex < TAXONOMY.length; classIndex++) {
    const cls = TAXONOMY[classIndex];
    const classRecords = boundable.filter((r) => r.classIndex === classIndex);
    const chunkSize = Math.ceil(classRecords.length / 3);
    for (let chunk = 0; chunk < 3; chunk++) {
      const slice = classRecords.slice(chunk * chunkSize, (chunk + 1) * chunkSize);
      if (slice.length === 0) continue;
      const isCanonical =
        classIndex === TAXONOMY.findIndex((c) => c.code === "BALL_VALVE_BRONZE") && chunk === 0;
      const docVersionId = isCanonical
        ? "docver_apollo_70_100_v2024"
        : `docver_${String(docCounter).padStart(3, "0")}`;
      const publisher = isCanonical ? CANONICAL_PUBLISHER : rng.pick(FICTIONAL_PUBLISHERS);
      const title = isCanonical
        ? "Apollo 70-100 Series Bronze Ball Valves"
        : `${cls.name} — Family Catalog ${docCounter}`;
      docCounter++;

      const spec = SPEC_COLUMN_BY_CLASS[cls.code];
      const boundRowIndex = isCanonical
        ? slice.findIndex((r) => r.id === "rec_canonical_abc123")
        : undefined;

      const tableRows = slice.map((rec) => {
        const wog = rng.pick([125, 150, 200, 300, 400, 600]);
        const weight = rng.range(0.2, 12, 2);
        return {
          cells: [rec.catalogNo, `${rec.size}"`, `${wog} WOG`, String(weight)],
          wog,
        };
      });
      // Force the canonical row's spec cell to read "600 WOG" (docs/06-frontend.md §3.1-3.2).
      if (boundRowIndex !== undefined && boundRowIndex >= 0) {
        tableRows[boundRowIndex] = {
          ...tableRows[boundRowIndex],
          cells: [
            tableRows[boundRowIndex].cells[0],
            tableRows[boundRowIndex].cells[1],
            "600 WOG",
            tableRows[boundRowIndex].cells[3],
          ],
          wog: 600,
        };
      }
      // Add one decoy row directly after the bound row on the canonical document, with
      // its own spec value — this is the row the "wrong-row" review task's proposed
      // span is misattributed to (docs/06-frontend.md §3.3).
      let decoyRowIndex: number | undefined;
      if (isCanonical && boundRowIndex !== undefined && boundRowIndex >= 0) {
        decoyRowIndex = boundRowIndex + 1;
        tableRows.splice(decoyRowIndex, 0, {
          cells: [`70-106-01`, `3/4"`, "600 WOG", String(rng.range(0.4, 1.2, 2))],
          wog: 600,
        });
        // Deferred: bbox for this row is only known after buildFamilyTable() lays out
        // the (now decoy-row-inclusive) rows below.
      }

      const layout = buildFamilyTable({
        page: 2,
        title,
        subtitle: `${cls.name} — dimensions and ratings`,
        publisher,
        columns: TABLE_COLUMNS.map((c) => (c.key === "spec" ? { ...c, header: spec.header } : c)),
        rows: tableRows.map((r) => ({ cells: r.cells })),
        boundRowIndex,
      });

      pages.push({ documentVersionId: docVersionId, page: 2, svg: layout.svg });

      const regions: unknown[] = [
        {
          id: `${docVersionId}/table1`,
          region_type: "table",
          page: 2,
          bbox: layout.tableBbox,
          path: "table:1",
          text: null,
          parent_region_id: null,
        },
      ];
      layout.rowBboxes.forEach((rb, rowIdx) => {
        regions.push({
          id: `${docVersionId}/table1/row${rowIdx + 1}`,
          region_type: "row",
          page: 2,
          bbox: rb,
          path: `table:1/row:${rowIdx + 1}`,
          text: tableRows[rowIdx]?.cells.join(" "),
          parent_region_id: `${docVersionId}/table1`,
        });
      });
      layout.cells.forEach((cell) => {
        regions.push({
          id: `${docVersionId}/table1/row${cell.rowIndex + 1}/${cell.columnKey}`,
          region_type: "cell",
          page: 2,
          bbox: cell.bbox,
          path: `table:1/row:${cell.rowIndex + 1}/cell:${cell.columnKey}`,
          text: cell.text,
          parent_region_id: `${docVersionId}/table1/row${cell.rowIndex + 1}`,
        });
      });
      regionsByDocument[docVersionId] = regions;

      if (isCanonical && decoyRowIndex !== undefined) {
        wrongRowEvidence = {
          documentVersionId: docVersionId,
          page: 2,
          regionId: `${docVersionId}/table1/row${decoyRowIndex + 1}`,
          bbox: layout.rowBboxes[decoyRowIndex],
          snippetText: "PTFE",
        };
      }

      documents.push(
        buildDocumentWire({
          id: docVersionId,
          documentId: `doc_${cls.code.toLowerCase()}_${chunk}`,
          publisher,
          title,
          docType: chunk === 0 ? "family_catalog" : "spec_sheet",
          pageCount: 4,
          parseStatus: "parsed",
          boundRecordCount: slice.length,
          firstSeenDaysAgo: rng.int(20, 120),
          fetchedDaysAgo: rng.int(1, 20),
          effectiveDate: "2024-01-01",
          parseQuality: rng.range(0.9, 1, 2),
          hasTextLayer: true,
          usedOcr: false,
          tableCount: 1,
          rowCount: layout.rowBboxes.length,
        }),
      );

      slice.forEach((rec, idx) => {
        const rowIndex = decoyRowIndex !== undefined && idx >= boundRowIndex! + 1 ? idx + 1 : idx;
        const rowBbox = layout.rowBboxes[rowIndex];
        const specCell = layout.cells.find(
          (c) => c.rowIndex === rowIndex && c.columnKey === "spec",
        )!;
        const sizeCell = layout.cells.find(
          (c) => c.rowIndex === rowIndex && c.columnKey === "size",
        )!;
        bindingsByRecord[rec.id] = [
          {
            documentVersionId: docVersionId,
            regionId: `${docVersionId}/table1/row${rowIndex + 1}`,
            page: 2,
            confidence: rng.range(0.9, 0.99, 2),
            signals: { exact_mpn_hit: false, catalog_no_hit: true, supplier_match: rng.bool(0.7) },
            wogDisplay: tableRows[rowIndex].cells[2],
            wogValue: tableRows[rowIndex].wog,
            sizeCellBbox: sizeCell.bbox,
            specCellBbox: specCell.bbox,
            rowBbox,
            catalogNo: rec.catalogNo,
          },
        ];
      });
    }
  }

  // The unparseable document — no regions, no evidence possible from it.
  const unparseableId = "docver_unparseable_001";
  documents.push(
    buildDocumentWire({
      id: unparseableId,
      documentId: "doc_unparseable",
      publisher: rng.pick(FICTIONAL_PUBLISHERS),
      title: "Scanned Legacy Catalog (no text layer)",
      docType: "full_catalog",
      pageCount: 6,
      parseStatus: "unparseable",
      boundRecordCount: 0,
      firstSeenDaysAgo: rng.int(60, 150),
      fetchedDaysAgo: rng.int(30, 60),
      effectiveDate: null,
      parseQuality: null,
      hasTextLayer: false,
      usedOcr: true,
      tableCount: 0,
      rowCount: 0,
    }),
  );
  regionsByDocument[unparseableId] = [];

  // Bind a handful of otherwise-incomplete records to the unparseable document — their
  // attributes resolve to Unknown(DOCUMENT_UNPARSEABLE) in attribute-values.ts.
  const unparseableCandidates = records
    .filter((r) => r.targetStatus === "incomplete" || r.targetStatus === "unknown_heavy")
    .slice(0, 4);
  unparseableCandidates.forEach((rec) => {
    bindingsByRecord[rec.id] = [
      {
        documentVersionId: unparseableId,
        regionId: unparseableId,
        page: 1,
        confidence: 0.3,
        signals: { exact_mpn_hit: false, supplier_match: false },
        wogDisplay: "",
        wogValue: 0,
        sizeCellBbox: [0, 0, 0, 0],
        specCellBbox: [0, 0, 0, 0],
        rowBbox: [0, 0, 0, 0],
        catalogNo: rec.catalogNo,
      },
    ];
  });

  // The unresolvable revision-conflict pair: two versions of the same logical document,
  // stating different WOG ratings for the same catalog number.
  const conflictCls = TAXONOMY.find((c) => c.code === "BALL_VALVE_BRONZE")!;
  const conflictSpec = SPEC_COLUMN_BY_CLASS[conflictCls.code];
  const conflictVersions: { id: string; wog: number; effectiveDate: string }[] = [
    { id: "docver_conflict_rev2023", wog: 500, effectiveDate: "2023-03-01" },
    { id: "docver_conflict_rev2025", wog: 600, effectiveDate: "2025-06-01" },
  ];
  for (const version of conflictVersions) {
    const rows = conflicting.map((rec) => ({
      cells: [rec.catalogNo, `${rec.size}"`, `${version.wog} WOG`, String(rng.range(0.3, 1, 2))],
      wog: version.wog,
    }));
    const layout = buildFamilyTable({
      page: 2,
      title: "Apollo 70-100 Series Bronze Ball Valves",
      subtitle: `Bronze Ball Valve — dimensions and ratings (rev. ${version.effectiveDate})`,
      publisher: CANONICAL_PUBLISHER,
      columns: TABLE_COLUMNS.map((c) =>
        c.key === "spec" ? { ...c, header: conflictSpec.header } : c,
      ),
      rows: rows.map((r) => ({ cells: r.cells })),
    });
    pages.push({ documentVersionId: version.id, page: 2, svg: layout.svg });

    const regions: unknown[] = [
      {
        id: `${version.id}/table1`,
        region_type: "table",
        page: 2,
        bbox: layout.tableBbox,
        path: "table:1",
        text: null,
        parent_region_id: null,
      },
    ];
    layout.rowBboxes.forEach((rb, rowIdx) => {
      regions.push({
        id: `${version.id}/table1/row${rowIdx + 1}`,
        region_type: "row",
        page: 2,
        bbox: rb,
        path: `table:1/row:${rowIdx + 1}`,
        text: rows[rowIdx].cells.join(" "),
        parent_region_id: `${version.id}/table1`,
      });
    });
    layout.cells.forEach((cell) => {
      regions.push({
        id: `${version.id}/table1/row${cell.rowIndex + 1}/${cell.columnKey}`,
        region_type: "cell",
        page: 2,
        bbox: cell.bbox,
        path: `table:1/row:${cell.rowIndex + 1}/cell:${cell.columnKey}`,
        text: cell.text,
        parent_region_id: `${version.id}/table1/row${cell.rowIndex + 1}`,
      });
    });
    regionsByDocument[version.id] = regions;

    documents.push(
      buildDocumentWire({
        id: version.id,
        documentId: "doc_conflict_family",
        publisher: CANONICAL_PUBLISHER,
        title: "Apollo 70-100 Series Bronze Ball Valves",
        docType: "family_catalog",
        pageCount: 4,
        parseStatus: "parsed",
        boundRecordCount: conflicting.length,
        firstSeenDaysAgo: version.wog === 500 ? 400 : 40,
        fetchedDaysAgo: version.wog === 500 ? 400 : 10,
        effectiveDate: version.effectiveDate,
        parseQuality: 0.97,
        hasTextLayer: true,
        usedOcr: false,
        tableCount: 1,
        rowCount: layout.rowBboxes.length,
      }),
    );

    conflicting.forEach((rec, rowIndex) => {
      const specCell = layout.cells.find((c) => c.rowIndex === rowIndex && c.columnKey === "spec")!;
      const sizeCell = layout.cells.find((c) => c.rowIndex === rowIndex && c.columnKey === "size")!;
      const binding: RecordBinding = {
        documentVersionId: version.id,
        regionId: `${version.id}/table1/row${rowIndex + 1}`,
        page: 2,
        confidence: rng.range(0.85, 0.95, 2),
        signals: { exact_mpn_hit: false, catalog_no_hit: true, supplier_match: true },
        wogDisplay: rows[rowIndex].cells[2],
        wogValue: rows[rowIndex].wog,
        sizeCellBbox: sizeCell.bbox,
        specCellBbox: specCell.bbox,
        rowBbox: layout.rowBboxes[rowIndex],
        catalogNo: rec.catalogNo,
        conflictNote: `Revision ${version.effectiveDate} states ${rows[rowIndex].cells[2]}`,
      };
      bindingsByRecord[rec.id] = [...(bindingsByRecord[rec.id] ?? []), binding];
    });
  }

  return {
    documents,
    pages,
    regionsByDocument,
    bindingsByRecord,
    unparseableDocumentVersionId: unparseableId,
    wrongRowEvidence,
  };
}
