import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunInput } from "./run-input";

describe("RunInput", () => {
  it("disables Run until MPN or description is filled", async () => {
    const onSubmit = vi.fn();
    render(<RunInput onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("MPN"), "ABC-123");
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
  });

  it("picking a scenario card fills the fields and submits with an explicit scenario", async () => {
    const onSubmit = vi.fn();
    render(<RunInput onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    expect(screen.getByLabelText("MPN")).toHaveValue("ABC-123");
    expect(screen.getByLabelText("Description")).toHaveValue("1/2 BRS BALL VLV 600WOG");

    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mpn: "ABC-123",
      description: "1/2 BRS BALL VLV 600WOG",
      scenario: "success",
      documentName: null,
    });
  });

  it("free text submits with no scenario field — the mock decides the outcome (FR-JDG-1/5)", async () => {
    const onSubmit = vi.fn();
    render(<RunInput onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("MPN"), "<script>alert(1)</script>");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ mpn: "<script>alert(1)</script>", scenario: undefined }),
    );
  });

  it("editing a field after picking a scenario detaches the scenario selection", async () => {
    const onSubmit = vi.fn();
    render(<RunInput onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /Success/ }));
    expect(screen.getByRole("button", { name: /Success/ })).toHaveAttribute("aria-pressed", "true");

    await userEvent.type(screen.getByLabelText("MPN"), "9");
    expect(screen.getByRole("button", { name: /Success/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scenario: undefined }));
  });

  it("disables every control while a run is active", () => {
    render(<RunInput disabled onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("MPN")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Success/ })).toBeDisabled();
  });
});
