import { describe, expect, it } from "vitest";
import { confidenceGlyph, formatConfidence } from "./confidence";

describe("confidenceGlyph", () => {
  it("returns the solid glyph at and above 0.85", () => {
    expect(confidenceGlyph(0.97)).toBe("●");
    expect(confidenceGlyph(0.85)).toBe("●");
  });

  it("returns the half glyph between 0.6 and 0.85", () => {
    expect(confidenceGlyph(0.81)).toBe("◐");
    expect(confidenceGlyph(0.6)).toBe("◐");
  });

  it("returns the empty glyph below 0.6", () => {
    expect(confidenceGlyph(0.44)).toBe("○");
    expect(confidenceGlyph(0)).toBe("○");
  });
});

describe("formatConfidence", () => {
  it("always renders two decimal places", () => {
    expect(formatConfidence(0.97)).toBe("0.97");
    expect(formatConfidence(0.4)).toBe("0.40");
    expect(formatConfidence(1)).toBe("1.00");
  });
});
