import { describe, expect, it } from "vitest";
import { bboxToNormalizedRect, findPage, isValidBbox, rectToCssPercent } from "./coordinates";

// Matches the fixed page canvas every generated fixture page uses
// (mocks/fixtures/family-table.ts: 1700x2200px @ 200dpi) and the bbox example from
// docs/api.md §Attribute values (`[312, 480, 372, 494]`).
const PAGE = { n: 1, widthPx: 1700, heightPx: 2200, dpi: 200 };

describe("isValidBbox", () => {
  it("accepts a real rectangle", () => {
    expect(isValidBbox([312, 480, 372, 494])).toBe(true);
  });

  it("rejects the all-zero sentinel used for unbindable evidence", () => {
    expect(isValidBbox([0, 0, 0, 0])).toBe(false);
  });

  it("rejects a degenerate (zero-area) rectangle", () => {
    expect(isValidBbox([100, 100, 100, 200])).toBe(false); // x1 === x0
    expect(isValidBbox([100, 100, 200, 100])).toBe(false); // y1 === y0
  });

  it("rejects an inverted rectangle", () => {
    expect(isValidBbox([200, 200, 100, 100])).toBe(false);
  });

  it("rejects non-finite coordinates", () => {
    expect(isValidBbox([NaN, 0, 10, 10])).toBe(false);
    expect(isValidBbox([0, 0, Infinity, 10])).toBe(false);
  });
});

describe("bboxToNormalizedRect", () => {
  it("divides pixel-space coordinates by page dimensions", () => {
    const rect = bboxToNormalizedRect([312, 480, 372, 494], PAGE);
    expect(rect.x0).toBeCloseTo(312 / 1700);
    expect(rect.y0).toBeCloseTo(480 / 2200);
    expect(rect.x1).toBeCloseTo(372 / 1700);
    expect(rect.y1).toBeCloseTo(494 / 2200);
  });

  it("is DPI- and page-size independent by construction — same fraction at a different scale", () => {
    const doublePage = { widthPx: 3400, heightPx: 4400 };
    const a = bboxToNormalizedRect([312, 480, 372, 494], PAGE);
    const b = bboxToNormalizedRect([624, 960, 744, 988], doublePage);
    expect(b.x0).toBeCloseTo(a.x0);
    expect(b.y0).toBeCloseTo(a.y0);
    expect(b.x1).toBeCloseTo(a.x1);
    expect(b.y1).toBeCloseTo(a.y1);
  });

  it("clamps a bbox that overshoots the page to [0,1]", () => {
    const rect = bboxToNormalizedRect([-50, -50, 1800, 2300], PAGE);
    expect(rect.x0).toBe(0);
    expect(rect.y0).toBe(0);
    expect(rect.x1).toBe(1);
    expect(rect.y1).toBe(1);
  });

  it("throws rather than dividing by a non-positive page dimension", () => {
    expect(() => bboxToNormalizedRect([0, 0, 10, 10], { widthPx: 0, heightPx: 100 })).toThrow();
  });
});

describe("rectToCssPercent", () => {
  it("converts a normalised rect to left/top/width/height percentages", () => {
    const css = rectToCssPercent({ x0: 0.25, y0: 0.1, x1: 0.5, y1: 0.3 });
    expect(css.left).toBe("25%");
    expect(css.top).toBe("10%");
    expect(css.width).toBe("25%");
    expect(css.height).toBe("20%");
  });
});

describe("findPage", () => {
  const pages = [PAGE, { n: 2, widthPx: 1700, heightPx: 2200, dpi: 200 }];

  it("finds an existing page by number", () => {
    expect(findPage(pages, 2)?.n).toBe(2);
  });

  it("returns null for an out-of-range page — an invalid-evidence state, not a crash", () => {
    expect(findPage(pages, 99)).toBeNull();
  });
});
