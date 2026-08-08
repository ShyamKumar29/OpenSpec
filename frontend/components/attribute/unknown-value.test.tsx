import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnknownValue } from "./unknown-value";

describe("UnknownValue", () => {
  it("renders the reason label, fix owner, and remediation hint (INV-4)", () => {
    render(<UnknownValue reason="ATTRIBUTE_NOT_IN_DOCUMENT" />);
    expect(screen.getByText("Not stated in the document")).toBeInTheDocument();
    expect(screen.getByText(/fix owner: Ops \(other document\)/)).toBeInTheDocument();
    expect(screen.getByText(/Source an additional document/)).toBeInTheDocument();
  });

  it("omits the remediation hint in compact mode but still shows the reason", () => {
    render(<UnknownValue reason="NO_DOCUMENT_FOUND" compact />);
    expect(screen.getByText("No document found")).toBeInTheDocument();
    expect(screen.queryByText(/fix owner/)).not.toBeInTheDocument();
  });

  it("never renders the literal string 'N/A'", () => {
    const { container } = render(<UnknownValue reason="SYSTEM_ERROR" />);
    expect(container.textContent).not.toMatch(/N\/A/);
  });
});
