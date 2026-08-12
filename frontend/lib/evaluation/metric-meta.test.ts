import { describe, expect, it } from "vitest";
import { metricMeta, thresholdStatus } from "./metric-meta";

describe("metricMeta", () => {
  it("returns the documented QR target/stretch for a known metric code", () => {
    const meta = metricMeta("stp_all_mandatory");
    expect(meta.requirement).toBe("QR-3");
    expect(meta.target).toBe(0.55);
    expect(meta.stretch).toBe(0.7);
    expect(meta.direction).toBe("higher-better");
  });

  it("marks ECE and over-abstention as lower-is-better with their QR-13/QR-7 thresholds", () => {
    expect(metricMeta("ece")).toMatchObject({
      direction: "lower-better",
      target: 0.05,
      stretch: 0.03,
    });
    expect(metricMeta("over_abstention_rate")).toMatchObject({
      direction: "lower-better",
      target: 0.18,
      stretch: 0.12,
    });
  });

  it("never crashes on an unmapped metric code — falls back to an unrated entry", () => {
    const meta = metricMeta("some_future_metric");
    expect(meta.target).toBeNull();
    expect(meta.stretch).toBeNull();
    expect(meta.label).toContain("some future metric");
  });
});

describe("thresholdStatus", () => {
  it("is direction-aware for higher-is-better metrics", () => {
    const meta = metricMeta("precision"); // target 0.95, stretch 0.99
    expect(thresholdStatus(0.99, meta)).toBe("stretch-met");
    expect(thresholdStatus(0.96, meta)).toBe("target-met");
    expect(thresholdStatus(0.9, meta)).toBe("below-target");
  });

  it("is direction-aware for lower-is-better metrics — a smaller ECE is the better outcome", () => {
    const meta = metricMeta("ece"); // target 0.05, stretch 0.03
    expect(thresholdStatus(0.02, meta)).toBe("stretch-met");
    expect(thresholdStatus(0.04, meta)).toBe("target-met");
    expect(thresholdStatus(0.09, meta)).toBe("below-target");
  });

  it("reports 'unrated' rather than fabricating a pass/fail for a metric with no QR target", () => {
    expect(thresholdStatus(0.9, metricMeta("recall"))).toBe("unrated");
  });
});
