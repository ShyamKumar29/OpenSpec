import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentViewer } from "./document-viewer";
import type { DocumentDetail, DocumentRegion } from "@/lib/contracts/document";

const useDocumentQueryMock = vi.fn();
const useDocumentRegionsQueryMock = vi.fn();

vi.mock("@/lib/queries/documents", () => ({
  useDocumentQuery: (...args: unknown[]) => useDocumentQueryMock(...args),
  useDocumentRegionsQuery: (...args: unknown[]) => useDocumentRegionsQueryMock(...args),
}));

const PAGE = { n: 2, widthPx: 1700, heightPx: 2200, dpi: 200 };

const doc: DocumentDetail = {
  documentVersionId: "docver_test",
  documentId: "doc_test",
  publisher: "Meridian Flow Control",
  title: "Test Family Catalog",
  docType: "family_catalog",
  pageCount: 4,
  parseStatus: "parsed",
  boundRecordCount: 3,
  firstSeenAt: "2026-01-01T00:00:00Z",
  contentHash: "sha256_test",
  sourceUrl: null,
  fetchedAt: "2026-01-01T00:00:00Z",
  effectiveDate: "2024-01-01",
  parseQuality: 0.97,
  hasTextLayer: true,
  usedOcr: false,
  pages: [
    { n: 1, widthPx: 1700, heightPx: 2200, dpi: 200 },
    PAGE,
    { n: 3, widthPx: 1700, heightPx: 2200, dpi: 200 },
    { n: 4, widthPx: 1700, heightPx: 2200, dpi: 200 },
  ],
  regionsSummary: { tableCount: 1, rowCount: 10 },
};

const region: DocumentRegion = {
  id: "docver_test/table1/row1",
  regionType: "row",
  page: 2,
  bbox: [100, 320, 1600, 360],
  path: "table:1/row:1",
  text: '70-104-01 1/2" 600 WOG',
  parentRegionId: "docver_test/table1",
};

function successResult<T>(data: T) {
  return { status: "success", data, error: null, refetch: vi.fn(), isLoading: false };
}
function pendingResult() {
  return { status: "pending", data: undefined, error: null, refetch: vi.fn(), isLoading: true };
}
function errorResult(error: Error) {
  return { status: "error", data: undefined, error, refetch: vi.fn(), isLoading: false };
}

beforeEach(() => {
  useDocumentQueryMock.mockReset();
  useDocumentRegionsQueryMock.mockReset();
});

describe("DocumentViewer", () => {
  it("renders a loading state while document metadata is pending", () => {
    useDocumentQueryMock.mockReturnValue(pendingResult());
    useDocumentRegionsQueryMock.mockReturnValue(pendingResult());
    render(<DocumentViewer documentVersionId="docver_test" />);
    expect(screen.getByTestId("document-viewer-loading")).toBeInTheDocument();
  });

  it("renders an error state with a retry action when the document fails to load", () => {
    useDocumentQueryMock.mockReturnValue(errorResult(new Error("network down")));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([]));
    render(<DocumentViewer documentVersionId="docver_test" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders an unavailable-document state for a document with parse_status unparseable", () => {
    useDocumentQueryMock.mockReturnValue(successResult({ ...doc, parseStatus: "unparseable" }));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([]));
    render(<DocumentViewer documentVersionId="docver_test" />);
    expect(screen.getByText("Document could not be parsed")).toBeInTheDocument();
  });

  it("renders an invalid-evidence state when the initial page is outside the document's page range", () => {
    useDocumentQueryMock.mockReturnValue(successResult(doc));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([region]));
    render(<DocumentViewer documentVersionId="docver_test" initialPage={99} />);
    expect(screen.getByText("Evidence location unavailable")).toBeInTheDocument();
  });

  it("renders the page image, region overlay, and a highlight positioned from the normalised bbox", () => {
    useDocumentQueryMock.mockReturnValue(successResult(doc));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([region]));
    render(
      <DocumentViewer
        documentVersionId="docver_test"
        highlights={[{ id: region.id, page: 2, bbox: [312, 480, 372, 494], label: "600 WOG" }]}
      />,
    );

    const canvas = screen.getByTestId("page-canvas");
    expect(canvas).toHaveAttribute("data-page", "2");

    const img = screen.getByRole("img", { name: /Page 2 of Test Family Catalog/ });
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("/documents/docver_test/pages/2/image"),
    );

    const highlight = screen.getByTestId("evidence-highlight");
    // [312, 480, 372, 494] over a 1700x2200 page.
    expect(highlight.style.left).toBe(`${(312 / 1700) * 100}%`);
    expect(highlight.style.top).toBe(`${(480 / 2200) * 100}%`);

    expect(screen.getByText("Evidence: 600 WOG")).toBeInTheDocument();
  });

  it("page navigation advances the rendered page and image URL", () => {
    useDocumentQueryMock.mockReturnValue(successResult(doc));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([region]));
    render(<DocumentViewer documentVersionId="docver_test" initialPage={1} />);

    expect(screen.getByTestId("page-canvas")).toHaveAttribute("data-page", "1");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByTestId("page-canvas")).toHaveAttribute("data-page", "2");
  });

  it("never renders evidence text as markup (INV-7)", () => {
    useDocumentQueryMock.mockReturnValue(successResult(doc));
    useDocumentRegionsQueryMock.mockReturnValue(successResult([region]));
    const hostile = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <DocumentViewer
        documentVersionId="docver_test"
        highlights={[{ id: region.id, page: 2, bbox: [312, 480, 372, 494], label: hostile }]}
      />,
    );
    // Only the legitimate page-image <img> exists — the hostile string must never become
    // a second, injected <img> element.
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByText(`Evidence: ${hostile}`)).toBeInTheDocument();
  });
});
