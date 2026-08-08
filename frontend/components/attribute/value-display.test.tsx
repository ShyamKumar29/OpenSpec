import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueDisplay } from "./value-display";

describe("ValueDisplay", () => {
  it("renders the value as a plain text node", () => {
    render(<ValueDisplay value="600 psi" />);
    expect(screen.getByText("600 psi")).toBeInTheDocument();
  });

  it("never interprets the value as markup (INV-7)", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { container } = render(<ValueDisplay value={hostile} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(hostile);
  });
});
