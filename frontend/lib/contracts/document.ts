/**
 * Documents (docs/api.md §Documents). Includes the additive `pages` field agreed in
 * docs/14-frontend-implementation-plan.md §3 C3/O1: per-page pixel dimensions + DPI, so
 * `bbox` (in AttributeValue evidence) and the rendered page image share one coordinate
 * system by construction. Non-breaking; recorded in docs/api.md.
 */
import { z } from "zod";

export const PARSE_STATUSES = ["pending", "parsed", "unparseable", "ocr_fallback"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const DOC_TYPES = [
  "spec_sheet",
  "family_catalog",
  "submittal",
  "full_catalog",
  "om_manual",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

const pageWireSchema = z.object({
  n: z.number().int().positive(),
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
  dpi: z.number().int().positive(),
});
export interface DocumentPage {
  n: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
}
function adaptPage(w: z.infer<typeof pageWireSchema>): DocumentPage {
  return { n: w.n, widthPx: w.width_px, heightPx: w.height_px, dpi: w.dpi };
}

export const documentSummaryWireSchema = z.object({
  document_version_id: z.string(),
  document_id: z.string(),
  publisher: z.string(),
  title: z.string(),
  doc_type: z.enum(DOC_TYPES),
  page_count: z.number().int().nonnegative(),
  parse_status: z.enum(PARSE_STATUSES),
  bound_record_count: z.number().int().nonnegative(),
  first_seen_at: z.string(),
});
export type DocumentSummaryWire = z.infer<typeof documentSummaryWireSchema>;

export interface DocumentSummary {
  documentVersionId: string;
  documentId: string;
  publisher: string;
  title: string;
  docType: DocType;
  pageCount: number;
  parseStatus: ParseStatus;
  boundRecordCount: number;
  firstSeenAt: string;
}

export function adaptDocumentSummary(wireInput: unknown): DocumentSummary {
  const wire = documentSummaryWireSchema.parse(wireInput);
  return {
    documentVersionId: wire.document_version_id,
    documentId: wire.document_id,
    publisher: wire.publisher,
    title: wire.title,
    docType: wire.doc_type,
    pageCount: wire.page_count,
    parseStatus: wire.parse_status,
    boundRecordCount: wire.bound_record_count,
    firstSeenAt: wire.first_seen_at,
  };
}

export const documentDetailWireSchema = documentSummaryWireSchema.extend({
  content_hash: z.string(),
  source_url: z.string().nullable(),
  fetched_at: z.string(),
  effective_date: z.string().nullable(),
  parse_quality: z.number().min(0).max(1).nullable(),
  has_text_layer: z.boolean(),
  used_ocr: z.boolean(),
  pages: z.array(pageWireSchema),
  regions_summary: z.object({
    table_count: z.number().int().nonnegative(),
    row_count: z.number().int().nonnegative(),
  }),
});
export type DocumentDetailWire = z.infer<typeof documentDetailWireSchema>;

export interface DocumentDetail extends DocumentSummary {
  contentHash: string;
  sourceUrl: string | null;
  fetchedAt: string;
  effectiveDate: string | null;
  parseQuality: number | null;
  hasTextLayer: boolean;
  usedOcr: boolean;
  pages: DocumentPage[];
  regionsSummary: { tableCount: number; rowCount: number };
}

export function adaptDocumentDetail(wireInput: unknown): DocumentDetail {
  const wire = documentDetailWireSchema.parse(wireInput);
  return {
    ...adaptDocumentSummary(wire),
    contentHash: wire.content_hash,
    sourceUrl: wire.source_url,
    fetchedAt: wire.fetched_at,
    effectiveDate: wire.effective_date,
    parseQuality: wire.parse_quality,
    hasTextLayer: wire.has_text_layer,
    usedOcr: wire.used_ocr,
    pages: wire.pages.map(adaptPage),
    regionsSummary: {
      tableCount: wire.regions_summary.table_count,
      rowCount: wire.regions_summary.row_count,
    },
  };
}

export const REGION_TYPES = ["page", "table", "row", "cell", "block"] as const;
export type RegionType = (typeof REGION_TYPES)[number];

export const documentRegionWireSchema = z.object({
  id: z.string(),
  region_type: z.enum(REGION_TYPES),
  page: z.number().int().positive(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  path: z.string(),
  text: z.string().nullable(),
  parent_region_id: z.string().nullable(),
});
export type DocumentRegionWire = z.infer<typeof documentRegionWireSchema>;

export interface DocumentRegion {
  id: string;
  regionType: RegionType;
  page: number;
  bbox: [number, number, number, number];
  path: string;
  text: string | null;
  parentRegionId: string | null;
}

export function adaptDocumentRegion(wireInput: unknown): DocumentRegion {
  const wire = documentRegionWireSchema.parse(wireInput);
  return {
    id: wire.id,
    regionType: wire.region_type,
    page: wire.page,
    bbox: wire.bbox,
    path: wire.path,
    text: wire.text,
    parentRegionId: wire.parent_region_id,
  };
}

export const documentBindingWireSchema = z.object({
  document_version_id: z.string(),
  region_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  signals: z.record(z.string(), z.unknown()),
});
export type DocumentBindingWire = z.infer<typeof documentBindingWireSchema>;

export interface DocumentBinding {
  documentVersionId: string;
  regionId: string | null;
  confidence: number;
  signals: Record<string, unknown>;
}

export function adaptDocumentBinding(wireInput: unknown): DocumentBinding {
  const wire = documentBindingWireSchema.parse(wireInput);
  return {
    documentVersionId: wire.document_version_id,
    regionId: wire.region_id,
    confidence: wire.confidence,
    signals: wire.signals,
  };
}
