import { describe, expect, it } from "vitest";
import { formatPercent } from "./percent";

describe("formatPercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(formatPercent(0.583)).toBe("58%");
    expect(formatPercent(0.585)).toBe("59%"); // 58.5 rounds up
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("never emits a decimal point", () => {
    expect(formatPercent(0.999)).toBe("100%");
    expect(formatPercent(0.001)).toBe("0%");
  });
});
