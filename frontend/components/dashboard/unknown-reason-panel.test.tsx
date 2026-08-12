import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnknownReasonPanel } from "./unknown-reason-panel";

describe("UnknownReasonPanel", () => {
  it("sorts reasons by count, descending, regardless of input order", () => {
    render(
      <UnknownReasonPanel
        breakdown={[
          { reason: "AMBIGUOUS_CANDIDATES", count: 37, fixOwner: "Reviewer" },
          { reason: "ATTRIBUTE_NOT_IN_DOCUMENT", count: 264, fixOwner: "Ops (other document)" },
          { reason: "NO_DOCUMENT_FOUND", count: 125, fixOwner: "Ops (sourcing)" },
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Not stated in the document");
    expect(rows[0]).toHaveTextContent("264");
    expect(rows[1]).toHaveTextContent("No document found");
    expect(rows[2]).toHaveTextContent("Ambiguous — multiple candidates");
  });

  it("routes every reason to its fix owner, visibly (never colour-only identity)", () => {
    render(
      <UnknownReasonPanel
        breakdown={[{ reason: "VALIDATION_FAILED", count: 40, fixOwner: "Reviewer + rules owner" }]}
      />,
    );
    expect(screen.getByText(/Reviewer \+ rules owner/)).toBeInTheDocument();
  });

  it("falls back to the raw reason code if it isn't in the known copy table", () => {
    render(
      <UnknownReasonPanel
        breakdown={[{ reason: "SOME_FUTURE_CODE", count: 3, fixOwner: "TBD" }]}
      />,
    );
    expect(screen.getByText("SOME_FUTURE_CODE")).toBeInTheDocument();
  });
});
