/**
 * Shared table-geometry generator for family-catalog document pages. Regions (bboxes)
 * and the rendered SVG are built from the SAME layout numbers, so the evidence bbox
 * and the pixel it highlights can never drift apart (mirrors ADR-0012's guarantee for
 * the real rasteriser). This is what makes the F2 coordinate fixture test meaningful.
 *
 * Fixed page canvas for every generated document: 1700x2200px @ 200dpi (8.5x11in) —
 * matches the example in docs/14-frontend-implementation-plan.md §3 C3.
 */

export const PAGE_WIDTH_PX = 1700;
export const PAGE_HEIGHT_PX = 2200;
export const PAGE_DPI = 200;

export const MARGIN_X = 100;
const TABLE_TOP = 320;
const HEADER_ROW_H = 44;
const DATA_ROW_H = 40;
const TABLE_WIDTH = PAGE_WIDTH_PX - MARGIN_X * 2;

export interface TableColumn {
  key: string;
  header: string;
  /** Fraction of TABLE_WIDTH this column occupies. Must sum to 1 across columns. */
  widthFraction: number;
}

export interface TableRowData {
  /** One cell string per column, in column order. */
  cells: string[];
  /** True for the row the demo highlights as the bound row. */
  isBoundRow?: boolean;
}

export type Bbox = [number, number, number, number];

export interface CellRegion {
  rowIndex: number;
  columnKey: string;
  bbox: Bbox;
  text: string;
}

export interface FamilyTableLayout {
  page: number;
  tableBbox: Bbox;
  headerBbox: Bbox;
  rowBboxes: Bbox[];
  cells: CellRegion[];
  columns: TableColumn[];
  svg: string;
}

function columnBounds(columns: TableColumn[]): { key: string; x0: number; x1: number }[] {
  let x = MARGIN_X;
  return columns.map((col) => {
    const w = TABLE_WIDTH * col.widthFraction;
    const bounds = { key: col.key, x0: x, x1: x + w };
    x += w;
    return bounds;
  });
}

export function buildFamilyTable(opts: {
  page: number;
  title: string;
  subtitle: string;
  publisher: string;
  columns: TableColumn[];
  rows: TableRowData[];
  boundRowIndex?: number;
}): FamilyTableLayout {
  const { page, title, subtitle, publisher, columns, rows, boundRowIndex } = opts;
  const bounds = columnBounds(columns);
  const tableHeight = HEADER_ROW_H + rows.length * DATA_ROW_H;
  const tableBbox: Bbox = [MARGIN_X, TABLE_TOP, MARGIN_X + TABLE_WIDTH, TABLE_TOP + tableHeight];
  const headerBbox: Bbox = [MARGIN_X, TABLE_TOP, MARGIN_X + TABLE_WIDTH, TABLE_TOP + HEADER_ROW_H];

  const rowBboxes: Bbox[] = [];
  const cells: CellRegion[] = [];
  rows.forEach((row, rowIndex) => {
    const y0 = TABLE_TOP + HEADER_ROW_H + rowIndex * DATA_ROW_H;
    const y1 = y0 + DATA_ROW_H;
    rowBboxes.push([MARGIN_X, y0, MARGIN_X + TABLE_WIDTH, y1]);
    row.cells.forEach((text, colIndex) => {
      const b = bounds[colIndex];
      cells.push({ rowIndex, columnKey: b.key, bbox: [b.x0, y0, b.x1, y1], text });
    });
  });

  const svgParts: string[] = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH_PX}" height="${PAGE_HEIGHT_PX}" viewBox="0 0 ${PAGE_WIDTH_PX} ${PAGE_HEIGHT_PX}" font-family="Helvetica, Arial, sans-serif">`,
  );
  svgParts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  svgParts.push(
    `<text x="${MARGIN_X}" y="120" font-size="34" font-weight="700" fill="#111827">${escapeXml(title)}</text>`,
  );
  svgParts.push(
    `<text x="${MARGIN_X}" y="160" font-size="20" fill="#4b5563">${escapeXml(subtitle)}</text>`,
  );
  svgParts.push(
    `<text x="${MARGIN_X}" y="${PAGE_HEIGHT_PX - 60}" font-size="16" fill="#9ca3af">${escapeXml(publisher)} — page ${page}</text>`,
  );

  // Header row
  svgParts.push(
    `<rect x="${headerBbox[0]}" y="${headerBbox[1]}" width="${headerBbox[2] - headerBbox[0]}" height="${headerBbox[3] - headerBbox[1]}" fill="#f3f4f6" stroke="#111827"/>`,
  );
  bounds.forEach((b) => {
    const col = columns.find((c) => c.key === b.key)!;
    svgParts.push(
      `<text x="${b.x0 + 8}" y="${TABLE_TOP + 29}" font-size="16" font-weight="700" fill="#111827">${escapeXml(col.header)}</text>`,
    );
  });

  // Data rows
  rowBboxes.forEach((rb, rowIndex) => {
    const highlighted = rowIndex === boundRowIndex;
    if (highlighted) {
      svgParts.push(
        `<rect x="${rb[0]}" y="${rb[1]}" width="${rb[2] - rb[0]}" height="${rb[3] - rb[1]}" fill="#fef3c7"/>`,
      );
    }
    svgParts.push(
      `<rect x="${rb[0]}" y="${rb[1]}" width="${rb[2] - rb[0]}" height="${rb[3] - rb[1]}" fill="none" stroke="#d1d5db"/>`,
    );
  });
  cells.forEach((cell) => {
    svgParts.push(
      `<text x="${cell.bbox[0] + 8}" y="${cell.bbox[3] - 12}" font-size="16" fill="#1f2937">${escapeXml(cell.text)}</text>`,
    );
  });
  // Column separators
  bounds.slice(1).forEach((b) => {
    svgParts.push(
      `<line x1="${b.x0}" y1="${TABLE_TOP}" x2="${b.x0}" y2="${TABLE_TOP + tableHeight}" stroke="#d1d5db"/>`,
    );
  });
  svgParts.push(
    `<rect x="${tableBbox[0]}" y="${tableBbox[1]}" width="${tableBbox[2] - tableBbox[0]}" height="${tableBbox[3] - tableBbox[1]}" fill="none" stroke="#111827" stroke-width="2"/>`,
  );
  svgParts.push(`</svg>`);

  return { page, tableBbox, headerBbox, rowBboxes, cells, columns, svg: svgParts.join("\n") };
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
