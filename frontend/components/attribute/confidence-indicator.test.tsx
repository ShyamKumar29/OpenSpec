import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceIndicator } from "./confidence-indicator";

describe("ConfidenceIndicator", () => {
  it("renders numeral, glyph, and provenance together (NFR-ACC-3)", () => {
    render(<ConfidenceIndicator value={0.97} provenance="EXTRACTED" />);
    expect(screen.getByText(/0\.97/)).toBeInTheDocument();
    expect(screen.getByText("●", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Extracted")).toBeInTheDocument();
  });

  it("renders without a provenance chip when none is given", () => {
    render(<ConfidenceIndicator value={0.44} />);
    expect(screen.getByText(/0\.44/)).toBeInTheDocument();
    expect(screen.queryByText("Extracted")).not.toBeInTheDocument();
  });
});
