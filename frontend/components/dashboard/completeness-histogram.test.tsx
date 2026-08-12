import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompletenessHistogram } from "./completeness-histogram";

const DISTRIBUTION = [
  { bucket: "0-25%", count: 21 },
  { bucket: "25-50%", count: 14 },
  { bucket: "50-75%", count: 27 },
  { bucket: "75-100%", count: 178 },
];

describe("CompletenessHistogram", () => {
  it("renders every bucket's label and count", () => {
    render(<CompletenessHistogram distribution={DISTRIBUTION} />);
    for (const d of DISTRIBUTION) {
      expect(screen.getByText(d.bucket)).toBeInTheDocument();
      expect(screen.getByText(String(d.count))).toBeInTheDocument();
    }
  });

  it("exposes the full distribution as an accessible text alternative (never colour/bar-length alone)", () => {
    render(<CompletenessHistogram distribution={DISTRIBUTION} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAccessibleName(/178 records at 75-100% complete/);
  });

  it("handles an all-zero distribution without dividing by zero", () => {
    render(<CompletenessHistogram distribution={[{ bucket: "0-25%", count: 0 }]} />);
    expect(screen.getByText("0-25%")).toBeInTheDocument();
  });
});
