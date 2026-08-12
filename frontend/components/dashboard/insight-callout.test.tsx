import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertOctagon } from "lucide-react";
import { InsightCallout } from "./insight-callout";

describe("InsightCallout", () => {
  it("renders title, value, and description together", () => {
    render(
      <InsightCallout
        icon={AlertOctagon}
        tone="attention"
        title="Tier-0 approval gate"
        value="96"
        description="Pressure, temperature, class & compliance — never auto-accepted (INV-9)."
      />,
    );
    expect(screen.getByText("Tier-0 approval gate")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText(/never auto-accepted/)).toBeInTheDocument();
  });

  it("links into the page that owns the underlying data when href is given", () => {
    render(
      <InsightCallout
        icon={AlertOctagon}
        title="Largest Unknown hotspot"
        value="264"
        description="attribute not in document → Ops (other document)"
        href="/catalog?has_unknown_reason=true"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalog?has_unknown_reason=true");
  });
});
