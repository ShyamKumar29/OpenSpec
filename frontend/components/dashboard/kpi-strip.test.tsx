import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Grid2x2 } from "lucide-react";
import { KpiTile } from "./kpi-strip";

describe("KpiTile", () => {
  it("renders label, value, and detail together", () => {
    render(<KpiTile icon={Grid2x2} label="Catalog records" value="240" detail="5 PVF classes" />);
    expect(screen.getByText("Catalog records")).toBeInTheDocument();
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("5 PVF classes")).toBeInTheDocument();
  });

  it("renders as a link when href is given, with an accessible name including the value", () => {
    render(<KpiTile icon={Grid2x2} label="Open review workload" value="383" href="/review" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/review");
    expect(link).toHaveTextContent("383");
  });

  it("renders as a plain (non-interactive) tile when no href is given", () => {
    render(<KpiTile icon={Grid2x2} label="Cost / SKU" value="$0.024" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the delta with direction, never colour alone (numeral + icon + text together)", () => {
    render(
      <KpiTile
        icon={Grid2x2}
        label="STP · all mandatory"
        value="58%"
        delta={{ direction: "up", good: true, label: "+7pts vs 4 runs ago" }}
      />,
    );
    expect(screen.getByText("+7pts vs 4 runs ago")).toBeInTheDocument();
  });
});
